'use client'

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFileDownloadUrl } from "@/server/getFileDownloadUrl";


export function OutputRender(props: { run_id: string; filename: string; }) {
  if (props.filename.endsWith(".png")) {
    return (
      <img
        className="max-w-[200px]"
        alt={props.filename}
        src={`/api/view?file=${encodeURIComponent(
          `outputs/runs/${props.run_id}/${props.filename}`
        )}`} />
    );
  } else {
    return <Button className="gap-2" onClick={async () => {
      const url = await getFileDownloadUrl(`outputs/runs/${props.run_id}/${props.filename}`);

      const a = document.createElement('a');
      a.href = url;
      a.download = props.filename;
      a.target = '_blank'; // Add this line
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }}>Download <Download size={14} /></Button>;
  }
}
