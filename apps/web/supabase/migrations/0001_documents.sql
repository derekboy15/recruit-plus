-- Recruit+ user documents (army lists, saved games, lesson progress).
-- Local-first: clients write to IndexedDB and sync here. Last write wins by updated_at.

create sequence if not exists public.documents_sync_seq;

create table if not exists public.documents (
  id          uuid primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('list', 'game', 'progress')),
  data        jsonb not null,
  updated_at  bigint not null,               -- client edit time, ms since epoch
  deleted     boolean not null default false,
  is_public   boolean not null default false,
  synced_seq  bigint not null default nextval('public.documents_sync_seq') -- server write order, used as the pull cursor
);

create index if not exists documents_owner_seq on public.documents (owner_id, synced_seq);

-- Keep the newer copy: ignore updates carrying an older updated_at; stamp accepted writes with a new sequence.
create or replace function public.documents_lww() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.synced_seq := nextval('public.documents_sync_seq');
  return new;
end;
$$;

drop trigger if exists documents_lww on public.documents;
create trigger documents_lww before insert or update on public.documents
for each row execute function public.documents_lww();

alter table public.documents enable row level security;

create policy "owners read their documents" on public.documents
  for select using (auth.uid() = owner_id);
create policy "anyone reads public documents" on public.documents
  for select using (is_public and not deleted);
create policy "owners insert their documents" on public.documents
  for insert with check (auth.uid() = owner_id);
create policy "owners update their documents" on public.documents
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners delete their documents" on public.documents
  for delete using (auth.uid() = owner_id);
