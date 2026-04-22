import { auth } from "@/lib/auth";

export type AuthedSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export async function getAuthedSession(request: Request): Promise<AuthedSession | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session?.user || !session.session) {
    return null;
  }
  return session;
}
