import { toResponse } from "@/lib/api/respond";
import { getPatchNotes } from "@/lib/home/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 1);
  return toResponse(
    await getPatchNotes({ category: params.get("category"), page }, { signal: request.signal }),
  );
}
