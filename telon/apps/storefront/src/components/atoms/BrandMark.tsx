export function BrandMark({ href }: { href: string }) {
  return (
    <a className="brand-mark" href={href} aria-label="Telón, inicio">
      <span className="brand-mark__glyph" aria-hidden="true"><span /></span>
      <span>telón</span>
    </a>
  );
}