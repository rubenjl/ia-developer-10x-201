function storefrontUrl(): string {
  if (process.env.STOREFRONT_URL) return process.env.STOREFRONT_URL;
  // En Codespaces el puerto 5173 se publica en una URL propia del codespace
  const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } = process.env;
  if (CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    return `https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  }
  return 'http://localhost:5173';
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://telon:telon@localhost:5432/telon',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  ticketsEmailFrom: process.env.TICKETS_EMAIL_FROM ?? 'entradas@telon.test',
  storefrontUrl: storefrontUrl(),
};
