import { SectionLabel } from '../atoms/SectionLabel.js';
import { TenantCard, type TenantListing } from '../molecules/TenantCard.js';

export function TenantDirectory({ tenants, domainHref }: { tenants: TenantListing[]; domainHref: (domain: string) => string }) {
  return (
    <section className="tenant-directory" id="salas" aria-labelledby="tenant-directory-title">
      <div className="tenant-directory__heading">
        <div>
          <SectionLabel>Cartelera Telón</SectionLabel>
          <h2 id="tenant-directory-title">Encuentra tu <em>escena.</em></h2>
        </div>
        <span className="event-lineup__count">{String(tenants.length).padStart(2, '0')} SALAS</span>
      </div>
      {tenants.length > 0 ? (
        <div className="tenant-directory__list">
          {tenants.map((tenant, index) => <TenantCard key={tenant.slug} tenant={tenant} index={index + 1} domainHref={domainHref} />)}
        </div>
      ) : <p className="tenant-directory__empty">Pronto habrá nuevas salas en cartel.</p>}
    </section>
  );
}