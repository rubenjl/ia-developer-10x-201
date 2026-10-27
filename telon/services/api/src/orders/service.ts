import { config } from '../config.js';
import { pool, withTransaction } from '../db.js';
import { HttpError } from '../errors.js';
import { enqueueEmail } from '../queue.js';
import { createQrToken } from '../tickets/qr.js';
import { charge } from './payments-client.js';
import { calcOrderAmounts, type PricedItem } from './pricing.js';

export type CartItem = { seat_id: string } | { pass_type_id: string; quantity: number };

export interface CreateOrderInput {
  tenantId: string;
  eventId: string;
  buyerEmail: string;
  items: CartItem[];
}

// Las entradas pendientes de pago bloquean la butaca unos minutos. Pasado ese tiempo se anulan.
export async function releaseExpiredHolds(): Promise<void> {
  await pool.query(
    `WITH expired AS (
       UPDATE orders SET status = 'failed'
        WHERE status = 'pending' AND created_at < now() - make_interval(mins => $1)
        RETURNING id)
     UPDATE tickets SET status = 'void' WHERE order_id IN (SELECT id FROM expired)`,
    [config.holdMinutes],
  );
}

export async function createOrder(input: CreateOrderInput) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.buyerEmail)) {
    throw new HttpError(400, 'email del comprador no válido');
  }
  await releaseExpiredHolds();

  return withTransaction(async (db) => {
    const ev = await db.query(
      `SELECT id, fee_cents, commission_bps, starts_at FROM events
        WHERE id = $1 AND tenant_id = $2 AND published`,
      [input.eventId, input.tenantId],
    );
    const event = ev.rows[0];
    if (!event) throw new HttpError(404, 'evento no encontrado');
    if (new Date(event.starts_at) < new Date()) throw new HttpError(409, 'el evento ya ha empezado');

    const priced: PricedItem[] = [];
    for (const item of input.items) {
      if ('seat_id' in item) {
        const s = await db.query(
          `SELECT s.id, s.price_cents,
                  EXISTS (SELECT 1 FROM tickets t
                           WHERE t.event_id = s.event_id AND t.seat_id = s.id
                             AND t.status IN ('pending', 'valid')) AS taken
             FROM seats s WHERE s.event_id = $1 AND s.id = $2 FOR UPDATE`,
          [input.eventId, item.seat_id],
        );
        const seat = s.rows[0];
        if (!seat) throw new HttpError(400, `la butaca ${item.seat_id} no existe`);
        if (seat.taken) throw new HttpError(409, `la butaca ${item.seat_id} ya no está libre`);
        priced.push({ kind: 'seat', ref: seat.id, price_cents: seat.price_cents });
      } else {
        const p = await db.query(
          `SELECT pt.id, pt.price_cents, pt.capacity,
                  (SELECT count(*) FROM tickets t
                    WHERE t.pass_type_id = pt.id AND t.status IN ('pending', 'valid'))::int AS sold
             FROM pass_types pt WHERE pt.id = $1 AND pt.event_id = $2 FOR UPDATE`,
          [item.pass_type_id, input.eventId],
        );
        const pass = p.rows[0];
        if (!pass) throw new HttpError(400, `el pase ${item.pass_type_id} no existe`);
        if (pass.sold + item.quantity > pass.capacity) {
          throw new HttpError(409, `no quedan suficientes pases ${pass.id}`);
        }
        for (let i = 0; i < item.quantity; i++) {
          priced.push({ kind: 'pass', ref: pass.id, price_cents: pass.price_cents });
        }
      }
    }

    let amounts;
    try {
      amounts = calcOrderAmounts(priced, event);
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }

    const year = new Date().getFullYear();
    const seq = await db.query<{ n: string }>(`SELECT nextval('order_number_seq') AS n`);
    const orderId = `PED-${year}-${String(seq.rows[0]!.n).padStart(4, '0')}`;

    await db.query(
      `INSERT INTO orders (id, tenant_id, event_id, buyer_email, subtotal_cents, fee_cents, total_cents, commission_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orderId, input.tenantId, input.eventId, input.buyerEmail.toLowerCase(),
        amounts.subtotal_cents, amounts.fee_cents, amounts.total_cents, amounts.commission_cents],
    );
    for (let i = 0; i < priced.length; i++) {
      const it = priced[i]!;
      const line = amounts.lines[i]!;
      await db.query(
        `INSERT INTO tickets (id, order_id, event_id, kind, seat_id, pass_type_id, price_cents, fee_cents, commission_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [`${orderId}-${i + 1}`, orderId, input.eventId, it.kind,
          it.kind === 'seat' ? it.ref : null, it.kind === 'pass' ? it.ref : null,
          line.price_cents, line.fee_cents, line.commission_cents],
      );
    }
    return { id: orderId, status: 'pending', ...amounts, hold_minutes: config.holdMinutes };
  });
}

export async function payOrder(tenantId: string, orderId: string, card: string) {
  const o = await pool.query(
    `SELECT id, status, total_cents FROM orders WHERE id = $1 AND tenant_id = $2`,
    [orderId, tenantId],
  );
  const order = o.rows[0];
  if (!order) throw new HttpError(404, 'pedido no encontrado');
  if (order.status !== 'pending') throw new HttpError(409, `el pedido está ${order.status}`);

  const result = await charge(order.total_cents, card, orderId);

  if (result.status !== 'approved') {
    await withTransaction(async (db) => {
      await db.query(`UPDATE orders SET status = 'failed' WHERE id = $1`, [orderId]);
      await db.query(`UPDATE tickets SET status = 'void' WHERE order_id = $1`, [orderId]);
    });
    throw new HttpError(402, `pago rechazado: ${result.reason ?? 'sin motivo'}`);
  }

  await withTransaction(async (db) => {
    await db.query(`UPDATE orders SET status = 'paid', paid_at = now(), charge_id = $2 WHERE id = $1`, [
      orderId,
      result.id,
    ]);
    const t = await db.query<{ id: string }>(`SELECT id FROM tickets WHERE order_id = $1`, [orderId]);
    for (const ticket of t.rows) {
      await db.query(`UPDATE tickets SET status = 'valid', qr_token = $2 WHERE id = $1`, [
        ticket.id,
        createQrToken(ticket.id, config.ticketsSecret),
      ]);
    }
  });

  await enqueueEmail({ type: 'order-confirmed', orderId });
  return { id: orderId, status: 'paid', charge_id: result.id };
}

