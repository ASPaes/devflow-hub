import * as React from "react";
import { Building2, Check, Globe, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  useAdicionarCompartilhamento,
  useAtualizarRascunho,
  useRemoverCompartilhamento,
} from "@/hooks/useRascunhos";
import { cn } from "@/lib/utils";
import type { RascunhoComItens } from "@/types/rascunho";

export function CompartilharDialog({
  rascunho,
  open,
  onOpenChange,
}: {
  rascunho: RascunhoComItens;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const atualizar = useAtualizarRascunho();
  const adicionar = useAdicionarCompartilhamento();
  const remover = useRemoverCompartilhamento();

  const usuariosCompartilhados = new Set(
    rascunho.compartilhamentos
      .filter((c) => c.usuario_id)
      .map((c) => c.usuario_id as string),
  );
  const tenantsCompartilhados = new Set(
    rascunho.compartilhamentos
      .filter((c) => c.tenant_id)
      .map((c) => c.tenant_id as string),
  );

  const usuariosQuery = useQuery({
    queryKey: ["rascunho-share-usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, tenant_id, tenants(nome)")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []).filter((u: any) => u.id !== user?.id);
    },
    enabled: open,
  });

  const tenantsQuery = useQuery({
    queryKey: ["rascunho-share-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const removerPorAlvo = (
    tipo: "usuario" | "tenant",
    alvoId: string,
  ) => {
    const c = rascunho.compartilhamentos.find((x) =>
      tipo === "usuario" ? x.usuario_id === alvoId : x.tenant_id === alvoId,
    );
    if (c) remover.mutate({ id: c.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar rascunho</DialogTitle>
          <DialogDescription>
            Quem tiver acesso pode editar (exceto excluir).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="text-sm font-medium">Todos do time</Label>
              <p className="text-xs text-muted-foreground">
                Qualquer pessoa logada vê e edita.
              </p>
            </div>
          </div>
          <Switch
            checked={rascunho.compartilhada}
            onCheckedChange={(v) =>
              atualizar.mutate({
                id: rascunho.id,
                patch: { compartilhada: v },
              })
            }
          />
        </div>

        {rascunho.compartilhamentos.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Acessos específicos
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {rascunho.compartilhamentos.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs"
                >
                  {c.usuario_id ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Building2 className="h-3 w-3" />
                  )}
                  {c.usuario_nome ?? c.tenant_nome ?? "—"}
                  <button
                    type="button"
                    onClick={() => remover.mutate({ id: c.id })}
                    className="ml-0.5 text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="usuarios">
          <TabsList className="w-full">
            <TabsTrigger value="usuarios" className="flex-1">
              <User className="mr-1.5 h-3.5 w-3.5" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="empresas" className="flex-1">
              <Building2 className="mr-1.5 h-3.5 w-3.5" /> Empresas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-3">
            <Command className="rounded-md border">
              <CommandInput placeholder="Buscar usuário..." />
              <CommandList>
                <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                <CommandGroup>
                  {(usuariosQuery.data ?? []).map((u: any) => {
                    const ja = usuariosCompartilhados.has(u.id);
                    return (
                      <CommandItem
                        key={u.id}
                        value={`${u.nome} ${u.tenants?.nome ?? ""}`}
                        onSelect={() => {
                          if (ja) removerPorAlvo("usuario", u.id);
                          else
                            adicionar.mutate({
                              rascunhoId: rascunho.id,
                              usuarioId: u.id,
                            });
                        }}
                      >
                        <div className="flex flex-1 items-center gap-2">
                          <div className="flex flex-col">
                            <span className="text-sm">{u.nome}</span>
                            {u.tenants?.nome && (
                              <span className="text-xs text-muted-foreground">
                                {u.tenants.nome}
                              </span>
                            )}
                          </div>
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4",
                            ja ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>

          <TabsContent value="empresas" className="mt-3">
            <Command className="rounded-md border">
              <CommandInput placeholder="Buscar empresa..." />
              <CommandList>
                <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                <CommandGroup>
                  {(tenantsQuery.data ?? []).map((t: any) => {
                    const ja = tenantsCompartilhados.has(t.id);
                    return (
                      <CommandItem
                        key={t.id}
                        value={t.nome}
                        onSelect={() => {
                          if (ja) removerPorAlvo("tenant", t.id);
                          else
                            adicionar.mutate({
                              rascunhoId: rascunho.id,
                              tenantId: t.id,
                            });
                        }}
                      >
                        <span className="flex-1 text-sm">{t.nome}</span>
                        <Check
                          className={cn(
                            "h-4 w-4",
                            ja ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
