// app/resource/layout.tsx
import Link from "next/link";

const navItems = [
  { href: "/resource/dashboard", label: "Dashboard" },
  { href: "/resource/submit-work", label: "Submit Work" },
];

export default function ResourceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-gray-900 text-white p-4 space-y-2">
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
      </aside>
      <main className="flex-1 bg-gray-50 p-6">{children}</main>
    </div>
  );
}