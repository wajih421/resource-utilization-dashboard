// lib/utils/utilization.ts

export type UtilizationStatus =
  | "Less Utilized"
  | "Fully Utilized"
  | "Highly Utilized"
  | "Abnormally Utilized"
  | "Not Filled";

export function getUtilizationStatus(totalHours: number): UtilizationStatus {
  if (totalHours <= 0) return "Not Filled";
  if (totalHours < 6) return "Less Utilized";
  if (totalHours <= 8) return "Fully Utilized";
  if (totalHours <= 10) return "Highly Utilized";
  return "Abnormally Utilized";
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