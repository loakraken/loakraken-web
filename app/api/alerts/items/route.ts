import { toResponse } from "@/lib/api/respond";
import { requestAlertItems } from "@/lib/alerts/model";
import { guard, origin } from "@/lib/alerts/server";

export async function GET(request: Request) {
  return guard(request, false) ?? toResponse(await requestAlertItems(origin(), { signal: request.signal }));
}
