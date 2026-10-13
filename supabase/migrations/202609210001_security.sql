-- Shared security state only: no tender text or company documents are stored here.
-- Apply schema/permissions/RPC together in a transaction; the server calls this RPC
-- with its secret key, while browser roles cannot access the private tables.
-- A migration is a versioned recipe for creating/changing database structure.
-- SQL is the database's language. A schema groups tables; a table stores rows;
-- a primary key uniquely identifies each row. timestamptz stores a timestamp.
-- BEGIN/COMMIT make this setup one transaction: it succeeds together or rolls back.
begin;
create schema if not exists tender_security_private;
revoke all on schema tender_security_private from public, anon, authenticated, service_role;

create table if not exists tender_security_private.limits (
  key text primary key, count integer not null, expires_at timestamptz not null
);
create table if not exists tender_security_private.sessions (
  key text primary key, created_at timestamptz not null, expires_at timestamptz not null
);
create table if not exists tender_security_private.leases (
  token uuid primary key, expires_at timestamptz not null
);
create table if not exists tender_security_private.audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default clock_timestamp(),
  request_id uuid not null, action text not null, outcome text not null,
  user_id uuid, tenant_id text
);
create index if not exists tender_security_audit_created on tender_security_private.audit(created_at);
-- Roles are permission groups. REVOKE removes access; GRANT allows a specific action.
-- Row level security adds row-access rules; here direct access is also revoked.
-- The app uses the narrow function below instead of reading/writing tables directly.
alter table tender_security_private.limits enable row level security;
alter table tender_security_private.sessions enable row level security;
alter table tender_security_private.leases enable row level security;
alter table tender_security_private.audit enable row level security;
revoke all on all tables in schema tender_security_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema tender_security_private from public, anon, authenticated, service_role;

-- Only the app server's secret key may call this narrow interface. No raw SQL,
-- document contents, audit reads/updates, or browser-accessible tables.
-- store.ts calls this function over Supabase's HTTP RPC endpoint. jsonb holds
-- JSON objects; payload->'field' reads JSON and payload->>'field' reads its text.
-- SECURITY DEFINER executes with the function owner's permissions. Since callers
-- lack table access, validate inputs and expose only the named operations here.
-- An empty search_path requires explicit schema names, avoiding ambiguous objects.
create or replace function public.tender_security(operation text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  bucket jsonb;
  bucket_key text;
  existing_count integer;
  session_created timestamptz;
begin
  -- The lock serializes limit checks and acquisitions across all instances.
  -- This transaction lock makes callers take turns updating shared counters/slots.
  -- Without it, simultaneous requests could both see one remaining slot and use it.
  perform pg_advisory_xact_lock(784120991);
  delete from tender_security_private.limits where expires_at <= v_now;
  delete from tender_security_private.sessions where expires_at <= v_now;
  delete from tender_security_private.leases where expires_at <= v_now;
  delete from tender_security_private.audit where id in (
    select id from tender_security_private.audit where created_at < v_now - interval '30 days' order by id limit 1000
  );
  if operation = 'cleanup' then return 'true'::jsonb;
  elsif operation = 'limit' then
    if jsonb_typeof(payload->'buckets') is distinct from 'array' or jsonb_array_length(payload->'buckets') not between 1 and 10 then raise exception 'Invalid buckets'; end if;
    -- Check all buckets before incrementing any, so denial spends no other quota.
    for bucket in select value from jsonb_array_elements(payload->'buckets') loop
      bucket_key := bucket->>'key';
      if bucket_key !~ '^[a-f0-9]{64}$' or (bucket->>'maximum')::integer not between 1 and 10000 or (bucket->>'seconds')::integer not between 1 and 86400 then raise exception 'Invalid limit'; end if;
      select count into existing_count from tender_security_private.limits where key=bucket_key;
      if coalesce(existing_count,0) >= (bucket->>'maximum')::integer then return 'false'::jsonb; end if;
    end loop;
    for bucket in select value from jsonb_array_elements(payload->'buckets') loop
      insert into tender_security_private.limits(key,count,expires_at)
        values(bucket->>'key',1,v_now+make_interval(secs=>(bucket->>'seconds')::integer))
        on conflict(key) do update set count=tender_security_private.limits.count+1;
    end loop;
    return 'true'::jsonb;
  elsif operation = 'audit' then
    if length(payload->>'action') not between 1 and 64 or length(payload->>'outcome') not between 1 and 64 then raise exception 'Invalid audit event'; end if;
    insert into tender_security_private.audit(request_id,action,outcome,user_id,tenant_id)
      values((payload->>'requestId')::uuid,payload->>'action',payload->>'outcome',(payload->>'userId')::uuid,payload->>'tenantId');
    return 'true'::jsonb;
  -- Four global slots bound concurrent work; expired leases are cleaned above.
  elsif operation = 'acquire' then
    if (select count(*) from tender_security_private.leases) >= 4 then return 'false'::jsonb; end if;
    insert into tender_security_private.leases values((payload->>'token')::uuid,v_now+interval '180 seconds');
    return 'true'::jsonb;
  elsif operation = 'release' then
    delete from tender_security_private.leases where token=(payload->>'token')::uuid;
    return 'true'::jsonb;
  -- Registration follows MFA. Checks renew idle expiry, capped at eight hours.
  elsif operation = 'session_register' then
    insert into tender_security_private.sessions values(payload->>'key',v_now,v_now+interval '15 minutes')
      on conflict(key) do update set created_at=excluded.created_at,expires_at=excluded.expires_at;
    return 'true'::jsonb;
  elsif operation = 'session_check' then
    select created_at into session_created from tender_security_private.sessions where key=payload->>'key';
    if session_created is null or session_created+interval '8 hours' <= v_now then
      delete from tender_security_private.sessions where key=payload->>'key';
      return 'false'::jsonb;
    end if;
    update tender_security_private.sessions set expires_at=least(v_now+interval '15 minutes',session_created+interval '8 hours') where key=payload->>'key';
    return 'true'::jsonb;
  elsif operation = 'session_revoke' then
    delete from tender_security_private.sessions where key=payload->>'key';
    return 'true'::jsonb;
  end if;
  raise exception 'Unknown operation';
end;
$$;
revoke all on function public.tender_security(text,jsonb) from public, anon, authenticated;
grant execute on function public.tender_security(text,jsonb) to service_role;
commit;
