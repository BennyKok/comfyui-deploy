"use client";

import { getCurrentPlanWithAuth } from "@/server/getCurrentPlan";
import * as React from "react";
import { createContext, useContext } from "react";

type CurrentPlanContextType = Awaited<
  ReturnType<typeof getCurrentPlanWithAuth>
>;
const CurrentPlanContext = createContext<CurrentPlanContextType | undefined>(
  undefined,
);

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

export const useCurrentPlan = (): CurrentPlanContextType => {
  const context = useContext(CurrentPlanContext);

  // if (context === undefined) {
  //   throw new Error("useCurrentPlan must be used within a CurrentPlanProvider");
  // }

  return context;
};
