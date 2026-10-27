import { useState, type FormEvent } from 'react';
import { useCart, useTelon } from './context.js';
import { formatEuros } from './format.js';
import { accent, box, button, input, muted } from './styles.js';

/** Datos del comprador y pago (pasarela emulada). */
export function Checkout() {
  const { api, event, basePath, markSold } = useTelon();
  const cart = useCart();
  const [email, setEmail] = useState('');
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [state, setState] = useState<{ status: 'idle' | 'paying' | 'paid' | 'error'; message?: string; orderId?: string }>({
    status: 'idle',
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState({ status: 'paying' });
    try {
      const order = await api.createOrder(event.id, email, cart.lines.map((l) => l.item));
      await api.payOrder(order.id, card);
      cart.clear();
      markSold();
      setState({ status: 'paid', orderId: order.id });
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  }

  if (state.status === 'paid') {
    const url = `${basePath}/mis-entradas`;
    return (
      <div style={box} data-telon="checkout" role="status">
        <h3 style={{ marginTop: 0 }}>¡Listo! Pedido {state.orderId}</h3>
        <p>Te hemos enviado las entradas a {email}.</p>
        <a href={url} style={{ color: accent, fontWeight: 600 }}>Ver y descargar mis entradas</a>
      </div>
    );
  }

  return (
    <form style={box} onSubmit={submit} data-telon="checkout">
      <h3 style={{ marginTop: 0 }}>Pago</h3>
      <label>
        Email
        <input style={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Tarjeta
        <input style={input} required value={card} onChange={(e) => setCard(e.target.value)} />
      </label>
      <p style={muted}>Pasarela de pruebas: 4242… aprueba, 4000 0000 0000 0002 rechaza, 4000 0000 0000 9995 tarda.</p>
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      <button style={button} type="submit" disabled={cart.tickets === 0 || state.status === 'paying'}>
        {state.status === 'paying' ? 'Pagando…' : `Pagar ${formatEuros(cart.total_cents)}`}
      </button>
    </form>
  );
}
