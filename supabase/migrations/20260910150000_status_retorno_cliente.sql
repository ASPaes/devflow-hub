-- Status novo "Retorno do Cliente": a demanda para onde a resposta do cliente
-- por e-mail leva (ver 20260910150100).
--
-- Arquivo separado de propósito: valor novo de enum não pode ser usado na
-- mesma transação que o criou.

alter type public.status_demanda add value if not exists 'retorno_cliente' after 'aguardando_cliente';
