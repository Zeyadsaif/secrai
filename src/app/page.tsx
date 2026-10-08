import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/org";

export default async function Home() {
  const ctx = await getCurrentContext();
  redirect(ctx ? "/dashboard/overview" : "/login");
}
