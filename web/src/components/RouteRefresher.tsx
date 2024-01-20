"use client";

import { LoadingIcon } from "@/components/LoadingIcon";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

export function RouteRefresher(props: {
  interval: number;
  autoRefresh: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!props.autoRefresh) return;

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
  }, [props.interval, router, props.autoRefresh]);

  return (
    <div>
      {isPending && <LoadingIcon />}
      {!isPending && !props.autoRefresh && (
        <Button
          className="p-0 h-min"
          variant="ghost"
          onClick={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        >
          <RefreshCcw size={14} />
        </Button>
      )}
    </div>
  );
}
