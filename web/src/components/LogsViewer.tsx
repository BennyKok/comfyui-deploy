"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type LogsType = {
  machine_id?: string;
  logs: string;
  timestamp: number;
}[];

export function LogsViewer({
  logs,
  hideTimestamp,
  className,
}: { logs: LogsType; hideTimestamp?: boolean; className?: string }) {
  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // console.log(logs.length, container.current);
    if (container.current) {
      const scrollHeight = container.current.scrollHeight;

      container.current.scrollTo({
        top: scrollHeight,
        behavior: "smooth",
      });
    }
  }, [logs.length]);

  return (
    <div
      ref={(ref) => {
        if (!container.current && ref) {
          const scrollHeight = ref.scrollHeight;

          ref.scrollTo({
            top: scrollHeight,
            behavior: "instant",
          });
        }
        container.current = ref;
      }}
      className={cn(
        "h-full w-full flex flex-col text-xs p-2 overflow-y-scroll whitespace-break-spaces",
        className,
      )}
    >
      {logs.map((x, i) => (
        <div
          key={i}
          className="hover:bg-gray-100 flex flex-row items-center gap-2"
          onClick={() => {
            toast.success("Copied to clipboard");
            navigator.clipboard.writeText(x.logs);
          }}
        >
          {!hideTimestamp && (
            <>
              <span className="w-[150px] flex-shrink-0">
                {new Date(x.timestamp * 1000).toLocaleString()}
              </span>
              <div className="h-full w-[1px] bg-stone-400 flex-shrink-0"></div>
            </>
          )}
          {/* Display timestamp */}
          <div>{x.logs}</div>
        </div>
      ))}
    </div>
  );
}
