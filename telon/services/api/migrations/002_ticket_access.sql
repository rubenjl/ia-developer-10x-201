CREATE TABLE ticket_access (
  tenant_id    text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        text NOT NULL,
  code_hash    text NOT NULL,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  code_used_at timestamptz,
  PRIMARY KEY (tenant_id, email)
);

CREATE INDEX ticket_access_token_hash ON ticket_access (token_hash);