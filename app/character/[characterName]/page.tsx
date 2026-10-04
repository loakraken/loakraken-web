import type { Metadata } from "next";
import { CharacterRouteState } from "@/components/landing/route-state";

type Props = { params: Promise<{ characterName: string }> };

export const metadata: Metadata = {
  title: "캐릭터 관측 준비",
  robots: { index: false, follow: false },
};

export default async function CharacterPage({ params }: Props) {
  const { characterName } = await params;
  // Next 16.3 passes this dynamic segment encoded; decode once before display.
  let name: string;
  try { name = decodeURIComponent(characterName); } catch { name = characterName; }
  return <CharacterRouteState characterName={name.slice(0, 24)} />;
}
