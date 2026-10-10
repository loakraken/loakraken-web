import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { SchedulePage } from "@/components/schedule/schedule-page";
import { homeScheduleKey } from "@/lib/home/client";
import { getSchedule } from "@/lib/home/server";
import {
  categoryLabel,
  isScheduleCategory,
  schedulePath,
  type ScheduleCategory,
} from "@/lib/home/schedule";

type Params = Promise<{ category?: string[] }>;

/** The category in the path; undefined for an unknown or deeper path (404). */
function readCategory(segments: string[] | undefined): ScheduleCategory | null | undefined {
  if (!segments?.length) return null;
  const [slug] = segments;
  return segments.length === 1 && isScheduleCategory(slug) ? slug : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const category = readCategory((await params).category);
  if (category === undefined) return {};
  const name = category ? `${categoryLabel(category)} 일정` : "주간 일정";
  return {
    title: name,
    description: category
      ? `로스트아크 ${categoryLabel(category)} 일정을 요일별로 확인하세요. 오늘 남은 회차와 다음 시작까지 남은 시간을 보여줍니다.`
      : "로스트아크 모험 섬·카오스게이트·필드 보스·섬·항해·로웬 일정을 요일별로 확인하세요. 다가오는 일정, 이번 주 골드 섬, 주간 초기화까지 남은 시간을 보여줍니다.",
    alternates: { canonical: schedulePath(category) },
  };
}

// The day's rounds change through the day: render per request so the first
// HTML already carries today's schedule (the backend caches it 30 minutes).
export const dynamic = "force-dynamic";

export default async function Schedule({ params }: { params: Params }) {
  if (readCategory((await params).category) === undefined) notFound();
  // A slow backend must not hold the first HTML: give up after 1s and let the
  // client fetch instead.
  const schedule = await getSchedule(null, { timeoutMs: 1_000 });
  // Request-time snapshot in a dynamic Server Component, shared with hydration.
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (schedule.ok)
    client.setQueryData(homeScheduleKey(null), schedule.envelope, { updatedAt: fetchedAt });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <SchedulePage renderedAt={fetchedAt} />
    </HydrationBoundary>
  );
}
