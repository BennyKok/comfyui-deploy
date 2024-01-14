"use client";

import { GpuPricingPlan } from "@/app/(app)/pricing/components/gpuPricingTable";
import { PricingPlan } from "@/app/(app)/pricing/components/pricingPlanTable";

export default function Home() {
  return (
    <div>
      <PricingPlan />
      <GpuPricingPlan />
    </div>
  );
}
