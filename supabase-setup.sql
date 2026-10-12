-- Agenda OnCourt: rode tudo de uma vez no Supabase → SQL Editor → New query → Run.

-- 1) Tabela única onde a agenda guarda pendências, pastas, PIN e resumos
create table if not exists public.docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  ts bigint not null default 0,
  primary key (user_id, col, id)
);
alter table public.docs enable row level security;

drop policy if exists "docs_select" on public.docs;
drop policy if exists "docs_insert" on public.docs;
drop policy if exists "docs_update" on public.docs;
drop policy if exists "docs_delete" on public.docs;
create policy "docs_select" on public.docs for select to authenticated using (auth.uid() = user_id);
create policy "docs_insert" on public.docs for insert to authenticated with check (auth.uid() = user_id);
create policy "docs_update" on public.docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "docs_delete" on public.docs for delete to authenticated using (auth.uid() = user_id);

-- 2) Sincronização em tempo real entre celular e computador
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 3) Pasta privada para os arquivos (PDF, Word, Excel...), até 50 MB cada
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "arquivos_select" on storage.objects;
drop policy if exists "arquivos_insert" on storage.objects;
drop policy if exists "arquivos_update" on storage.objects;
drop policy if exists "arquivos_delete" on storage.objects;
create policy "arquivos_select" on storage.objects for select to authenticated using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_insert" on storage.objects for insert to authenticated with check (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_update" on storage.objects for update to authenticated using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos_delete" on storage.objects for delete to authenticated using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
