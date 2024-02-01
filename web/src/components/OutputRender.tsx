"use client";

import useSWR from "swr";
import { DownloadButton } from "./DownloadButton";
import { getFileDownloadUrl } from "@/server/getFileDownloadUrl";

export function OutputRender(props: {
  run_id: string;
  filename: string;
}) {
  const { data: url } = useSWR(
    "run-outputs+" + props.run_id + props.filename,
    async () => {
      return await getFileDownloadUrl(
        `outputs/runs/${props.run_id}/${props.filename}`,
      );
    },
  );

  if (!url) return <></>;

  if (props.filename.endsWith(".mp4") || props.filename.endsWith(".webm")) {
    return (
      <video controls autoPlay className="w-[400px]">
        <source src={url} type="video/mp4" />
        <source src={url} type="video/webm" />
        Your browser does not support the video tag.
      </video>
    );
  }

  if (
    props.filename.endsWith(".png") ||
    props.filename.endsWith(".gif") ||
    props.filename.endsWith(".jpg") ||
    props.filename.endsWith(".jpeg")
  ) {
    return <img className="max-w-[200px]" alt={props.filename} src={url} />;
  } else {
    return <DownloadButton filename={props.filename} href={url} />;
  }
}
