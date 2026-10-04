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
export const metadata: Metadata = {
  title: "캐릭터 관측",
  robots: { index: false, follow: false },
};

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ characterName: string }>;
}) {
  const { characterName } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(characterName);
  } catch {
    decoded = characterName;
  }
  const name = normalizeCharacterName(decoded);
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
