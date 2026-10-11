import Link from "next/link";
import type { ReactNode } from "react";
import {
  Coin,
  Gift,
  HierarchySquare,
  Judge,
  Layer,
  Notification,
  Setting,
  TaskSquare,
  TrendUp,
} from "@/components/ui/icons";
import styles from "./home.module.css";

// Quick menu (L46): the screens people open most, one press from home. Only
// tools that are on for every deployment (no runtime flag), so the row is the
// same in the first HTML and after hydration. Icons follow each screen's own
// header mark where it has one.
const QUICK: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/schedule", label: "주간 일정", icon: <Notification /> },
  { href: "/market", label: "거래소 시세", icon: <TrendUp /> },
  { href: "/rankings", label: "랭킹", icon: <Layer /> },
  { href: "/stats", label: "통계", icon: <HierarchySquare /> },
  { href: "/tools/refining", label: "재련 비용", icon: <Setting /> },
  { href: "/tools/auction", label: "경매 입찰가", icon: <Judge /> },
  { href: "/tools/more-reward", label: "더보기 손익", icon: <Gift /> },
  { href: "/tools/raid-rewards", label: "레이드 보상", icon: <Coin /> },
  { href: "/tools/homework", label: "숙제 체크", icon: <TaskSquare /> },
];

export function QuickMenu() {
  return (
    <nav className={styles.quick} aria-label="바로 가기">
      <ul>
        {QUICK.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <span className={styles.quickIcon} aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
