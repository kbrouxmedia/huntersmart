import Link from "next/link";

const navLinks = [
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/agencies", label: "Agencias" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/meetings", label: "Reuniones" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 flex items-center gap-8 h-14">
          <span className="font-bold text-white tracking-tight">HunterSmart</span>
          <div className="flex gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
