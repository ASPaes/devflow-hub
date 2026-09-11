-- Anexos da resposta do cliente por e-mail.
--
-- O leitor só guardava o texto. A imagem que o cliente cola no corpo do Gmail
-- chegava no text/plain como "[image: image.png]" e o arquivo era descartado
-- (DEM-0379, 10/09/2026). Agora o leitor sobe os anexos para o bucket
-- demanda-anexos e chama a RPC abaixo.

alter table public.demanda_comunicacoes
  add column if not exists anexos jsonb;

comment on column public.demanda_comunicacoes.anexos is
  'Arquivos que vieram na resposta do cliente: [{storage_path, nome_arquivo, mime_type, tamanho_bytes, inline}] no bucket demanda-anexos. Nulo na saída e em resposta sem anexo.';

-- Chamada só pelo leitor de IMAP, com service_role, depois do upload.
-- Idempotente: reprocessar a mesma mensagem regrava a lista e não duplica o
-- anexo da demanda (o caminho no storage é determinístico).
--
-- Resposta suspeita guarda os arquivos só na comunicação, igual ao texto: não
-- entram em Anexos da demanda.

create or replace function public.anexar_arquivos_resposta_cliente(
  p_comunicacao_id uuid,
  p_anexos jsonb
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_com record;
  v_autor uuid;
  v_item jsonb;
  v_inseridos integer := 0;
begin
  if jsonb_typeof(p_anexos) is distinct from 'array' then
    raise exception 'p_anexos precisa ser uma lista';
  end if;

  select c.id, c.demanda_id, c.direcao, c.status, c.remetente_email
    into v_com
  from public.demanda_comunicacoes c
  where c.id = p_comunicacao_id
  for update;

  if not found then
    raise exception 'Comunicação não encontrada: %', p_comunicacao_id;
  end if;
  if v_com.direcao <> 'entrada' then
    raise exception 'Só resposta do cliente recebe anexo por aqui';
  end if;

  update public.demanda_comunicacoes
     set anexos = p_anexos
   where id = p_comunicacao_id;

  if v_com.status <> 'recebido' then
    return 0;
  end if;

  -- Mesmo critério da registrar_resposta_cliente_demanda: quem respondeu é
  -- o autor do anexo.
  select p.id into v_autor
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(v_com.remetente_email)
  limit 1;

  if v_autor is null then
    return 0;
  end if;

  for v_item in select value from jsonb_array_elements(p_anexos) loop
    if not exists (
      select 1 from public.demanda_anexos a
      where a.storage_path = v_item->>'storage_path'
    ) then
      insert into public.demanda_anexos (
        demanda_id, autor_id, storage_path, nome_arquivo, mime_type, tamanho_bytes
      ) values (
        v_com.demanda_id,
        v_autor,
        v_item->>'storage_path',
        v_item->>'nome_arquivo',
        v_item->>'mime_type',
        (v_item->>'tamanho_bytes')::bigint
      );
      v_inseridos := v_inseridos + 1;
    end if;
  end loop;

  return v_inseridos;
end;
$$;

comment on function public.anexar_arquivos_resposta_cliente(uuid, jsonb) is
  'Amarra os anexos já enviados ao storage à resposta do cliente e, se ela é confiável, aos Anexos da demanda. Só service_role.';

-- Revogar de PUBLIC não basta: os default privileges dão EXECUTE a anon e
-- authenticated.
revoke execute on function public.anexar_arquivos_resposta_cliente(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.anexar_arquivos_resposta_cliente(uuid, jsonb)
  to service_role;
