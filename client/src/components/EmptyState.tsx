import React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center px-4 py-10 text-center", className)}>
      <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" onClick={onAction} className="mt-4 h-8 text-xs">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
