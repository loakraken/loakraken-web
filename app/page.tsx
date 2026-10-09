import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { HomeDashboard } from "@/components/home/home";
import { homeNewsKey, homeScheduleKey } from "@/lib/home/client";
import { getNews, getSchedule } from "@/lib/home/server";

// Schedule and notices change through the day; render per request so the
// first HTML already carries them (the backend caches 30 / 10 minutes).
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  // A slow backend must not hold the first HTML: give up after 2.5s and let
  // the client fetch instead.
  const prefetch = { timeoutMs: 2_500 };
  const [schedule, news] = await Promise.all([
    getSchedule(null, prefetch),
    getNews(15, prefetch),
  ]);
  // Request-time snapshot in a dynamic Server Component, shared with hydration.
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (schedule.ok)
    client.setQueryData(homeScheduleKey(null), schedule.envelope, { updatedAt: fetchedAt });
  if (news.ok) client.setQueryData(homeNewsKey, news.envelope, { updatedAt: fetchedAt });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <HomeDashboard />
    </HydrationBoundary>
  );
}
