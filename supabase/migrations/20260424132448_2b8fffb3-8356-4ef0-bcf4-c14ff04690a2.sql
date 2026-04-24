create or replace function public.set_perfil_padrao_novos_usuarios(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tem_permissao('gerenciar_perfis_acesso') then
    raise exception 'Sem permissão para alterar perfil padrão';
  end if;

  update public.perfis_acesso set perfil_padrao_novos_usuarios = false
   where perfil_padrao_novos_usuarios = true and id <> p_perfil_id;

  update public.perfis_acesso set perfil_padrao_novos_usuarios = true
   where id = p_perfil_id;
end;
$$;