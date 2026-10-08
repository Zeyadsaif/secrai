"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  ["Monitor", [["overview", "Overview"], ["findings", "Findings"], ["assets", "Assets"]]],
  ["Analyze", [["engine", "Risk Engine"], ["compliance", "Compliance"], ["activity", "Activity"]]],
  ["Manage", [["integrations", "Integrations"], ["team", "Team"], ["settings", "Settings"]]],
] as const;

export function Sidebar({ org, email }: { org: string; email: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-line/70 bg-[#0b0f19]">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-[#0a1024]">S</div>
        <span className="font-display text-lg font-bold">Secrai</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {NAV.map(([section, items]) => (
          <div key={section}>
            <div className="px-2 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-widest text-white/35">{section}</div>
            {items.map(([slug, label]) => {
              const href = `/dashboard/${slug}`;
              const active = pathname === href;
              return (
                <Link key={slug} href={href}
                  className={`flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition ${active ? "bg-brand/15 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-line/70 p-3">
        <div className="rounded-lg border border-line/70 bg-surface px-3 py-2.5">
          <div className="truncate text-sm font-semibold">{org}</div>
          <div className="truncate text-xs text-white/45">{email}</div>
        </div>
      </div>
    </aside>
  );
}
