// Cliente de la API pública de Telón. La tienda le dice a la API qué promotor es
// por el dominio o por el slug de la ruta.

export type TenantRef = { host: string } | { slug: string };

export interface PassType {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  available: number;
}

export interface EventInfo {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  fee_cents: number;
  page_tsx: string;
  passes: PassType[];
  zones: { zone: string; price_cents: number; seats: number }[];
}

export interface Seat {
  id: string;
  zone: string;
  row_label: string;
  number: number;
  price_cents: number;
  status: 'free' | 'taken';
}

export type CartItem = { seat_id: string } | { pass_type_id: string; quantity: number };

export interface OrderTicket {
  id: string;
  kind: 'seat' | 'pass';
  seat_id: string | null;
  pass_name: string | null;
  status: string;
  price_cents: number;
  fee_cents: number;
  qr_token: string | null;
}

export interface BuyerOrder {
  id: string;
  status: string;
  buyer_email: string;
  tenant_name: string;
  tenant_slug: string;
  subtotal_cents: number;
  fee_cents: number;
  total_cents: number;
  event_id: string;
  event_title: string;
  venue: string;
  starts_at: string;
  tickets: OrderTicket[];
}

export type TicketAccessOrder = BuyerOrder;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApi(tenant?: TenantRef, base = '/api/public') {
  const headers: Record<string, string> = tenant
    ? 'slug' in tenant ? { 'x-telon-tenant-slug': tenant.slug } : { 'x-telon-host': tenant.host }
    : {};

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(base + path, {
      ...init,
      headers: { ...headers, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
    const body = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
    return body as T;
  }

  return {
    site: () => call<{ tenant: { id: string; slug: string; name: string }; events: Omit<EventInfo, 'page_tsx' | 'passes' | 'zones'>[] }>('/site'),
    event: (id: string) => call<EventInfo>(`/events/${id}`),
    seats: (eventId: string) => call<Seat[]>(`/events/${eventId}/seats`),
    createOrder: (eventId: string, buyerEmail: string, items: CartItem[]) =>
      call<{ id: string; total_cents: number }>('/orders', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId, buyer_email: buyerEmail, items }),
      }),
    payOrder: (orderId: string, card: string) =>
      call<{ id: string; status: string }>(`/orders/${orderId}/pay`, { method: 'POST', body: JSON.stringify({ card }) }),
    requestTicketAccess: (email: string) =>
      call<{ message: string }>('/tickets/access', { method: 'POST', body: JSON.stringify({ email }) }),
    verifyTicketAccess: (email: string, code: string) =>
      call<{ orders: TicketAccessOrder[] }>('/tickets/access/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),
    ticketsFromLink: (token: string) =>
      call<{ orders: TicketAccessOrder[] }>('/tickets/access/link', { method: 'POST', body: JSON.stringify({ token }) }),
  };
}

export type TelonApi = ReturnType<typeof createApi>;
