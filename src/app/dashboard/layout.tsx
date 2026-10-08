import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/org";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <Sidebar org={ctx.organizationName} email={ctx.email} />
      <main className="h-screen overflow-y-auto px-8 py-7">{children}</main>
    </div>
  );
}
