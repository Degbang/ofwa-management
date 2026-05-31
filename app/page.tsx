import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getCurrentSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
