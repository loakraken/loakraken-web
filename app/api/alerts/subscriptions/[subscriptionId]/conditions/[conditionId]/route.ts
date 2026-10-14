import { toResponse } from "@/lib/api/respond";
import { isAlertId, requestDeleteCondition } from "@/lib/alerts/model";
import { credentials, guard, invalid, origin } from "@/lib/alerts/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ subscriptionId: string; conditionId: string }> },
) {
  const blocked = guard(request, true);
  if (blocked) return blocked;
  const { subscriptionId, conditionId } = await params;
  const own = credentials(request, subscriptionId);
  if (!own || !isAlertId(conditionId)) return invalid();
  return toResponse(
    await requestDeleteCondition(own.subscriptionId, own.token, conditionId, origin(), { signal: request.signal }),
  );
}
