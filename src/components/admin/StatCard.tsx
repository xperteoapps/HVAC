import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  to?: string;
  loading?: boolean;
  tone?: "default" | "accent" | "warning" | "destructive";
  className?: string;
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-secondary text-secondary-foreground",
  accent: "bg-accent/15 text-accent",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/15 text-destructive",
};

export function StatCard({ title, value, hint, icon, to, loading, tone = "default", className }: StatCardProps) {
  const body = (
    <CardContent className="flex items-start gap-3 p-4">
      {icon && <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", TONES[tone])}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {loading ? <Skeleton className="mt-1 h-7 w-20" /> : <p className="mt-0.5 truncate text-2xl font-bold tabular-nums">{value}</p>}
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </CardContent>
  );
  if (to) {
    return (
      <Card className={cn("transition-colors hover:border-accent", className)}>
        <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {body}
        </Link>
      </Card>
    );
  }
  return <Card className={className}>{body}</Card>;
}
