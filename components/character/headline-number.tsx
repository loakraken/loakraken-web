"use client";

import { useState, useSyncExternalStore } from "react";
import { CountUp } from "@/components/ui/count-up";

const noop = () => () => {};

/**
 * The banner headline number, combat power only (motion guide 7.1, #315). It counts only
 * when it mounts on the client with its data — a page reached by search or a
 * link. On a direct load the server already painted the final value, so
 * counting from 0 after hydration would flash; then it simply shows it.
 */
export function HeadlineNumber({ value, format }: { value: number; format: (value: number) => string }) {
  // Server and hydration render: false; a client-side mount: true.
  const clientMount = useSyncExternalStore(noop, () => true, () => false);
  const [animate] = useState(clientMount);
  return animate ? <CountUp value={value} format={format} /> : <>{format(value)}</>;
}
