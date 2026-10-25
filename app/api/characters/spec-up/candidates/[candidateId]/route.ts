import { getSpecUpDetail, toResponse } from "@/lib/spec-up/server";
import { isSpecUpEnabled } from "@/lib/tools/flags";

export async function GET(request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  if (!isSpecUpEnabled())
    return toResponse({ ok: false, error: { code: "SPEC_UP_DISABLED", status: 404 } });
  const { candidateId } = await params;
  const query = new URL(request.url).searchParams;
  return toResponse(
    await getSpecUpDetail(
      query.get("characterName") ?? "",
      decodeURIComponent(candidateId),
      request.signal,
      query.get("includeCooldownGems"),
    ),
  );
}
