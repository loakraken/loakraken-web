import { permanentRedirect } from "next/navigation";

// 돌파고 was removed (사용자 방향 전환 2026-10-10 §6); the old address and its
// shared links (?m=…) move to the tool list for good (308).
export default function StonePage() {
  permanentRedirect("/tools");
}
