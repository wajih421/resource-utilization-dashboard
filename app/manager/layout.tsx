// app/manager/layout.tsx
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getSidebarUser } from "@/lib/supabase/current-user";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await getSidebarUser(supabase);

  return (
    <AppShell role="manager" user={user}>
      {children}
    </AppShell>
  );
}
