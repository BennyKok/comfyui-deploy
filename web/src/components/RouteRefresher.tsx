"use client";

import { LoadingIcon } from "@/components/LoadingIcon";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

export function RouteRefresher(props: { interval: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const refresh = () => {
      console.log("refreshing");

      startTransition(() => {
        router.refresh();
      });
      timeout = setTimeout(refresh, props.interval);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(timeout);
      } else {
        refresh();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    refresh();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [props.interval, router]);

  return <div>{isPending && <LoadingIcon />}</div>;
}
