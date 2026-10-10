import { LogoMark } from "@/components/ui/logo";

// Site brand mark: the approved LOAKraken logo (components/ui/logo). CSS sets
// the rendered size where it is used (header 22px, /about footer and closing).
export function KrakenMark({ size = 22 }: { size?: number }) {
  return <LogoMark size={size} />;
}
