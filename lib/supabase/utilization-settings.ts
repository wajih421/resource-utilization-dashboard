import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-types";
import {
  DEFAULT_DAILY_CAPACITY_HOURS,
  DEFAULT_UTILIZATION_THRESHOLDS,
  type UtilizationThresholds,
} from "@/lib/utils/utilization";

export type UtilizationSettings = {
  dailyCapacityHours: number;
  thresholds: UtilizationThresholds;
};

// utilization_settings is a single config row (id=1). If it's ever missing
// (fresh DB, row deleted), fall back to the same values the columns
// themselves default to, so the dashboard degrades gracefully instead of
// erroring out entirely.
export async function getUtilizationSettings(
  supabase: SupabaseClient<Database>
): Promise<UtilizationSettings> {
  const { data, error } = await supabase
    .from("utilization_settings")
    .select("daily_capacity_hours, less_utilized_max, fully_utilized_max, highly_utilized_max")
    .single();

  if (error || !data) {
    console.error("Failed to load utilization_settings, using defaults:", error?.message);
    return {
      dailyCapacityHours: DEFAULT_DAILY_CAPACITY_HOURS,
      thresholds: DEFAULT_UTILIZATION_THRESHOLDS,
    };
  }

  return {
    dailyCapacityHours: Number(data.daily_capacity_hours),
    thresholds: {
      lessUtilizedMax: Number(data.less_utilized_max),
      fullyUtilizedMax: Number(data.fully_utilized_max),
      highlyUtilizedMax: Number(data.highly_utilized_max),
    },
  };
}
