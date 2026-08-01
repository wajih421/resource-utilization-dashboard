// components/layout/AppShell.tsx
"use client";

import { useState } from "react";
import { Menu, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavSidebarContent } from "./NavSidebar";
import { managerNavItems, resourceNavItems } from "./nav-config";
import type { SidebarUser } from "@/lib/supabase/current-user";

export function AppShell({
  role,
  user,
  children,
}: {
  role: "manager" | "resource";
  user: SidebarUser | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = role === "manager" ? managerNavItems : resourceNavItems;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed h-screen w-64">
          <NavSidebarContent items={items} user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="outline" size="icon" aria-label="Open navigation menu" />}
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <NavSidebarContent items={items} user={user} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Factory className="size-3.5" />
            </div>
            <span className="text-sm font-semibold">ROT Workshop</span>
          </div>
        </header>

        <main className="flex-1 bg-muted/40 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
