import { z } from "zod"

import { optText, optInt } from "@/lib/validation/reference"

export const subtaskTypeSchema = z.object({
  work_type: z.string().trim().min(1, "Work type is required."),
  summary_pattern: optText,
  trigger_description: optText,
  standard_inputs: optText,
  process_doc: optText,
  definition_of_done: optText,
  likely_owner: optText,
  qa_reviewer: optText,
  where_it_lives: optText,
  notes: optText,
  sort_order: optInt,
})

/** Field config shared by the admin form (label + input type per column). */
export const SUBTASK_FIELDS = [
  { name: "work_type", label: "Work type", type: "text" },
  { name: "summary_pattern", label: "Summary pattern", type: "text" },
  { name: "trigger_description", label: "Trigger", type: "textarea" },
  { name: "standard_inputs", label: "Standard inputs", type: "textarea" },
  { name: "process_doc", label: "Process / SOP", type: "textarea" },
  { name: "definition_of_done", label: "Definition of done", type: "textarea" },
  { name: "likely_owner", label: "Likely owner", type: "text" },
  { name: "qa_reviewer", label: "QA reviewer", type: "text" },
  { name: "where_it_lives", label: "Where it lives", type: "text" },
  { name: "notes", label: "Notes", type: "textarea" },
  { name: "sort_order", label: "Sort order", type: "int" },
]
