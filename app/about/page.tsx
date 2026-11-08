import { headers } from "next/headers";
import { Landing } from "@/components/landing/landing";
import { aboutIntroScript } from "@/components/landing/intro-state";

export const metadata = {
  title: "LOAKraken 소개",
  alternates: { canonical: "/about" },
};

export default async function About() {
  // This request's CSP nonce (proxy.ts), as for the layout's own pre-paint scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      {/* Before any of the page is painted: the intro hides blocks only when it will build them. */}
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: aboutIntroScript }} />
      <Landing intro />
    </>
  );
}
