import { toResponse } from "@/lib/api/respond";
import { parseConditionBody, requestAddCondition, requestConditions } from "@/lib/alerts/model";
import { credentials, guard, invalid, jsonBody, origin } from "@/lib/alerts/server";

type Params = { params: Promise<{ subscriptionId: string }> };

// Reading needs the token too (a header, so a GET from elsewhere has none).
export async function GET(request: Request, { params }: Params) {
  const blocked = guard(request, false);
  if (blocked) return blocked;
  const own = credentials(request, (await params).subscriptionId);
  if (!own) return invalid();
  return toResponse(await requestConditions(own.subscriptionId, own.token, origin(), { signal: request.signal }));
}

export async function POST(request: Request, { params }: Params) {
  const blocked = guard(request, true);
  if (blocked) return blocked;
  const own = credentials(request, (await params).subscriptionId);
  const body = parseConditionBody(await jsonBody(request));
  if (!own || !body) return invalid();
  return toResponse(await requestAddCondition(own.subscriptionId, own.token, body, origin(), { signal: request.signal }));
}
