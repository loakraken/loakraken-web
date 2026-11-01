import { toResponse } from "@/lib/api/respond";
import { getSiblings } from "@/lib/character/server";
import { clearUserKey } from "@/lib/byok/server";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("characterName") ?? "";
  const result = await getSiblings(name, request.signal);
  // The official API refused the user's own key: forget it in this same answer (보안 R8).
  if (!result.ok && result.error.code === "USER_KEY_INVALID") await clearUserKey();
  return toResponse(result);
}
