import type { TenantRef } from '@telon/ui';

export type Route =
  | { page: 'portal' }
  | { page: 'home'; tenant: TenantRef; basePath: string }
  | { page: 'event'; tenant: TenantRef; basePath: string; eventId: string }
  | { page: 'tickets'; tenant?: TenantRef; basePath: string }
  | { page: 'not-found'; tenant: TenantRef; basePath: string };

// Hosts que son de Telón y no de un promotor: aquí el promotor va en la ruta (/t/<slug>).
function isPlatformHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.app.github.dev');
}

export function resolveRoute(loc: { hostname: string; pathname: string; search: string }): Route {
  let path = loc.pathname.replace(/\/+$/, '') || '/';
  let tenant: TenantRef;
  let basePath = '';

  const bySlug = path.match(/^\/t\/([a-z0-9-]+)(\/.*)?$/);
  if (bySlug) {
    tenant = { slug: bySlug[1]! };
    basePath = `/t/${bySlug[1]}`;
    path = bySlug[2] ?? '/';
  } else if (path === '/mis-entradas') {
    return { page: 'tickets', basePath: '' };
  } else if (isPlatformHost(loc.hostname)) {
    return { page: 'portal' };
  } else {
    tenant = { host: loc.hostname };
  }

  if (path === '/') return { page: 'home', tenant, basePath };
  const ev = path.match(/^\/e\/([A-Za-z0-9-]+)$/);
  if (ev) return { page: 'event', tenant, basePath, eventId: ev[1]! };
  if (path === '/mis-entradas') return { page: 'tickets', basePath: '' };
  return { page: 'not-found', tenant, basePath };
}
