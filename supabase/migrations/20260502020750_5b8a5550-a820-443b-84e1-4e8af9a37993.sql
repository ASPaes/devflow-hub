-- Tabela de compartilhamentos granulares
create table public.rascunho_compartilhamentos (
  id uuid primary key default gen_random_uuid(),
  rascunho_id uuid not null references public.rascunhos(id) on delete cascade,
  usuario_id uuid references public.profiles(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  -- Exatamente um alvo
  constraint rc_alvo_unico check (
    (usuario_id is not null and tenant_id is null) or
    (usuario_id is null and tenant_id is not null)
  )
);

create unique index rc_unq_user on public.rascunho_compartilhamentos(rascunho_id, usuario_id) where usuario_id is not null;
create unique index rc_unq_tenant on public.rascunho_compartilhamentos(rascunho_id, tenant_id) where tenant_id is not null;
create index rc_idx_rascunho on public.rascunho_compartilhamentos(rascunho_id);
create index rc_idx_usuario on public.rascunho_compartilhamentos(usuario_id) where usuario_id is not null;
create index rc_idx_tenant on public.rascunho_compartilhamentos(tenant_id) where tenant_id is not null;

alter table public.rascunho_compartilhamentos enable row level security;

-- Função: usuário tem acesso ao rascunho?
create or replace function public.rascunho_acessivel(p_rascunho_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.rascunhos r
    where r.id = p_rascunho_id
      and (
        r.autor_id = auth.uid()
        or r.compartilhada = true
        or exists(
          select 1 from public.rascunho_compartilhamentos rc
          where rc.rascunho_id = r.id
            and (
              rc.usuario_id = auth.uid()
              or rc.tenant_id = (select p.tenant_id from public.profiles p where p.id = auth.uid())
            )
        )
      )
  );
$$;

-- Função: usuário pode editar o rascunho? (autor OU qualquer destinatário com edição completa)
create or replace function public.rascunho_editavel(p_rascunho_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.rascunho_acessivel(p_rascunho_id);
$$;

-- Atualiza policies de rascunhos para usar acesso granular
drop policy if exists rascunhos_select on public.rascunhos;
drop policy if exists rascunhos_update on public.rascunhos;

create policy rascunhos_select on public.rascunhos
  for select
  using (public.rascunho_acessivel(id));

create policy rascunhos_update on public.rascunhos
  for update
  using (public.rascunho_acessivel(id));

-- Atualiza policies dos itens do checklist
drop policy if exists rascunho_itens_select on public.rascunho_checklist_itens;
drop policy if exists rascunho_itens_insert on public.rascunho_checklist_itens;
drop policy if exists rascunho_itens_update on public.rascunho_checklist_itens;
drop policy if exists rascunho_itens_delete on public.rascunho_checklist_itens;

create policy rascunho_itens_select on public.rascunho_checklist_itens
  for select using (public.rascunho_acessivel(rascunho_id));

create policy rascunho_itens_insert on public.rascunho_checklist_itens
  for insert with check (public.rascunho_acessivel(rascunho_id));

create policy rascunho_itens_update on public.rascunho_checklist_itens
  for update using (public.rascunho_acessivel(rascunho_id));

create policy rascunho_itens_delete on public.rascunho_checklist_itens
  for delete using (public.rascunho_acessivel(rascunho_id));

-- Policies da tabela de compartilhamentos: só o autor do rascunho gerencia
create policy rc_select on public.rascunho_compartilhamentos
  for select
  using (public.rascunho_acessivel(rascunho_id));

create policy rc_insert on public.rascunho_compartilhamentos
  for insert
  with check (
    created_by = auth.uid()
    and exists(select 1 from public.rascunhos r where r.id = rascunho_id and r.autor_id = auth.uid())
  );

create policy rc_delete on public.rascunho_compartilhamentos
  for delete
  using (exists(select 1 from public.rascunhos r where r.id = rascunho_id and r.autor_id = auth.uid()));