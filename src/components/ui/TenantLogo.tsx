import * as React from "react";
import { cn } from "@/lib/utils";
import {
  getTenantBgColor,
  getTenantIniciais,
  getTenantLogoPublicUrl,
} from "@/lib/tenant";

interface TenantLogoProps {
  nome: string | null | undefined;
  logoUrl?: string | null;
  updatedAt?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { container: "h-5 w-5", text: "text-[9px]" },
  md: { container: "h-6 w-6", text: "text-[10px]" },
  lg: { container: "h-12 w-12", text: "text-base" },
} as const;

export function TenantLogo({
  nome,
  logoUrl,
  updatedAt,
  size = "md",
  className,
}: TenantLogoProps) {
  const [imageError, setImageError] = React.useState(false);

  // Reset error if logoUrl changes
  React.useEffect(() => {
    setImageError(false);
  }, [logoUrl, updatedAt]);

  const url = getTenantLogoPublicUrl(logoUrl, updatedAt);
  const showImage = !!url && !imageError;
  const sizes = SIZES[size];

  if (showImage) {
    return (
      <img
        src={url!}
        alt={nome ?? "Logo da empresa"}
        title={nome ?? undefined}
        onError={() => setImageError(true)}
        className={cn(
          sizes.container,
          "shrink-0 rounded-md border border-border bg-background object-contain",
          className,
        )}
      />
    );
  }

  return (
    <div
      title={nome ?? undefined}
      className={cn(
        sizes.container,
        sizes.text,
        getTenantBgColor(nome),
        "flex shrink-0 items-center justify-center rounded-md font-semibold leading-none text-white",
        className,
      )}
    >
      {getTenantIniciais(nome)}
    </div>
  );
}
