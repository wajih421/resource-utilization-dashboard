// lib/utils/utilization.ts

export type UtilizationStatus =
  | "Less Utilized"
  | "Fully Utilized"
  | "Highly Utilized"
  | "Abnormally Utilized"
  | "Not Filled";

export type UtilizationThresholds = {
  lessUtilizedMax: number;
  fullyUtilizedMax: number;
  highlyUtilizedMax: number;
};

// Mirrors the column defaults on utilization_settings (a single-row config
// table) — used only as a fallback if that row can't be read, so the
// dashboard degrades gracefully instead of erroring out entirely.
export const DEFAULT_DAILY_CAPACITY_HOURS = 8;
export const DEFAULT_UTILIZATION_THRESHOLDS: UtilizationThresholds = {
  lessUtilizedMax: 6,
  fullyUtilizedMax: 8,
  highlyUtilizedMax: 10,
};

// Thresholds are manager-configurable (utilization_settings table) rather
// than hard-coded, since the exact boundaries depend on workshop policy.
// Boundaries are in absolute hours, not percentages: with the default 8h
// daily capacity, "Fully Utilized" (6-8h) roughly tracks 75-100% and
// "Highly Utilized" (8-10h) roughly tracks 100-125%, but the classification
// itself always compares against hours, not the derived percentage.
export function getUtilizationStatus(
  totalHours: number,
  thresholds: UtilizationThresholds = DEFAULT_UTILIZATION_THRESHOLDS
): UtilizationStatus {
  if (totalHours <= 0) return "Not Filled";
  if (totalHours < thresholds.lessUtilizedMax) return "Less Utilized";
  if (totalHours <= thresholds.fullyUtilizedMax) return "Fully Utilized";
  if (totalHours <= thresholds.highlyUtilizedMax) return "Highly Utilized";
  return "Abnormally Utilized";
}

export function getUtilizationPercent(totalHours: number, dailyCapacityHours: number): number {
  if (dailyCapacityHours <= 0) return 0;
  return (totalHours / dailyCapacityHours) * 100;
}

export function getStatusColor(status: UtilizationStatus): string {
  switch (status) {
    case "Less Utilized":
      return "text-orange-600 bg-orange-50 border-orange-200";
    case "Fully Utilized":
      return "text-green-600 bg-green-50 border-green-200";
    case "Highly Utilized":
      return "text-blue-600 bg-blue-50 border-blue-200";
    case "Abnormally Utilized":
      return "text-red-600 bg-red-50 border-red-200";
    case "Not Filled":
      return "text-gray-500 bg-gray-50 border-gray-200";
  }
}
