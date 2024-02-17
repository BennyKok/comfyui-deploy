import { DownloadButton } from "./DownloadButton";
import { getFileDownloadUrl } from "@/server/getFileDownloadUrl";

export async function OutputRender(props: {
  run_id: string;
  filename: string;
}) {
  if (props.filename.endsWith(".mp4") || props.filename.endsWith(".webm")) {
    const url = await getFileDownloadUrl(
      `outputs/runs/${props.run_id}/${props.filename}`,
    );

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
    const url = await getFileDownloadUrl(
      `outputs/runs/${props.run_id}/${props.filename}`,
    );

    return <img className="max-w-[200px]" alt={props.filename} src={url} />;
  } else {
    const url = await getFileDownloadUrl(
      `outputs/runs/${props.run_id}/${props.filename}`,
    );
    // console.log(url);

    return <DownloadButton filename={props.filename} href={url} />;
  }
}
