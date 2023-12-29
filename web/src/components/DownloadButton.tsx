"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function DownloadButton(props: { href: string; filename: string }) {
  return (
    <Button
      className="gap-2"
      onClick={async () => {
        const url = props.href;

        console.log(url);

        const a = document.createElement("a");
        a.href = url;
        a.download = props.filename;
        a.target = "_blank"; // Add this line
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }}
    >
      Download <Download size={14} />
    </Button>
  );
}
