import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building,
  Building2,
  Columns3,
  Inbox,
  Layers,
  LayoutDashboard,
  LogOut,
  Network,
  Package2,
  PlusCircle,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { translateAuthError } from "@/lib/auth-errors";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemProps {
  to?: string;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

const baseClasses =
  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-secondary/50 text-muted-foreground";

function NavItem({ to, icon: Icon, label, disabled, onClick }: NavItemProps) {
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(baseClasses, "opacity-50 cursor-not-allowed")}
            aria-disabled
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">em breve</TooltipContent>
      </Tooltip>
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        className={baseClasses}
        activeOptions={{ exact: to === "/" || to === "/demandas" }}
        activeProps={{ className: "bg-secondary text-primary" }}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(baseClasses, "w-full text-left")}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

export function Sidebar() {
  const { temPermissao, temAlgumaPermissao } = useProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = React.useCallback(async () => {
    try {
      await signOut();
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(translateAuthError(err));
    }
  }, [signOut, navigate]);

  const mostraAdmin = temAlgumaPermissao(
    "gerenciar_modulos",
    "gerenciar_submodulos",
    "gerenciar_areas",
    "gerenciar_usuarios",
    "gerenciar_perfis_acesso",
    "gerenciar_tenants",
  );

  const mostraDemandas = temAlgumaPermissao(
    "ver_demandas",
    "ver_todas_demandas",
    "criar_demanda",
  );

  return (
    <TooltipProvider delayDuration={150}>
      <aside className="flex w-64 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center border-b border-border px-6">
          <span className="font-sans text-lg font-semibold text-foreground">devflow</span>
          <span className="font-mono text-sm text-muted-foreground">/hub</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          {mostraDemandas && (
            <>
              <NavItem to="/demandas" icon={Inbox} label="Demandas" />
              <NavItem to="/demandas/kanban" icon={Columns3} label="Kanban" />
              {temPermissao("criar_demanda") && (
                <NavItem
                  to="/demandas/nova"
                  icon={PlusCircle}
                  label="Nova demanda"
                />
              )}
            </>
          )}

          {mostraAdmin && (
            <>
              <div className="mt-4 mb-2 px-3 text-xs uppercase tracking-wider text-muted-foreground">
                Admin
              </div>
              {temPermissao("gerenciar_modulos") && (
                <NavItem to="/admin/modulos" icon={Layers} label="Módulos" />
              )}
              {temPermissao("gerenciar_submodulos") && (
                <NavItem to="/admin/submodulos" icon={Network} label="Submódulos" />
              )}
              {temPermissao("gerenciar_areas") && (
                <NavItem to="/admin/areas" icon={Building2} label="Áreas" />
              )}
              {temPermissao("gerenciar_usuarios") && (
                <NavItem to="/admin/usuarios" icon={Users} label="Usuários" />
              )}
              {temPermissao("gerenciar_perfis_acesso") && (
                <NavItem
                  to="/admin/perfis-acesso"
                  icon={ShieldCheck}
                  label="Perfis de Acesso"
                />
              )}
              {temPermissao("gerenciar_tenants") && (
                <NavItem to="/admin/tenants" icon={Building} label="Empresas" />
              )}
              <NavItem to="/perfil" icon={UserCircle} label="Perfil" />
            </>
          )}

          <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
            {!mostraAdmin && (
              <NavItem to="/perfil" icon={UserCircle} label="Perfil" />
            )}
            <NavItem icon={LogOut} label="Sair" onClick={handleSignOut} />
          </div>
        </nav>
      </aside>
    </TooltipProvider>
  );
}
