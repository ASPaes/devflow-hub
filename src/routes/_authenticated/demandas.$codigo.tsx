import * as React from "react";
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronUp, FileQuestion, Link as LinkIcon, MoreHorizontal, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  useUpdateDemanda,
  type UpdateDemandaPatch,
} from "@/hooks/useDemandas";
import { EditableField } from "@/components/demandas/EditableField";
import { AnexosSecao } from "@/components/demandas/AnexosSecao";
import { ComentariosSecao } from "@/components/demandas/ComentariosSecao";
import { TimelineHistorico } from "@/components/demandas/TimelineHistorico";
import { VinculosSecao } from "@/components/demandas/VinculosSecao";
import { ReaberturaBanner } from "@/components/demandas/ReaberturaBanner";
import { ReabrirDemandaButton } from "@/components/demandas/ReabrirDemandaButton";
import { DemandaReabertaBadge } from "@/components/demandas/DemandaReabertaBadge";
import { RetornosTab } from "@/components/demandas/RetornosTab";
import { useComentarios } from "@/hooks/useComentarios";
import { useVinculos } from "@/hooks/useVinculos";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MetadataSidebar,
  SolicitanteSummary,
  StatusBadge,
  TipoBadge,
} from "@/components/demandas/MetadataSidebar";
import { ExcluirDemandaDialog } from "@/components/demandas/ExcluirDemandaDialog";
import { GerarPromptIADialog } from "@/components/demandas/GerarPromptIADialog";
import { IncluirReleaseDialog } from "@/components/demandas/IncluirReleaseDialog";
import { ReleaseTab } from "@/components/demandas/ReleaseTab";
import { useReleaseDaDemanda } from "@/hooks/useReleases";

type DemandaSearch = {
  tab?: string;
  tituloIA?: string;
  resumoIA?: string;
};

export const Route = createFileRoute("/_authenticated/demandas/$codigo")({
  component: DemandaDetalhe,
  notFoundComponent: DemandaNaoEncontrada,
  validateSearch: (s: Record<string, unknown>): DemandaSearch => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    tituloIA: typeof s.tituloIA === "string" ? s.tituloIA : undefined,
    resumoIA: typeof s.resumoIA === "string" ? s.resumoIA : undefined,
  }),
});

