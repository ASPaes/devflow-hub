import { ChevronDown } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { initials } from "@/lib/utils";
import { translateAuthError } from "@/lib/auth-errors";

export function UserMenu() {
  const { profile } = useProfile();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const nome = profile?.nome ?? user?.email ?? "";

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(translateAuthError(err));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/20 text-xs font-medium text-primary">
            {initials(nome || "?")}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-foreground">{nome}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
          Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
