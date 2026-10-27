import { PageRenderer } from '@telon/page-runtime';
import { createApi, formatDate, formatEuros, TelonProvider, TicketQR, type BuyerOrder, type EventInfo, type TenantRef } from '@telon/ui';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PlatformHome } from './components/templates/PlatformHome.js';
import { TenantStorefront } from './components/templates/TenantStorefront.js';
import './styles/storefront.css';

const shell = { maxWidth: 880, margin: '0 auto', padding: 32 } as const;

const ORDER_STATUS: Record<string, string> = { pending: 'pendiente de pago', paid: 'pagado', failed: 'rechazado' };
const TICKET_STATUS: Record<string, string> = { pending: 'sin pagar', valid: 'válida', void: 'anulada', refunded: 'devuelta' };

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    setState({});
    load().then((data) => setState({ data }), (e: Error) => setState({ error: e.message }));
  }, deps);
  return state;
}

export function Portal() {
  const { data, error } = useLoad(
    () => fetch('/api/public/tenants').then((r) => r.json() as Promise<{ slug: string; name: string; domains: string[] }[]>),
    [],
  );
  const port = location.port ? `:${location.port}` : '';
  if (error) return <main className="storefront-state"><p className="storefront-state__eyebrow">No se pudo cargar</p><h1>Las salas no están disponibles ahora.</h1><p>{error}</p></main>;
  if (!data) return <main className="storefront-state" aria-live="polite"><p className="storefront-state__eyebrow">Telón · Cartelera</p><h1>Buscando tu próxima función…</h1></main>;
  document.title = 'Cartelera · Telón';
  return <PlatformHome tenants={data} protocol={location.protocol} port={port} />;
}

export function TenantHome({ tenant, basePath }: { tenant: TenantRef; basePath: string }) {
  const api = useMemo(() => createApi(tenant), [tenant]);
  const { data, error } = useLoad(() => api.site(), [api]);
  if (error) return <main className="storefront-state"><p className="storefront-state__eyebrow">No se pudo cargar</p><h1>Esta función no está disponible ahora.</h1><p>{error}</p></main>;
  if (!data) return <main className="storefront-state" aria-live="polite"><p className="storefront-state__eyebrow">Preparando la sala</p><h1>Cargando cartelera…</h1></main>;
  document.title = `Entradas · ${data.tenant.name}`;
  return <TenantStorefront tenantName={data.tenant.name} events={data.events} basePath={basePath} />;
}

export function EventPage({ tenant, basePath, eventId }: { tenant: TenantRef; basePath: string; eventId: string }) {
  const api = useMemo(() => createApi(tenant), [tenant]);
  const { data, error } = useLoad<EventInfo>(() => api.event(eventId), [api, eventId]);
  if (error) return <main style={shell}><h1>No encontrado</h1><p>{error}</p></main>;
  if (!data) return <main style={shell}>Cargando…</main>;
  document.title = data.title;
  return (
    <TelonProvider api={api} event={data} basePath={basePath}>
      <PageRenderer source={data.page_tsx} />
    </TelonProvider>
  );
}

export function MyTickets(props: { tenant: TenantRef; basePath: string }) {
  const api = useMemo(() => createApi(props.tenant), [props.tenant]);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'tickets'>('email');
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function requestCode(e: FormEvent) {
    e?.preventDefault();
    try {
      setError(undefined);
      const result = await api.requestTicketAccess(email.trim());
      setNotice(result.message);
      setStep('code');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    try {
      setError(undefined);
      const result = await api.verifyTicketAccess(email.trim(), code.trim());
      setOrders(result.orders);
      setStep('tickets');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get('token');
    if (!token) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    api.ticketsFromLink(token).then(
      (result) => { setOrders(result.orders); setStep('tickets'); },
      (err: Error) => setError(err.message),
    );
  }, [api]);

  return (
    <main style={shell}>
      <p><a href={props.basePath || '/'}>← Volver</a></p>
      <h1>Mis entradas</h1>
      {step === 'email' && (
        <form onSubmit={requestCode} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <input aria-label="Email" type="email" required placeholder="tu@email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit">Enviar código</button>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={verifyCode} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <p>Introduce el código enviado a {email}.</p>
          <input aria-label="Código de validación" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          <button type="submit">Ver mis entradas</button>
          <button type="button" onClick={() => setStep('email')}>Cambiar correo</button>
        </form>
      )}
      {notice && step === 'code' && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {step === 'tickets' && orders.length === 0 && <p>No hay entradas pagadas asociadas a este correo.</p>}
      {step === 'tickets' && orders.map((o) => (
        <section key={o.id}>
          <h2>{o.event_title}</h2>
          <p>{formatDate(o.starts_at)} · {o.venue}</p>
          <p>Pedido {o.id} · {ORDER_STATUS[o.status] ?? o.status} · {formatEuros(o.total_cents)} (gastos {formatEuros(o.fee_cents)})</p>
          <div>
            {o.tickets.map((t) => {
              const label = t.seat_id ? `Butaca ${t.seat_id}` : `Pase ${t.pass_name}`;
              return t.qr_token ? (
                <TicketQR key={t.id} token={t.qr_token} label={label} filename={`${t.id}.png`} />
              ) : (
                <p key={t.id}>{label} · {t.id} · {TICKET_STATUS[t.status] ?? t.status}</p>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