function DemandaDetalhe() {
  const { codigo } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();
  const { temPermissao } = useProfile();
  const { data: demanda, isLoading, error } = useDemanda(codigo);
  const updateMutation = useUpdateDemanda();
  const [excluirOpen, setExcluirOpen] = React.useState(false);
  const [iaDialogOpen, setIaDialogOpen] = React.useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = React.useState(false);
  const { data: releaseDaDemanda } = useReleaseDaDemanda(demanda?.id);

  useDocumentTitle(
    demanda ? `${demanda.codigo ?? codigo} · ${demanda.titulo}` : codigo,
  );

  const canEditAny = temPermissao("editar_qualquer_demanda");

  // Detecta TRANSIÇÃO de status para "entregue" e abre o dialog 1x.
  // Ignora carregamento inicial (statusAnterior === undefined) — não reabre
  // quando o usuário só está visualizando uma demanda já entregue.
  const statusAnteriorRef = React.useRef<string | undefined>(undefined);
  const statusAtual = demanda?.status;
  const incluirRelease = demanda?.incluir_release;
  React.useEffect(() => {
    const statusAnterior = statusAnteriorRef.current;
    if (
      statusAnterior !== undefined &&
      statusAnterior !== "entregue" &&
      statusAtual === "entregue" &&
      canEditAny &&
      !incluirRelease &&
      !releaseDaDemanda
    ) {
      setReleaseDialogOpen(true);
    }
    statusAnteriorRef.current = statusAtual;
  }, [statusAtual, incluirRelease, canEditAny, releaseDaDemanda]);

  // Auto-scroll até a aba Releases quando chega via fluxo do Kanban (com IA preenchida)
  // Flag persiste ao consume dos search params pelo ReleaseTab no mount.
  const shouldScrollRef = React.useRef(false);

  React.useEffect(() => {
    if (search.tab === "releases" && (search.tituloIA || search.resumoIA)) {
      shouldScrollRef.current = true;
      console.log("[ReleaseFlow] 7a. flag de scroll setada");
    }
  }, [search.tab, search.tituloIA, search.resumoIA]);

  React.useEffect(() => {
    if (!shouldScrollRef.current) return;
    if (search.tab !== "releases") return;

    let tries = 0;
    const maxTries = 30;

    const tryScroll = () => {
      const el = document.getElementById("release-tab-section");
      if (el) {
        console.log("[ReleaseFlow] 7b. scrollando agora");
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        shouldScrollRef.current = false;
        return;
      }
      tries++;
      if (tries < maxTries) {
        requestAnimationFrame(tryScroll);
      } else {
        console.warn("[ReleaseFlow] release-tab-section não encontrado");
        shouldScrollRef.current = false;
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(tryScroll));
  }, [search.tab]);

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
  const canEditOwnTriagem = isOwner && demanda.status === "triagem";
  const canEditTextual = canEditAny || canEditOwnTriagem;
  const canEditMetadata = canEditAny;
  const canChangeStatus = canEditAny;
  const podeExcluir = temPermissao("deletar_demanda");

  const handlePatch = async (patch: UpdateDemandaPatch) => {
    await updateMutation.mutateAsync({ id: demanda.id, patch });
    if ("status" in patch) {
      toast.success("Status alterado");
    } else if ("responsavel_id" in patch) toast.success("Desenvolvedor atualizado");
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
              <div className="ml-auto flex items-center gap-2">
                <ReabrirDemandaButton demanda={demanda} isOwner={isOwner} />
                {canEditAny && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIaDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    Gerar prompt IA
                  </Button>
                )}
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
                    {podeExcluir && (
                      <DropdownMenuItem
                        onSelect={() => setExcluirOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Excluir demanda
                      </DropdownMenuItem>
                    )}
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
              Aberto por <SolicitanteSummary solicitante={demanda.solicitante} />
              {demanda.tenant?.nome ? ` (${demanda.tenant.nome})` : ""}{" "}
              {formatRelativeSP(demanda.created_at)}
            </p>
          </div>

          {/* Reabertura (apenas se entregue/encerrada) */}
          <ReaberturaBanner demanda={demanda} isOwner={isOwner} />

          {/* Badge "Reaberta" se foi reaberta no histórico */}
          {demanda.foi_reaberta && (
            <DemandaReabertaBadge
              demandaId={demanda.id}
              totalReaberturas={demanda.total_reaberturas}
            />
          )}

          {/* Descrição */}
          <DescricaoCard
            value={demanda.descricao}
            disabled={!canEditTextual || updateMutation.isPending}
            onSave={(v) => handlePatch({ descricao: v })}
          />

          {/* Anexos */}
          {user && (
            <AnexosSecao
              demandaId={demanda.id}
              userId={user.id}
              podeRemoverDeOutros={canEditAny}
            />
          )}

          {/* Tabs: Comentários | Retornos | Histórico | Vínculos | Releases */}
          <DetalheTabs
            demandaId={demanda.id}
            demandaTipo={demanda.tipo}
            incluirRelease={!!demanda.incluir_release}
            podeAdicionarVinculo={canEditAny || canEditOwnTriagem}
            podeRemoverVinculo={canEditAny}
            activeTab={search.tab ?? "comentarios"}
            onTabChange={(tab) =>
              navigate({
                to: "/demandas/$codigo",
                params: { codigo },
                search: (prev) => ({ ...prev, tab }),
                replace: true,
              })
            }
            tituloIA={search.tituloIA}
            resumoIA={search.resumoIA}
            onConsumeIA={() =>
              navigate({
                to: "/demandas/$codigo",
                params: { codigo },
                search: (prev) => ({ ...prev, tituloIA: undefined, resumoIA: undefined }),
                replace: true,
              })
            }
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

      {podeExcluir && (
        <ExcluirDemandaDialog
          demandaId={demanda.id}
          demandaCodigo={demanda.codigo ?? codigo}
          open={excluirOpen}
          onOpenChange={setExcluirOpen}
        />
      )}

      {canEditAny && (
        <GerarPromptIADialog
          open={iaDialogOpen}
          onOpenChange={setIaDialogOpen}
          demandaId={demanda.id}
          demandaCodigo={demanda.codigo ?? codigo}
          promptInicial={demanda.prompt_ia}
          promptAtualizadoEm={demanda.prompt_ia_atualizado_em}
        />
      )}

      {canEditAny && (
        <IncluirReleaseDialog
          open={releaseDialogOpen}
          onOpenChange={setReleaseDialogOpen}
          demanda={{
            id: demanda.id,
            codigo: demanda.codigo ?? codigo,
            titulo: demanda.titulo,
            tipo: demanda.tipo,
          }}
          onConcluido={({ tituloIA, resumoIA }) => {
            void navigate({
              to: "/demandas/$codigo",
              params: { codigo },
              search: (prev) => ({ ...prev, tab: "releases", tituloIA, resumoIA }),
              replace: true,
            });
          }}
        />
      )}
    </div>
  );
}

function Breadcrumb({ codigo }: { codigo: string }) {
  const router = useRouter();
  const handleVoltar = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      void router.navigate({ to: "/demandas" });
    }
  };
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <button
        type="button"
        onClick={handleVoltar}
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Demandas
      </button>
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
  demandaTipo: string;
  incluirRelease: boolean;
  podeAdicionarVinculo: boolean;
  podeRemoverVinculo: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  tituloIA?: string;
  resumoIA?: string;
  onConsumeIA: () => void;
}

