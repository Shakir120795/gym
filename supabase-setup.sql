-- Run this once in Supabase: SQL Editor > New query > paste > Run

create table if not exists public.records (
  kind text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

create index if not exists records_updated_at_idx on public.records (updated_at);

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_updated_at();

-- Only signed-in users (your owner account) can read or write.
alter table public.records enable row level security;

drop policy if exists "signed in users only" on public.records;
create policy "signed in users only" on public.records
  for all to authenticated using (true) with check (true);
