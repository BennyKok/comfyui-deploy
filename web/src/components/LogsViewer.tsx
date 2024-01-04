"use client";

import React, { useEffect, useRef } from "react";

export type LogsType = {
  machine_id?: string;
  logs: string;
  timestamp: number;
}[];

export function LogsViewer({ logs }: { logs: LogsType }) {
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
      className="flex flex-col text-xs p-2 overflow-y-scroll max-h-[400px] whitespace-break-spaces"
    >
      {logs.map((x, i) => (
        <div key={i}>{x.logs}</div>
      ))}
    </div>
  );
}
