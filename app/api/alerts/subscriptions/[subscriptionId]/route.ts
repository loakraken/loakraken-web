import { toResponse } from "@/lib/api/respond";
import { requestUnsubscribe } from "@/lib/alerts/model";
import { credentials, guard, invalid, origin } from "@/lib/alerts/server";

/** Turning alerts off: the subscription and its conditions go at once. */
export async function DELETE(request: Request, { params }: { params: Promise<{ subscriptionId: string }> }) {
  const blocked = guard(request, true);
  if (blocked) return blocked;
  const own = credentials(request, (await params).subscriptionId);
  if (!own) return invalid();
  return toResponse(await requestUnsubscribe(own.subscriptionId, own.token, origin(), { signal: request.signal }));
}
