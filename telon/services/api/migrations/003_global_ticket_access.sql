CREATE TABLE global_ticket_access (
  email        text PRIMARY KEY,
  code_hash    text NOT NULL,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  code_used_at timestamptz
);

CREATE INDEX global_ticket_access_token_hash ON global_ticket_access (token_hash);