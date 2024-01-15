"use client";

import { GpuPricingPlan } from "@/app/(app)/pricing/components/gpuPricingTable";
import PricingList from "@/app/(app)/pricing/components/pricePlanList";

export default function Home() {
  return (
    <div>
      <PricingList />
      <GpuPricingPlan />
    </div>
  );
}
