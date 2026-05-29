import { z } from "zod"

import { optText } from "@/lib/validation/reference"

// Closed value space — hardcoded enum (per constraints).
export const PAGE_FAMILIES = [
  "Core",
  "Required Page",
  "Inventory",
  "Local",
  "Model",
  "Service",
  "Finance",
  "Parts / Collision",
  "Buyer Guide",
  "Specials",
]

export const pageTemplateSchema = z.object({
  page_type: z.string().trim().min(1, "Page type is required."),
  page_family: z.string().trim().min(1, "Pick a family."),
  cadence: z.string().trim().optional().or(z.literal("")),
  base_priority: z.coerce.number().min(0, "Must be ≥ 0."),
  requires_model: z.boolean().default(false),
  requires_pma: z.boolean().default(false),
  gate_rules: z.array(z.string()).default([]),
  default_labels: z.array(z.string()).default([]),
  page_intent: optText,
  required_inputs: optText,
  guardrail: optText,
  stakeholder_notes: optText,
  description_template: optText,
  content_example_url: optText,
  specifications_doc_url: optText,
})

// Fields tracked in the audit log (one entry per change).
export const TEMPLATE_AUDIT_FIELDS = [
  "page_type",
  "page_family",
  "cadence",
  "base_priority",
  "requires_model",
  "requires_pma",
  "gate_rules",
  "default_labels",
  "page_intent",
  "required_inputs",
  "guardrail",
  "stakeholder_notes",
  "description_template",
  "content_example_url",
  "specifications_doc_url",
]
