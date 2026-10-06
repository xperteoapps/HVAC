import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Lekki wrapper pola formularza (label + error) do react-hook-form. */
export function FormField({
  label,
  error,
  htmlFor,
  required,
  className,
  children,
  hint,
}: {
  label?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
