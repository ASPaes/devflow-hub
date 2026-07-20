-- Adiciona a permissão de acionar o agente de correção.
-- Precisa ficar isolada: o valor só pode ser USADO (grant) numa migration seguinte.
ALTER TYPE public.app_permissao ADD VALUE IF NOT EXISTS 'acionar_agente_correcao';
