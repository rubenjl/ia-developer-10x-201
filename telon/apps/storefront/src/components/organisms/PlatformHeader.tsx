import { ArrowLink } from '../atoms/ArrowLink.js';
import { BrandMark } from '../atoms/BrandMark.js';

export function PlatformHeader() {
  return (
    <header className="store-header platform-header">
      <BrandMark href="/" />
      <p className="store-header__tenant">El escenario está <strong>en todas partes</strong></p>
      <nav className="store-header__nav" aria-label="Navegación principal">
        <a href="#salas">Las salas</a>
        <ArrowLink href="#salas" className="store-header__tickets">Ver cartelera</ArrowLink>
      </nav>
    </header>
  );
}