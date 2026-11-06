import { memberForRoute } from "@/lib/tenancy/context";
import { exportPlacementCsv } from "@/services/placement";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: RouteContext<"/campus/[slug]/placement/export">
) {
  // A cross-site page could otherwise run (and audit) an export it cannot read.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return new Response("Forbidden", { status: 403 });
  }
  const { slug } = await params;
  const ctx = await memberForRoute(slug, "placement.manage");
  if (ctx instanceof Response) return ctx;
  const csv = await exportPlacementCsv(ctx);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="placement-${slug}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
