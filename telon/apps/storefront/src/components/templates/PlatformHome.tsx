import { SectionLabel } from '../atoms/SectionLabel.js';
import { PlatformHeader } from '../organisms/PlatformHeader.js';
import { TenantDirectory } from '../organisms/TenantDirectory.js';
import type { TenantListing } from '../molecules/TenantCard.js';

export function PlatformHome({ tenants, protocol, port }: { tenants: TenantListing[]; protocol: string; port: string }) {
  const domainHref = (domain: string) => `${protocol}//${domain}${port}/`;
  return (
    <div className="storefront platform-home">
      <PlatformHeader />
      <main>
        <section className="platform-hero" aria-labelledby="platform-title">
          <div className="platform-hero__copy">
            <SectionLabel>Telón · Un mundo en cada sala</SectionLabel>
            <h1 id="platform-title">La ciudad<br />se <em>levanta</em><br />el telón.</h1>
            <p>Conciertos, teatro y noches que merecen ser vividas. Encuentra tu próxima función.</p>
            <a className="arrow-link arrow-link--solid" href="#salas"><span>Explorar salas</span><span className="arrow-link__arrow" aria-hidden="true">↓</span></a>
          </div>
          <figure className="platform-hero__image">
            <img src="https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1500&q=85" alt="Público reunido para disfrutar de música en directo" fetchPriority="high" />
            <figcaption><span>ENCUENTRA TU<br />PRÓXIMO DIRECTO</span><span aria-hidden="true">✳</span></figcaption>
          </figure>
          <span className="platform-hero__side-note" aria-hidden="true">MÚSICA · TEATRO · ENCUENTROS</span>
        </section>
        <TenantDirectory tenants={tenants} domainHref={domainHref} />
      </main>
      <footer className="store-footer">
        <span>© {new Date().getFullYear()} Telón</span>
        <span>Nos vemos entre bambalinas <i aria-hidden="true">✳</i></span>
      </footer>
    </div>
  );
}