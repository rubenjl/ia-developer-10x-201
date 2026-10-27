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

async function ordersForEmail(tenantId: string, email: string) {
  const result = await pool.query(
    `SELECT o.id, o.status, o.buyer_email, o.subtotal_cents, o.fee_cents, o.total_cents, o.paid_at,
            e.id AS event_id, e.title AS event_title, e.venue, e.starts_at
       FROM orders o JOIN events e ON e.id = o.event_id
      WHERE o.tenant_id = $1 AND o.buyer_email = $2 AND o.status = 'paid'
      ORDER BY o.created_at DESC, o.id`,
    [tenantId, email],
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

export async function requestTicketAccess(tenant: { id: string; slug: string }, emailInput: string) {
  const email = normalizedEmail(emailInput);
  const matchingOrder = await pool.query(
    `SELECT 1 FROM orders WHERE tenant_id = $1 AND buyer_email = $2 AND status = 'paid' LIMIT 1`,
    [tenant.id, email],
  );

  if (matchingOrder.rowCount) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const token = randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO ticket_access (tenant_id, email, code_hash, token_hash, expires_at, attempts, code_used_at)
       VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 minute'), 0, NULL)
       ON CONFLICT (tenant_id, email) DO UPDATE
         SET code_hash = EXCLUDED.code_hash, token_hash = EXCLUDED.token_hash,
             expires_at = EXCLUDED.expires_at, attempts = 0, code_used_at = NULL`,
      [tenant.id, email, hash(code), hash(token), ACCESS_MINUTES],
    );
    const url = `${config.storefrontUrl}/t/${tenant.slug}/mis-entradas#token=${token}`;
    await enqueueEmail({ type: 'ticket-access', tenantId: tenant.id, to: email, code, url });
  }

  return { message: 'Si el correo tiene entradas pagadas, recibirás un código y un enlace temporal.' };
}

export async function getTicketsWithCode(tenantId: string, emailInput: string, code: string) {
  const email = normalizedEmail(emailInput);
  const challenge = await pool.query<{ code_hash: string }>(
    `SELECT code_hash FROM ticket_access
      WHERE tenant_id = $1 AND email = $2 AND expires_at > now()
        AND attempts < $3 AND code_used_at IS NULL`,
    [tenantId, email, MAX_CODE_ATTEMPTS],
  );
  const valid = /^\d{6}$/.test(code) && challenge.rows[0] && equalHash(challenge.rows[0].code_hash, hash(code));
  if (!valid) {
    await pool.query(
      `UPDATE ticket_access SET attempts = attempts + 1
        WHERE tenant_id = $1 AND email = $2 AND expires_at > now() AND attempts < $3 AND code_used_at IS NULL`,
      [tenantId, email, MAX_CODE_ATTEMPTS],
    );
    throw new HttpError(401, 'el código no es válido o ha caducado');
  }

  const consumed = await pool.query(
    `UPDATE ticket_access SET code_used_at = now()
      WHERE tenant_id = $1 AND email = $2 AND expires_at > now()
        AND attempts < $3 AND code_used_at IS NULL RETURNING email`,
    [tenantId, email, MAX_CODE_ATTEMPTS],
  );
  if (!consumed.rowCount) throw new HttpError(401, 'el código no es válido o ha caducado');
  return { orders: await ordersForEmail(tenantId, email) };
}

export async function getTicketsWithLink(tenantId: string, token: string) {
  const access = await pool.query<{ email: string }>(
    `SELECT email FROM ticket_access
      WHERE tenant_id = $1 AND token_hash = $2 AND expires_at > now()`,
    [tenantId, hash(token)],
  );
  if (!access.rows[0]) throw new HttpError(401, 'el enlace no es válido o ha caducado');
  return { orders: await ordersForEmail(tenantId, access.rows[0].email) };
}