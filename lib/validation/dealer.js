import { z } from "zod"

/**
 * Validation for the onboarding wizard. Shared by the client (react-hook-form
 * resolver) and the server action (re-parsed server-side — never trust the
 * client). PMAs and models are arrays of objects so react-hook-form's
 * useFieldArray gives each a stable key for drag-to-reorder.
 */
export const dealerWizardSchema = z.object({
  // Step 1 — basics
  name: z.string().trim().min(1, "Dealer name is required."),
  oem: z.string().trim().min(1).default("KIA"),
  website: z
    .string()
    .trim()
    .url("Enter a valid URL (including https://).")
    .or(z.literal(""))
    .optional(),
  address: z.string().trim().optional(),
  package_tier: z.enum(["Essential", "Advanced", "Elite"], {
    message: "Pick a package tier.",
  }),
  am_id: z.string().uuid().nullable().optional(),

  // Step 2 — PMAs (priority order = array order)
  pmas: z
    .array(z.object({ city: z.string().trim().min(1) }))
    .min(1, "Add at least one PMA.")
    .max(9, "Up to 9 PMAs."),

  // Step 3 — priority models
  models: z
    .array(z.object({ model: z.string().trim().min(1) }))
    .min(1, "Add at least one model.")
    .max(9, "Up to 9 models."),

  // Step 4 — eligibility flags (flag_key -> boolean)
  eligibility: z.record(z.string(), z.boolean()),

  // Step 5 — seed URLs (optional, one per line on the client)
  urls: z.array(z.string().trim()).optional().default([]),
})

/** Fields validated when advancing past each wizard step (0-indexed). */
export const STEP_FIELDS = [
  ["name", "oem", "website", "address", "package_tier", "am_id"],
  ["pmas"],
  ["models"],
  ["eligibility"],
  ["urls"],
]
