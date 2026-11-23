"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SalonContact } from "./ContactActions";

export type StorefrontValue = { mode: "CATALOG" | "CHECKOUT"; salon: SalonContact };

const EMPTY: StorefrontValue = {
  mode: "CATALOG",
  salon: { phone: "", instagram: null, messenger: null, address: "", mapsUrl: null, hoursLines: [] },
};

const Ctx = createContext<StorefrontValue>(EMPTY);

/** Set once in the shop layout; cart vs. "order at the salon" UI reads it */
export function StorefrontProvider({ value, children }: { value: StorefrontValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStorefront = () => useContext(Ctx);
export const useCatalogMode = () => useContext(Ctx).mode === "CATALOG";
