import { ArrowLink } from '../atoms/ArrowLink.js';

export type TenantListing = { slug: string; name: string; domains: string[] };

export function TenantCard({ tenant, index, domainHref }: { tenant: TenantListing; index: number; domainHref: (domain: string) => string }) {
  return (
    <article className="tenant-card">
      <span className="tenant-card__number">{String(index).padStart(2, '0')}</span>
      <div className="tenant-card__details">
        <h3>{tenant.name}</h3>
        <span className="tenant-card__slug">/{tenant.slug}</span>
        {tenant.domains.length > 0 && (
          <div className="tenant-card__domains">
            {tenant.domains.map((domain) => <a key={domain} href={domainHref(domain)}>{domain}</a>)}
          </div>
        )}
      </div>
      <ArrowLink href={`/t/${tenant.slug}`} aria-label={`Entrar en ${tenant.name}`}>Entrar en la sala</ArrowLink>
    </article>
  );
}