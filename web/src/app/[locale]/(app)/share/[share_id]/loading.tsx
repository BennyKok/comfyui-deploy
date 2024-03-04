"use client";

import { LoadingPageWrapper } from "@/components/LoadingWrapper";
import { usePathname } from "next/navigation";

export default function Loading() {
  const pathName = usePathname();
  return <LoadingPageWrapper className="h-full" tag={pathName.toLowerCase()} />;
}
