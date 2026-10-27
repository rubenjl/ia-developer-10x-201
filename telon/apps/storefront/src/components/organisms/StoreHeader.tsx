import { ArrowLink } from '../atoms/ArrowLink.js';
import { BrandMark } from '../atoms/BrandMark.js';

function platformHomeHref() {
  if (window.location.hostname.endsWith('.localhost')) {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${window.location.protocol}//localhost${port}/`;
  }
  return '/';
}

function platformTicketsHref() {
  return `${platformHomeHref().replace(/\/$/, '')}/mis-entradas`;
}

export function StoreHeader({ tenantName, basePath }: { tenantName: string; basePath: string }) {
  return (
    <header className="store-header">
      <BrandMark href={platformHomeHref()} />
      <p className="store-header__tenant">Una sala de <strong>{tenantName}</strong></p>
      <nav className="store-header__nav" aria-label="Navegación principal">
        <a href={basePath || '/'}>Cartelera</a>
        <a href={platformHomeHref()}>Salas</a>
        <ArrowLink href={platformTicketsHref()} className="store-header__tickets">Mis entradas</ArrowLink>
      </nav>
    </header>
  );
}