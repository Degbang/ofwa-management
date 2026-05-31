import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
