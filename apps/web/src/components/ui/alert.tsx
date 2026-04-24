import * as React from "react";

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export type AlertVariant = "default" | "destructive";

export type AlertProps = React.ComponentProps<"div"> & {
  variant?: AlertVariant;
};

/**
 * Alert — variantes `default` (informativo) e `destructive` (erro; UIP-04).
 * Default: `role="status"`. Destructive: `role="alert"`.
 */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", role, ...props }, ref) => {
    const destructive = variant === "destructive";
    return (
      <div
        ref={ref}
        data-slot="alert"
        data-variant={variant}
        role={role ?? (destructive ? "alert" : "status")}
        className={cx(
          "relative flex gap-2 rounded-lg border px-4 py-3 text-sm",
          destructive
            ? "border-red-200 bg-red-50 text-red-950 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-50"
            : "border-sky-900/15 bg-sky-50/90 text-sky-950 dark:border-sky-400/20 dark:bg-sky-950/35 dark:text-sky-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="alert-title"
      className={cx("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="alert-description"
      className={cx("text-sm text-sky-950/90 dark:text-sky-100/95 [&_p]:leading-relaxed", className)}
      {...props}
    />
  ),
);
AlertDescription.displayName = "AlertDescription";
