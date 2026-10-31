import { toResponse } from "@/lib/api/respond";
import { requestEngravingIcons } from "@/lib/character/engraving-icons-server";

export async function GET(request: Request) {
  return toResponse(await requestEngravingIcons(process.env.LOAKRAKEN_API_ORIGIN, { signal: request.signal }));
}
