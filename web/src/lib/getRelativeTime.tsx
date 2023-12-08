import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import React from "react";

dayjs.extend(relativeTime);

export function getRelativeTime(time: string | Date | null | undefined) {
  if (typeof time === "string" || time instanceof Date) {
    return dayjs().to(time);
  }
  return null;
}
