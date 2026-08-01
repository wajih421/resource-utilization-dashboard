// components/layout/nav-config.tsx
//
// Icon components can't be passed as props from a Server Component to a
// Client Component (they aren't serializable across that boundary) — so
// instead of building these arrays in the server layout.tsx files and
// passing them down, they're defined here and consumed entirely within
// the client component tree (AppShell picks the array by a plain "role"
// string prop instead).
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ListChecks,
  CalendarCheck,
  BarChart3,
  History,
  Settings,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const managerNavItems: NavItem[] = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/projects", label: "Projects", icon: FolderKanban },
  { href: "/manager/resources", label: "Resources", icon: Users },
  { href: "/manager/tasks", label: "Tasks", icon: ListChecks },
  { href: "/manager/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/manager/reports", label: "Reports", icon: BarChart3 },
  { href: "/manager/audit-log", label: "Audit Log", icon: History },
  { href: "/manager/settings", label: "Settings", icon: Settings },
];

export const resourceNavItems: NavItem[] = [
  { href: "/resource/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resource/submit-work", label: "Submit Work", icon: ClipboardList },
];
