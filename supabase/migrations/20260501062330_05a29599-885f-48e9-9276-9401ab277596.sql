-- 1. Enum tipo_midia
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tipo_midia_retorno') then
    create type public.tipo_midia_retorno as enum ('imagem', 'video', 'audio');
  end if;
end $$;

-- 2. Tabela demanda_retornos
create table if not exists public.demanda_retornos (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  ordem integer not null default 0,
  texto text,
  midia_url text,
  midia_tipo public.tipo_midia_retorno,
  midia_nome_original text,
  midia_tamanho_bytes bigint,
  autor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demanda_retornos_texto_ou_midia check (
    (texto is not null and length(trim(texto)) > 0) 
    or (midia_url is not null and midia_tipo is not null)
  )
);

create index if not exists idx_demanda_retornos_demanda_ordem 
  on public.demanda_retornos(demanda_id, ordem, created_at);
create index if not exists idx_demanda_retornos_autor 
  on public.demanda_retornos(autor_id);

comment on table public.demanda_retornos is 
  'Timeline de entregas/retornos publicados para o cliente. Aba dedicada na tela da demanda.';

-- 3. Trigger updated_at
drop trigger if exists trg_demanda_retornos_updated_at on public.demanda_retornos;
create trigger trg_demanda_retornos_updated_at
  before update on public.demanda_retornos
  for each row execute function public.set_updated_at();

-- 4. RLS
alter table public.demanda_retornos enable row level security;

drop policy if exists demanda_retornos_select on public.demanda_retornos;
create policy demanda_retornos_select on public.demanda_retornos
for select using (
  exists (
    select 1 from public.demandas d
    where d.id = demanda_retornos.demanda_id
    and d.deleted_at is null
    and (
      (select public.tem_permissao('ver_demandas'))
      or (select public.tem_permissao('ver_todas_demandas'))
      or (d.solicitante_id = (select auth.uid()))
    )
  )
);

drop policy if exists demanda_retornos_insert on public.demanda_retornos;
create policy demanda_retornos_insert on public.demanda_retornos
for insert with check (
  (select public.tem_permissao('criar_retorno_demanda'))
);

drop policy if exists demanda_retornos_update on public.demanda_retornos;
create policy demanda_retornos_update on public.demanda_retornos
for update using (
  (select public.tem_permissao('criar_retorno_demanda'))
);

drop policy if exists demanda_retornos_delete on public.demanda_retornos;
create policy demanda_retornos_delete on public.demanda_retornos
for delete using (
  (select public.tem_permissao('criar_retorno_demanda'))
);

-- 5. Marcar permissão pro perfil Desenvolvedor
update public.perfis_acesso
  set permissoes = array_append(permissoes, 'criar_retorno_demanda'::public.app_permissao)
  where nome = 'Desenvolvedor'
    and not ('criar_retorno_demanda' = any(permissoes));

-- 6. Bucket Storage demanda-retornos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'demanda-retornos',
  'demanda-retornos',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- 7. Storage policies
drop policy if exists demanda_retornos_storage_select on storage.objects;
create policy demanda_retornos_storage_select on storage.objects
for select using (
  bucket_id = 'demanda-retornos'
  and exists (
    select 1 from public.demandas d
    where d.id::text = replace(split_part(name, '/', 1), 'demanda-', '')
      and d.deleted_at is null
      and (
        (select public.tem_permissao('ver_demandas'))
        or (select public.tem_permissao('ver_todas_demandas'))
        or (d.solicitante_id = (select auth.uid()))
      )
  )
);

drop policy if exists demanda_retornos_storage_insert on storage.objects;
create policy demanda_retornos_storage_insert on storage.objects
for insert with check (
  bucket_id = 'demanda-retornos'
  and (select public.tem_permissao('criar_retorno_demanda'))
);

drop policy if exists demanda_retornos_storage_update on storage.objects;
create policy demanda_retornos_storage_update on storage.objects
for update using (
  bucket_id = 'demanda-retornos'
  and (select public.tem_permissao('criar_retorno_demanda'))
);

drop policy if exists demanda_retornos_storage_delete on storage.objects;
create policy demanda_retornos_storage_delete on storage.objects
for delete using (
  bucket_id = 'demanda-retornos'
  and (select public.tem_permissao('criar_retorno_demanda'))
);

-- 8. RPC excluir_retorno
create or replace function public.excluir_retorno_demanda(p_retorno_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_retorno public.demanda_retornos;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if not public.tem_permissao('criar_retorno_demanda') then
    raise exception 'Sem permissão para excluir retorno';
  end if;
  select * into v_retorno from public.demanda_retornos where id = p_retorno_id;
  if not found then
    raise exception 'Retorno não encontrado';
  end if;
  if v_retorno.midia_url is not null then
    delete from storage.objects 
    where bucket_id = 'demanda-retornos' 
      and name = v_retorno.midia_url;
  end if;
  delete from public.demanda_retornos where id = p_retorno_id;
end;
$function$;

comment on function public.excluir_retorno_demanda(uuid) is
  'Hard delete de retorno: apaga registro + arquivo no Storage. Requer criar_retorno_demanda.';