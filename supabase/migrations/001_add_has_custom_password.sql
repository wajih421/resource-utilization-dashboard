-- Adds a flag so the login flow knows whether a resource has set their
-- own password yet, or should still be allowed to log in with just their
-- Employee ID (no password).

alter table profiles
  add column if not exists has_custom_password boolean not null default false;