function DetalheTabs({
  demandaId,
  demandaTipo,
  incluirRelease,
  podeAdicionarVinculo,
  podeRemoverVinculo,
  activeTab,
  onTabChange,
  tituloIA,
  resumoIA,
  onConsumeIA,
}: DetalheTabsProps) {
  const { data: comentarios = [] } = useComentarios(demandaId);
  const { data: vinculos = [] } = useVinculos(demandaId);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList>
        <TabsTrigger value="comentarios">
          Comentários
          {comentarios.length > 0 && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {comentarios.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="retornos">Retornos</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="vinculos">
          Vínculos
          {vinculos.length > 0 && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {vinculos.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="releases">Releases</TabsTrigger>
      </TabsList>
      <TabsContent value="comentarios" className="mt-4">
        <ComentariosSecao demandaId={demandaId} />
      </TabsContent>
      <TabsContent value="retornos" className="mt-4">
        <RetornosTab demandaId={demandaId} />
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
      <TabsContent value="releases" className="mt-4" id="release-tab-section">
        <ReleaseTab
          demandaId={demandaId}
          demandaTipo={demandaTipo}
          incluirRelease={incluirRelease}
          tituloInicial={tituloIA}
          resumoInicial={resumoIA}
          onConsumeInicial={onConsumeIA}
        />
      </TabsContent>
    </Tabs>
  );
}

interface DescricaoCardProps {
  value: string;
  disabled: boolean;
  onSave: (v: string) => Promise<void> | void;
}

// Altura colapsada alinhada ao sidebar (Status → Estimativa ≈ 6 cards)
const DESCRICAO_COLLAPSED_MAX_PX = 520;

function DescricaoCard({ value, disabled, onSave }: DescricaoCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => {
      setOverflowing(el.scrollHeight > DESCRICAO_COLLAPSED_MAX_PX + 4);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  const showToggle = overflowing || expanded;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Descrição</CardTitle>
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Recolher descrição" : "Expandir descrição"}
          >
            {expanded ? (
              <>
                Recolher <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Expandir <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div
          ref={contentRef}
          className={cn(
            "overflow-y-auto overscroll-contain pr-1",
            !expanded && "max-h-[520px]",
          )}
          style={!expanded ? { maxHeight: DESCRICAO_COLLAPSED_MAX_PX } : undefined}
        >
          <EditableField
            value={value}
            multiline
            disabled={disabled}
            minLength={10}
            placeholder="Sem descrição"
            ariaLabel="Descrição da demanda"
            onSave={onSave}
          />
        </div>
      </CardContent>
    </Card>
  );
}
