import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AppPermissao } from "@/hooks/useProfile";

type Group = {
  label: string;
  items: Array<{ key: AppPermissao; label: string; description: string }>;
};

const GROUPS: Group[] = [
  {
    label: "Demandas",
    items: [
      {
        key: "criar_demanda",
        label: "Criar demanda",
        description: "Abrir novas demandas",
      },
      {
        key: "ver_demandas",
        label: "Ver demandas",
        description: "Ver demandas próprias",
      },
      {
        key: "ver_todas_demandas",
        label: "Ver todas as demandas",
        description: "Ver demandas de outros usuários",
      },
      {
        key: "comentar_demanda",
        label: "Comentar e anexar",
        description: "Adicionar comentários e anexos a demandas",
      },
      {
        key: "editar_qualquer_demanda",
        label: "Editar qualquer demanda",
        description:
          "Mudar status, classificação, datas e demais campos de qualquer demanda",
      },
      {
        key: "deletar_demanda",
        label: "Excluir demandas",
        description: "Remover demandas do sistema (use com cuidado)",
      },
      {
        key: "pode_ser_responsavel",
        label: "Pode ser responsável",
        description:
          "Pode ser atribuído como responsável de uma demanda (devs e atribuíveis)",
      },
      {
        key: "alterar_produto_demanda",
        label: "Alterar produto da demanda",
        description:
          "Pode trocar o produto-alvo (DoctorSaaS, DoctorDev etc.) de uma demanda existente",
      },
      {
        key: "inserir_tempo_manual",
        label: "Inserir tempo manualmente",
        description:
          "Pode adicionar, editar e excluir lançamentos manuais de tempo no histórico do timer",
      },
      {
        key: "criar_retorno_demanda",
        label: "Publicar retornos",
        description:
          "Pode criar, editar e excluir retornos (entregas com texto, imagem, vídeo ou áudio) na aba Retornos da demanda",
      },
    ],
  },
  {
    label: "Catálogo",
    items: [
      {
        key: "gerenciar_modulos",
        label: "Gerenciar módulos",
        description: "CRUD de módulos",
      },
      {
        key: "gerenciar_submodulos",
        label: "Gerenciar submódulos",
        description: "CRUD de submódulos",
      },
      {
        key: "gerenciar_areas",
        label: "Gerenciar áreas",
        description: "CRUD de áreas solicitantes",
      },
    ],
  },
  {
    label: "Usuários e acesso",
    items: [
      {
        key: "gerenciar_usuarios",
        label: "Gerenciar usuários",
        description:
          "Convidar, alterar perfil e ativar/desativar usuários",
      },
      {
        key: "gerenciar_perfis_acesso",
        label: "Gerenciar perfis de acesso",
        description: "Criar e editar perfis de permissão",
      },
      {
        key: "gerenciar_tenants",
        label: "Gerenciar tenants",
        description: "CRUD de empresas/clientes do devflow-hub",
      },
    ],
  },
  {
    label: "Métricas",
    items: [
      {
        key: "ver_dashboard_metricas",
        label: "Ver dashboard de métricas",
        description: "Acesso aos KPIs agregados",
      },
    ],
  },
];

interface Props {
  value: AppPermissao[];
  onChange: (next: AppPermissao[]) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function PermissoesCheckboxGroup({
  value,
  onChange,
  disabled,
  disabledReason,
}: Props) {
  const toggle = React.useCallback(
    (perm: AppPermissao, checked: boolean) => {
      if (checked) {
        if (!value.includes(perm)) onChange([...value, perm]);
      } else {
        onChange(value.filter((p) => p !== perm));
      }
    },
    [value, onChange],
  );

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => (
        <fieldset
          key={group.label}
          className="rounded-lg border border-border p-3"
        >
          <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </legend>
          <div className="space-y-3 pt-1">
            {group.items.map((item) => {
              const checked = value.includes(item.key);
              const row = (
                <label
                  key={item.key}
                  className={cn(
                    "flex items-start gap-3 rounded-md p-2 transition-colors",
                    !disabled && "hover:bg-muted/40 cursor-pointer",
                    disabled && "opacity-70 cursor-not-allowed",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(c) => toggle(item.key, !!c)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </label>
              );
              if (disabled && disabledReason) {
                return (
                  <Tooltip key={item.key}>
                    <TooltipTrigger asChild>
                      <div>{row}</div>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {disabledReason}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return row;
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
