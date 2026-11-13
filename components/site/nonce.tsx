"use client";

import { createContext, useContext, type ReactNode } from "react";

// This request's CSP nonce for our own small inline scripts in client components (the layout reads it
// from proxy.ts). Base UI gets the same value through its CSPProvider; this is that, for our code.
const NonceContext = createContext<string | undefined>(undefined);

export function NonceProvider({ nonce, children }: { nonce: string | undefined; children: ReactNode }) {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>;
}

export const useNonce = () => useContext(NonceContext);
