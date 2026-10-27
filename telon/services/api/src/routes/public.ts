import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';
import { createOrder, payOrder, releaseExpiredHolds, type CartItem } from '../orders/service.js';
import { requestTicketAccess, getTicketsWithCode, getTicketsWithLink } from '../tickets/access.js';
import { resolvePublicTenant } from '../tenants/resolve.js';

async function tenantOf(req: FastifyRequest) {
  const tenant = await resolvePublicTenant(req);
  if (!tenant) throw new HttpError(404, 'no hay ningún promotor en este dominio');
  return tenant;
}

export async function publicRoutes(app: FastifyInstance) {
  // Portada de Telón: lista de promotores (solo para desarrollo y el curso)
  app.get('/api/public/tenants', async () => {
    const r = await pool.query(
      `SELECT t.slug, t.name, array_remove(array_agg(d.host ORDER BY d.host), NULL) AS domains
         FROM tenants t LEFT JOIN domains d ON d.tenant_id = t.id
        GROUP BY t.id ORDER BY t.name`,
    );
    return r.rows;
  });

  app.get('/api/public/site', async (req) => {
    const tenant = await tenantOf(req);
    const events = await pool.query(
      `SELECT id, title, venue, starts_at FROM events
        WHERE tenant_id = $1 AND published ORDER BY starts_at`,
      [tenant.id],
    );
    return { tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name }, events: events.rows };
  });

  app.get<{ Params: { id: string } }>('/api/public/events/:id', async (req) => {
    const tenant = await tenantOf(req);
    const ev = await pool.query(
      `SELECT id, title, venue, starts_at, fee_cents, page_tsx FROM events
        WHERE id = $1 AND tenant_id = $2 AND published`,
      [req.params.id, tenant.id],
    );
    if (!ev.rows[0]) throw new HttpError(404, 'evento no encontrado');
    const passes = await pool.query(
      `SELECT pt.id, pt.name, pt.description, pt.price_cents,
              pt.capacity - (SELECT count(*) FROM tickets t
                              WHERE t.pass_type_id = pt.id AND t.status IN ('pending', 'valid'))::int AS available
         FROM pass_types pt WHERE pt.event_id = $1 ORDER BY pt.price_cents`,
      [req.params.id],
    );
    const zones = await pool.query(
      `SELECT zone, min(price_cents) AS price_cents, count(*)::int AS seats
         FROM seats WHERE event_id = $1 GROUP BY zone ORDER BY min(row_label)`,
      [req.params.id],
    );
    return { ...ev.rows[0], passes: passes.rows, zones: zones.rows };
  });

  app.get<{ Params: { id: string } }>('/api/public/events/:id/seats', async (req) => {
    const tenant = await tenantOf(req);
    await releaseExpiredHolds();
    const r = await pool.query(
      `SELECT s.id, s.zone, s.row_label, s.number, s.price_cents,
              CASE WHEN EXISTS (SELECT 1 FROM tickets t
                                 WHERE t.event_id = s.event_id AND t.seat_id = s.id
                                   AND t.status IN ('pending', 'valid'))
                   THEN 'taken' ELSE 'free' END AS status
         FROM seats s JOIN events e ON e.id = s.event_id
        WHERE s.event_id = $1 AND e.tenant_id = $2
        ORDER BY s.row_label, s.number`,
      [req.params.id, tenant.id],
    );
    return r.rows;
  });

  app.post<{ Body: { event_id: string; buyer_email: string; items: CartItem[] } }>(
    '/api/public/orders',
    async (req, reply) => {
      const tenant = await tenantOf(req);
      const body = req.body ?? ({} as never);
      if (!Array.isArray(body.items)) throw new HttpError(400, 'faltan las entradas del pedido');
      const order = await createOrder({
        tenantId: tenant.id,
        eventId: body.event_id,
        buyerEmail: String(body.buyer_email ?? ''),
        items: body.items,
      });
      return reply.code(201).send(order);
    },
  );

  app.post<{ Params: { id: string }; Body: { card: string } }>('/api/public/orders/:id/pay', async (req) => {
    const tenant = await tenantOf(req);
    return payOrder(tenant.id, req.params.id, String(req.body?.card ?? ''));
  });

  app.post<{ Body: { email: string } }>('/api/public/tickets/access', async (req) => {
    return requestTicketAccess(String(req.body?.email ?? ''));
  });

  app.post<{ Body: { email: string; code: string } }>('/api/public/tickets/access/verify', async (req) => {
    return getTicketsWithCode(String(req.body?.email ?? ''), String(req.body?.code ?? ''));
  });

  app.post<{ Body: { token: string } }>('/api/public/tickets/access/link', async (req) => {
    return getTicketsWithLink(String(req.body?.token ?? ''));
  });
}
