// components/auth/LogoutButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="block w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-red-300 disabled:opacity-50"
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
