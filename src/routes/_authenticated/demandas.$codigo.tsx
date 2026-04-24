import * as React from "react";
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { ChevronLeft, FileQuestion, Link as LinkIcon, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { formatRelativeSP } from "@/lib/format";
import {
  TIPO_DEMANDA_LABEL,
  useDemanda,
  useDemandaAnexos,
  useUpdateDemanda,
  type UpdateDemandaPatch,
} from "@/hooks/useDemandas";
import { EditableField } from "@/components/demandas/EditableField";
import { AnexosSecao } from "@/components/demandas/AnexosSecao";
import { ComentariosSecao } from "@/components/demandas/ComentariosSecao";
import { TimelineHistorico } from "@/components/demandas/TimelineHistorico";
import { VinculosSecao } from "@/components/demandas/VinculosSecao";
import { useComentarios } from "@/hooks/useComentarios";
import { useVinculos } from "@/hooks/useVinculos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MetadataSidebar,
  SolicitanteSummary,
  StatusBadge,
  TipoBadge,
} from "@/components/demandas/MetadataSidebar";

export const Route = createFileRoute("/_authenticated/demandas/$codigo")({
  component: DemandaDetalhe,
  notFoundComponent: DemandaNaoEncontrada,
});

function DemandaDetalhe() {
  const { codigo } = Route.useParams();
  const { user } = useAuth();
  const { temPermissao } = useProfile();
  const { data: demanda, isLoading, error } = useDemanda(codigo);
  const updateMutation = useUpdateDemanda();

  if (isLoading) return <DetalheSkeleton />;
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Não foi possível carregar a demanda. Tente novamente.
      </div>
    );
  }
  if (!demanda) {
    throw notFound();
  }

  const isOwner = demanda.solicitante_id === user?.id;
  const canEditAny = temPermissao("editar_qualquer_demanda");
  const canEditOwnTriagem = isOwner && demanda.status === "triagem";
  const canEditTextual = canEditAny || canEditOwnTriagem;
  const canEditMetadata = canEditAny;
  const canChangeStatus = canEditAny;

  const handlePatch = async (patch: UpdateDemandaPatch) => {
    await updateMutation.mutateAsync({ id: demanda.id, patch });
    if ("status" in patch) toast.success("Status alterado");
    else toast.success("Atualizado");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb codigo={demanda.codigo ?? codigo} />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {demanda.codigo}
              </span>
              <TipoBadge>{TIPO_DEMANDA_LABEL[demanda.tipo]}</TipoBadge>
              <StatusBadge status={demanda.status} />
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void copyLink()}>
                      <LinkIcon className="mr-2 h-3.5 w-3.5" />
                      Copiar link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <EditableField
              value={demanda.titulo}
              disabled={!canEditTextual || updateMutation.isPending}
              minLength={5}
              maxLength={200}
              ariaLabel="Título da demanda"
              className="text-2xl font-semibold text-foreground"
              onSave={(v) => handlePatch({ titulo: v })}
            />

            <p className="text-sm text-muted-foreground">
              Aberto por <SolicitanteSummary solicitante={demanda.solicitante} />{" "}
              {formatRelativeSP(demanda.created_at)}
            </p>
          </div>

          {/* Descrição */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <EditableField
                value={demanda.descricao}
                multiline
                disabled={!canEditTextual || updateMutation.isPending}
                minLength={10}
                placeholder="Sem descrição"
                ariaLabel="Descrição da demanda"
                onSave={(v) => handlePatch({ descricao: v })}
              />
            </CardContent>
          </Card>

          {/* Anexos */}
          {user && (
            <AnexosSecao
              demandaId={demanda.id}
              userId={user.id}
              podeRemoverDeOutros={canEditAny}
            />
          )}

          {/* Tabs: Comentários | Histórico | Vínculos */}
          <DetalheTabs
            demandaId={demanda.id}
            podeAdicionarVinculo={canEditAny || canEditOwnTriagem}
            podeRemoverVinculo={canEditAny}
          />
        </div>

        <MetadataSidebar
          demanda={demanda}
          canEdit={canEditMetadata}
          canChangeStatus={canChangeStatus}
          onPatch={handlePatch}
          saving={updateMutation.isPending}
        />
      </div>
    </div>
  );
}

function Breadcrumb({ codigo }: { codigo: string }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        to="/demandas"
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Demandas
      </Link>
      <span>/</span>
      <span className="font-mono text-foreground">{codigo}</span>
    </nav>
  );
}

function DetalheSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-48" />
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DemandaNaoEncontrada() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
      <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold text-foreground">
        Demanda não encontrada
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Pode ter sido excluída ou você não tem permissão pra visualizá-la.
      </p>
      <Button asChild className="mt-4">
        <Link to="/demandas">Voltar para lista</Link>
      </Button>
    </div>
  );
}

interface DetalheTabsProps {
  demandaId: string;
  podeAdicionarVinculo: boolean;
  podeRemoverVinculo: boolean;
}

function DetalheTabs({
  demandaId,
  podeAdicionarVinculo,
  podeRemoverVinculo,
}: DetalheTabsProps) {
  const { data: comentarios = [] } = useComentarios(demandaId);
  const { data: vinculos = [] } = useVinculos(demandaId);

  return (
    <Tabs defaultValue="comentarios" className="w-full">
      <TabsList>
        <TabsTrigger value="comentarios">
          Comentários
          {comentarios.length > 0 && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {comentarios.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="vinculos">
          Vínculos
          {vinculos.length > 0 && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {vinculos.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="comentarios" className="mt-4">
        <ComentariosSecao demandaId={demandaId} />
      </TabsContent>
      <TabsContent value="historico" className="mt-4 rounded-lg border border-border bg-card p-6">
        <TimelineHistorico demandaId={demandaId} />
      </TabsContent>
      <TabsContent value="vinculos" className="mt-4 rounded-lg border border-border bg-card p-6">
        <VinculosSecao
          demandaId={demandaId}
          podeAdicionar={podeAdicionarVinculo}
          podeRemover={podeRemoverVinculo}
        />
      </TabsContent>
    </Tabs>
  );
}
