import type { AnchorHTMLAttributes, ReactNode } from 'react';

type ArrowLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  variant?: 'solid' | 'text';
};

export function ArrowLink({ children, variant = 'text', className = '', ...props }: ArrowLinkProps) {
  return (
    <a className={`arrow-link arrow-link--${variant} ${className}`.trim()} {...props}>
      <span>{children}</span>
      <span className="arrow-link__arrow" aria-hidden="true">↗</span>
    </a>
  );
}