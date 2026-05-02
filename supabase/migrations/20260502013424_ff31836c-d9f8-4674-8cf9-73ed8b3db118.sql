-- 1. Enum tipo_rascunho
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tipo_rascunho') then
    create type public.tipo_rascunho as enum ('texto', 'checklist');
  end if;
end $$;

-- 2. Enum cor_rascunho
do $$ begin
  if not exists (select 1 from pg_type where typname = 'cor_rascunho') then
    create type public.cor_rascunho as enum (
      'cinza', 'verde', 'azul', 'amarelo', 'vermelho'
    );
  end if;
end $$;

-- 3. Tabela rascunhos
create table if not exists public.rascunhos (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles(id) on delete cascade,
  titulo text,
  tipo public.tipo_rascunho not null default 'texto',
  conteudo_texto text,
  cor public.cor_rascunho not null default 'cinza',
  fixada boolean not null default false,
  compartilhada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rascunhos_autor on public.rascunhos(autor_id);
create index if not exists idx_rascunhos_compartilhada on public.rascunhos(compartilhada) where compartilhada = true;

comment on table public.rascunhos is 
  'Notas estilo Keep — privadas por padrão, com opção de compartilhar com o time (somente leitura).';

-- 4. Trigger updated_at
drop trigger if exists trg_rascunhos_updated_at on public.rascunhos;
create trigger trg_rascunhos_updated_at
  before update on public.rascunhos
  for each row execute function public.set_updated_at();

-- 5. Tabela rascunho_checklist_itens
create table if not exists public.rascunho_checklist_itens (
  id uuid primary key default gen_random_uuid(),
  rascunho_id uuid not null references public.rascunhos(id) on delete cascade,
  ordem integer not null default 0,
  texto text not null,
  marcado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_rascunho_itens_rascunho 
  on public.rascunho_checklist_itens(rascunho_id, ordem);

comment on table public.rascunho_checklist_itens is 
  'Itens de checklist quando rascunho.tipo = checklist';

-- 6. RLS Rascunhos
alter table public.rascunhos enable row level security;

drop policy if exists rascunhos_select on public.rascunhos;
create policy rascunhos_select on public.rascunhos
for select using (
  autor_id = (select auth.uid())
  or compartilhada = true
);

drop policy if exists rascunhos_insert on public.rascunhos;
create policy rascunhos_insert on public.rascunhos
for insert with check (
  autor_id = (select auth.uid())
);

drop policy if exists rascunhos_update on public.rascunhos;
create policy rascunhos_update on public.rascunhos
for update using (
  autor_id = (select auth.uid())
);

drop policy if exists rascunhos_delete on public.rascunhos;
create policy rascunhos_delete on public.rascunhos
for delete using (
  autor_id = (select auth.uid())
);

-- 7. RLS Itens
alter table public.rascunho_checklist_itens enable row level security;

drop policy if exists rascunho_itens_select on public.rascunho_checklist_itens;
create policy rascunho_itens_select on public.rascunho_checklist_itens
for select using (
  exists (
    select 1 from public.rascunhos r
    where r.id = rascunho_checklist_itens.rascunho_id
    and (r.autor_id = (select auth.uid()) or r.compartilhada = true)
  )
);

drop policy if exists rascunho_itens_insert on public.rascunho_checklist_itens;
create policy rascunho_itens_insert on public.rascunho_checklist_itens
for insert with check (
  exists (
    select 1 from public.rascunhos r
    where r.id = rascunho_checklist_itens.rascunho_id
    and r.autor_id = (select auth.uid())
  )
);

drop policy if exists rascunho_itens_update on public.rascunho_checklist_itens;
create policy rascunho_itens_update on public.rascunho_checklist_itens
for update using (
  exists (
    select 1 from public.rascunhos r
    where r.id = rascunho_checklist_itens.rascunho_id
    and r.autor_id = (select auth.uid())
  )
);

drop policy if exists rascunho_itens_delete on public.rascunho_checklist_itens;
create policy rascunho_itens_delete on public.rascunho_checklist_itens
for delete using (
  exists (
    select 1 from public.rascunhos r
    where r.id = rascunho_checklist_itens.rascunho_id
    and r.autor_id = (select auth.uid())
  )
);

-- 8. RPC duplicar_rascunho
create or replace function public.duplicar_rascunho(p_rascunho_id uuid)
returns public.rascunhos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_origem public.rascunhos;
  v_novo public.rascunhos;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_origem from public.rascunhos 
  where id = p_rascunho_id
    and (autor_id = v_user_id or compartilhada = true);
  if not found then
    raise exception 'Rascunho não encontrado ou sem acesso';
  end if;

  insert into public.rascunhos (
    autor_id, titulo, tipo, conteudo_texto, cor, fixada, compartilhada
  ) values (
    v_user_id,
    coalesce(v_origem.titulo, '') || ' (cópia)',
    v_origem.tipo,
    v_origem.conteudo_texto,
    v_origem.cor,
    false,
    false
  ) returning * into v_novo;

  insert into public.rascunho_checklist_itens (
    rascunho_id, ordem, texto, marcado
  )
  select 
    v_novo.id, ordem, texto, marcado
  from public.rascunho_checklist_itens
  where rascunho_id = v_origem.id;

  return v_novo;
end;
$$;

comment on function public.duplicar_rascunho(uuid) is
  'Duplica rascunho próprio ou compartilhado, criando cópia privada do user logado.';