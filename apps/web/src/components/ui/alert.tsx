import * as React from "react";

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Alert informativo (variante default) — API alinhada ao padrão shadcn/ui.
 * `role="status"` para avisos estáticos (evita interrupção agressiva em leitores de ecrã).
 */
export const Alert = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="alert"
      role="status"
      className={cx(
        "relative flex gap-2 rounded-lg border border-sky-900/15 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 dark:border-sky-400/20 dark:bg-sky-950/35 dark:text-sky-50",
        className,
      )}
      {...props}
    />
  ),
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
