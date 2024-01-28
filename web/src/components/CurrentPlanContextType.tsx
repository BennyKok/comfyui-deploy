"use client";
import { getCurrentPlanWithAuth } from "@/server/getCurrentPlan";
import * as React from "react";
import { createContext } from "react";

export type CurrentPlanContextType = Awaited<
  ReturnType<typeof getCurrentPlanWithAuth>
>;
export const CurrentPlanContext = createContext<
  CurrentPlanContextType | undefined
>(undefined);
export function SubscriptionProvider({
  sub,
  children,
}: {
  sub: CurrentPlanContextType;
  children: React.ReactNode;
}) {
  return (
    <CurrentPlanContext.Provider value={sub}>
      {children}
    </CurrentPlanContext.Provider>
  );
}
