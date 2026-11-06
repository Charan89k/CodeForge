import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { exportAccountData } from "@/services/account";

export const dynamic = "force-dynamic";

const EXPORT_LIMIT = { limit: 5, windowMs: 60 * 60_000 };

/** A signed-in person's own data, as a download. Nobody else's can be named. */
export async function GET(request: Request) {
  // A cross-site page could otherwise start a heavy export it cannot read.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return new Response("Forbidden", { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first", { status: 401 });

  const limited = await rateLimit(`account-export:${user.id}`, EXPORT_LIMIT);
  if (!limited.success) {
    return new Response("Too many exports. Try again in an hour.", { status: 429 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(await exportAccountData(user.id), null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="tech-epitome-account-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
