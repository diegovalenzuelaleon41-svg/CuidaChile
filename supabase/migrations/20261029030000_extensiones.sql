-- ════════════════════════════════════════════════════════════════════════
-- CuidaChile — Extensiones de Postgres
--
-- · Estas extensiones se habilitaron desde el dashboard de Supabase y no
--   estaban registradas en ninguna migración. Se declaran aquí para que un
--   entorno nuevo (stack local o branch) quede igual al proyecto remoto.
-- · supabase_vault, pg_stat_statements y plpgsql vienen por defecto en
--   Supabase y no se declaran.
--
-- Idempotente: se puede ejecutar más de una vez sin romper nada.
-- ════════════════════════════════════════════════════════════════════════

create schema if not exists extensions;

create extension if not exists "uuid-ossp"  with schema extensions;
create extension if not exists pgcrypto     with schema extensions;
create extension if not exists citext       with schema extensions;
create extension if not exists pg_trgm      with schema extensions;
create extension if not exists btree_gist   with schema extensions;
create extension if not exists moddatetime  with schema extensions;
create extension if not exists postgis      with schema extensions;
