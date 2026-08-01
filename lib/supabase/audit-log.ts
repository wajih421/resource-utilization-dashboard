import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database-types";

// Every manager mutation that changes something meaningful writes here
// (manager_id, action, entity_type, entity_id, old_value, new_value).
// Failures are logged but never block the mutation itself — the audit
// trail is a record of what happened, not a gate on whether it's allowed to.
export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  entry: {
    managerId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    // Callers build these from arbitrary DB row diffs (Record<string, unknown>)
    // — accepted loosely here and trusted to be JSON-serializable, since that's
    // the whole reason they're going into a jsonb column.
    oldValue: Record<string, unknown> | Json | null;
    newValue: Record<string, unknown> | Json | null;
  }
) {
  const { error } = await supabase.from("audit_logs").insert({
    manager_id: entry.managerId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    old_value: entry.oldValue as Json,
    new_value: entry.newValue as Json,
  });

  if (error) {
    console.error(`Failed to write audit log for action "${entry.action}":`, error.message);
  }
}
