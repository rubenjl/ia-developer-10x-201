import type { ReactNode } from 'react';

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`section-label ${className}`.trim()}>{children}</p>;
}