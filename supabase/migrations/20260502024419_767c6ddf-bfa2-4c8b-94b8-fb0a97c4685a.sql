drop policy if exists rascunhos_select on public.rascunhos;
drop policy if exists rascunhos_update on public.rascunhos;

create policy rascunhos_select on public.rascunhos
  for select
  using (
    autor_id = auth.uid()
    or compartilhada = true
    or exists (
      select 1
      from public.rascunho_compartilhamentos rc
      where rc.rascunho_id = id
        and (
          rc.usuario_id = auth.uid()
          or rc.tenant_id = (
            select p.tenant_id
            from public.profiles p
            where p.id = auth.uid()
          )
        )
    )
  );

create policy rascunhos_update on public.rascunhos
  for update
  using (
    autor_id = auth.uid()
    or compartilhada = true
    or exists (
      select 1
      from public.rascunho_compartilhamentos rc
      where rc.rascunho_id = id
        and (
          rc.usuario_id = auth.uid()
          or rc.tenant_id = (
            select p.tenant_id
            from public.profiles p
            where p.id = auth.uid()
          )
        )
    )
  )
  with check (
    autor_id = auth.uid()
    or compartilhada = true
    or exists (
      select 1
      from public.rascunho_compartilhamentos rc
      where rc.rascunho_id = id
        and (
          rc.usuario_id = auth.uid()
          or rc.tenant_id = (
            select p.tenant_id
            from public.profiles p
            where p.id = auth.uid()
          )
        )
    )
  );