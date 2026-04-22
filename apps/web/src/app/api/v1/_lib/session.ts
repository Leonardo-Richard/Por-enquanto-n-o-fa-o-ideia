import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getAuthedSession() {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}
