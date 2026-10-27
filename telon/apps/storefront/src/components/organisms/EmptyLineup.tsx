import { SectionLabel } from '../atoms/SectionLabel.js';

export function EmptyLineup() {
  return (
    <section className="empty-lineup">
      <SectionLabel>Estamos preparando algo</SectionLabel>
      <h1>El escenario está<br /><em>a punto de abrir.</em></h1>
      <p>Vuelve pronto para descubrir la próxima función.</p>
      <span className="empty-lineup__curtain" aria-hidden="true">✳</span>
    </section>
  );
}