import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
dayjs.extend(duration);
export function getRelativeTime(time: string | Date | null | undefined) {
  if (typeof time === "string" || time instanceof Date) {
    return dayjs().to(time);
  }
  return null;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}.${remainingSeconds} mins`;
  } else {
    return `${remainingSeconds.toFixed(1)} secs`;
  }
}

export function getDuration(durationInSecs: number) {
  return `${formatDuration(durationInSecs)}`;
}
