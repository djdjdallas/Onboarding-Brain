import { cn } from "@/lib/utils"

/**
 * EmptyState — the V3 standard "nothing here yet" panel.
 * Centered, max-w-80, a 40px lucide icon (passed as `icon`), an h2 title,
 * a small muted description, and an optional CTA (a <Button> or link element).
 * No illustrations — per the design system.
 *
 * Props:
 *   icon:        a lucide icon component (e.g. Building2)
 *   title:       string
 *   description: string
 *   action:      optional node (Button / link) rendered below
 *   className:   extra classes on the wrapper
 */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-80 flex-col items-center gap-3 px-4 py-12 text-center",
        className
      )}
    >
      {Icon ? <Icon className="size-10 text-muted-foreground" strokeWidth={1.5} /> : null}
      <div className="space-y-1">
        <h2 className="text-h2 font-medium">{title}</h2>
        {description ? (
          <p className="text-small text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
