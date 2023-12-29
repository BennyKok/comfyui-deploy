import { DownloadButton } from "./DownloadButton";
import { getFileDownloadUrl } from "@/server/getFileDownloadUrl";

export async function OutputRender(props: {
  run_id: string;
  filename: string;
}) {
  if (props.filename.endsWith(".png")) {
    const url = await getFileDownloadUrl(
      `outputs/runs/${props.run_id}/${props.filename}`
    );

    return <img className="max-w-[200px]" alt={props.filename} src={url} />;
  } else {
    const url = await getFileDownloadUrl(
      `outputs/runs/${props.run_id}/${props.filename}`
    );
    console.log(url);

    return <DownloadButton filename={props.filename} href={url} />;
  }
}
