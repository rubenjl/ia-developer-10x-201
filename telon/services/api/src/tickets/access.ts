import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';
import { enqueueEmail } from '../queue.js';

const ACCESS_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;
const hash = (value: string) => createHmac('sha256', config.ticketsSecret).update(value).digest('hex');

function equalHash(left: string, right: string) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizedEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new HttpError(400, 'indica un email válido');
  }
  return value;
}

async function ordersForEmail(email: string) {
  const result = await pool.query(
    `SELECT o.id, o.status, o.buyer_email, o.subtotal_cents, o.fee_cents, o.total_cents, o.paid_at,
            e.id AS event_id, e.title AS event_title, e.venue, e.starts_at,
            t.slug AS tenant_slug, t.name AS tenant_name
       FROM orders o JOIN events e ON e.id = o.event_id
       JOIN tenants t ON t.id = o.tenant_id
      WHERE o.buyer_email = $1 AND o.status = 'paid'
      ORDER BY o.created_at DESC, o.id`,
    [email],
  );

  return Promise.all(result.rows.map(async (order) => {
    const tickets = await pool.query(
      `SELECT t.id, t.kind, t.seat_id, t.status, t.price_cents, t.fee_cents,
              CASE WHEN t.status = 'valid' THEN t.qr_token END AS qr_token,
              pt.name AS pass_name
         FROM tickets t LEFT JOIN pass_types pt ON pt.id = t.pass_type_id
        WHERE t.order_id = $1 ORDER BY t.id`,
      [order.id],
    );
    return { ...order, tickets: tickets.rows };
  }));
}

export async function requestTicketAccess(emailInput: string) {
  const email = normalizedEmail(emailInput);
  const matchingOrder = await pool.query(
    `SELECT o.tenant_id FROM orders o
       WHERE o.buyer_email = $1 AND o.status = 'paid'
       ORDER BY o.created_at DESC, o.id LIMIT 1`,
    [email],
  );

  const tenantId = matchingOrder.rows[0]?.tenant_id as string | undefined;
  if (tenantId) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const token = randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO global_ticket_access (email, code_hash, token_hash, expires_at, attempts, code_used_at)
       VALUES ($1, $2, $3, now() + ($4 * interval '1 minute'), 0, NULL)
       ON CONFLICT (email) DO UPDATE
         SET code_hash = EXCLUDED.code_hash, token_hash = EXCLUDED.token_hash,
             expires_at = EXCLUDED.expires_at, attempts = 0, code_used_at = NULL`,
      [email, hash(code), hash(token), ACCESS_MINUTES],
    );
    const url = `${config.storefrontUrl}/mis-entradas#token=${token}`;
    await enqueueEmail({ type: 'ticket-access', tenantId, to: email, code, url });
  }

  return { message: 'Si el correo tiene entradas pagadas, recibirás un código y un enlace temporal.' };
}

export async function getTicketsWithCode(emailInput: string, code: string) {
  const email = normalizedEmail(emailInput);
  const challenge = await pool.query<{ code_hash: string }>(
    `SELECT code_hash FROM global_ticket_access
      WHERE email = $1 AND expires_at > now()
        AND attempts < $2 AND code_used_at IS NULL`,
    [email, MAX_CODE_ATTEMPTS],
  );
  const valid = /^\d{6}$/.test(code) && challenge.rows[0] && equalHash(challenge.rows[0].code_hash, hash(code));
  if (!valid) {
    await pool.query(
      `UPDATE global_ticket_access SET attempts = attempts + 1
        WHERE email = $1 AND expires_at > now() AND attempts < $2 AND code_used_at IS NULL`,
      [email, MAX_CODE_ATTEMPTS],
    );
    throw new HttpError(401, 'el código no es válido o ha caducado');
  }

  const consumed = await pool.query(
    `UPDATE global_ticket_access SET code_used_at = now()
      WHERE email = $1 AND expires_at > now()
        AND attempts < $2 AND code_used_at IS NULL RETURNING email`,
    [email, MAX_CODE_ATTEMPTS],
  );
  if (!consumed.rowCount) throw new HttpError(401, 'el código no es válido o ha caducado');
  return { orders: await ordersForEmail(email) };
}

export async function getTicketsWithLink(token: string) {
  const access = await pool.query<{ email: string }>(
    `SELECT email FROM global_ticket_access
      WHERE token_hash = $1 AND expires_at > now()`,
    [hash(token)],
  );
  if (!access.rows[0]) throw new HttpError(401, 'el enlace no es válido o ha caducado');
  return { orders: await ordersForEmail(access.rows[0].email) };
}