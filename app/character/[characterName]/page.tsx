import type { Metadata } from "next";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { CharacterView } from "@/components/character/character-view";
import { normalizeCharacterName } from "@/lib/character/model";
import { getCharacter } from "@/lib/character/server";

export const dynamic = "force-dynamic";
const decodeName = (raw: string) => {
  try {
    return normalizeCharacterName(decodeURIComponent(raw));
  } catch {
    return normalizeCharacterName(raw);
  }
};

// One canonical URL however the name was encoded in the request (ops O-6).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ characterName: string }>;
}): Promise<Metadata> {
  const name = decodeName((await params).characterName);
  return {
    title: name ? `${name} · 캐릭터 정보` : "캐릭터 정보",
    robots: { index: false, follow: false },
    alternates: { canonical: `/character/${encodeURIComponent(name)}` },
  };
}

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ characterName: string }>;
}) {
  const name = decodeName((await params).characterName);
  const result = await getCharacter(name);
  // Request-time snapshot in a dynamic Server Component, shared with hydration.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();
  const client = new QueryClient();
  if (result.ok)
    client.setQueryData(["character", name], result.envelope, {
      updatedAt: renderedAt,
    });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <CharacterView
        key={name}
        name={name}
        initialError={result.ok ? undefined : result.error}
        renderedAt={renderedAt}
      />
    </HydrationBoundary>
  );
}
