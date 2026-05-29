import { z } from "zod"

export const accountManagerSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email."),
  jira_user_string: z.string().trim().optional().or(z.literal("")),
})
