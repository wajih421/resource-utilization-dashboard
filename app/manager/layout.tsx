// app/manager/layout.tsx
import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";

const navItems = [
  { href: "/manager/dashboard", label: "Dashboard" },
  { href: "/manager/projects", label: "Projects" },
  { href: "/manager/resources", label: "Resources" },
  { href: "/manager/tasks", label: "Tasks" },
  { href: "/manager/attendance", label: "Attendance" },
  { href: "/manager/reports", label: "Reports" },
  { href: "/manager/audit-log", label: "Audit Log" },
  { href: "/manager/settings", label: "Settings" },
];

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-gray-900 text-white p-4 flex flex-col justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold mb-4">ROT Workshop</h2>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded hover:bg-gray-700 text-sm"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <LogoutButton />
      </aside>
      <main className="flex-1 bg-gray-50 p-6">{children}</main>
    </div>
  );
}
