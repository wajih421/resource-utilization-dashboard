// components/layout/NavSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SidebarUser } from "@/lib/supabase/current-user";
import type { NavItem } from "./nav-config";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function NavSidebarContent({
  items,
  user,
  onNavigate,
}: {
  items: NavItem[];
  user: SidebarUser | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Factory className="size-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">ROT Workshop</p>
          <p className="text-xs text-sidebar-foreground/50">Utilization Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
              )}
              <Icon className={cn("size-4 shrink-0 transition-transform duration-150", active && "text-sidebar-primary")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {user && (
          <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
                {initials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-sidebar-foreground/50">{user.employeeId}</p>
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 bg-sidebar-accent text-[10px] text-sidebar-accent-foreground capitalize"
            >
              {user.role}
            </Badge>
          </div>
        )}
        <LogoutButton />
      </div>
    </div>
  );
}
