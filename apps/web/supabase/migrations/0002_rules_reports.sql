-- Rules error reports are user documents of kind 'report' (local-first, synced like lists).
-- The maintainer reads them through public.rules_reports with the service role; users only ever see their own (RLS).

alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check check (kind in ('list', 'game', 'progress', 'report'));

create or replace view public.rules_reports with (security_invoker = true) as
  select id, owner_id, data, updated_at
  from public.documents
  where kind = 'report' and not deleted;
