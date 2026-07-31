// lib/validations/worklog-schema.ts
import { z } from "zod";

// Shared between the WorkLogForm (client-side validation, instant feedback)
// and app/api/work-logs/route.ts (server-side validation — never trust the
// client alone, since a request could be sent directly without the form).
export const workLogSchema = z.object({
  project_id: z.string().uuid({ message: "Please select a project" }),
  task_id: z.string().uuid({ message: "Please select a task" }),
  work_date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" })
    .refine((val) => new Date(val) <= new Date(), {
      message: "Work date cannot be in the future",
    }),
  units_completed: z
    .number({ message: "Units must be a number" })
    .positive({ message: "Units must be greater than 0" })
    .max(100, { message: "That seems too high — double check the units" }),
});

export type WorkLogInput = z.infer<typeof workLogSchema>;