import { z } from "zod"

export const UI_GROUPS = ["Departments", "Inventory", "Languages", "Programs", "Other"]

export const flagTypeSchema = z.object({
  label: z.string().trim().min(1, "Label is required."),
  description: z.string().trim().optional().or(z.literal("")),
  ui_group: z.enum(UI_GROUPS, { message: "Pick a group." }),
  sort_order: z.coerce.number().int("Must be a whole number.").default(0),
})

/** Derive a stable flag key from a label: "EV / Hybrid Inventory" -> "ev_hybrid_inventory". */
export function slugifyFlagKey(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}
