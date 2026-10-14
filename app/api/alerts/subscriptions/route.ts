import { toResponse } from "@/lib/api/respond";
import { parseSubscribeBody, requestSubscribe } from "@/lib/alerts/model";
import { guard, invalid, jsonBody, origin } from "@/lib/alerts/server";

// POST only, from this site's own page: the browser's push subscription in,
// the subscription id and its manage token out (shown once).
export async function POST(request: Request) {
  const blocked = guard(request, true);
  if (blocked) return blocked;
  const body = parseSubscribeBody(await jsonBody(request));
  if (!body) return invalid();
  return toResponse(await requestSubscribe(body, origin(), { signal: request.signal }));
}
