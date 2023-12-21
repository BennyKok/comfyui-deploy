"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";

export function CopyButton({
  className,
  ...props
}: {
  text: string;
  className?: string;
}) {
  return (
    <Button
      onClick={() => {
        navigator.clipboard.writeText(props.text);
      }}
      className={cn(" p-2 min-h-0 aspect-square", className)}
    >
      <Copy size={14} />
    </Button>
  );
}
