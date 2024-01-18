"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyButton({
  className,
  ...props
}: {
  text: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      onClick={() => {
        toast.success("Copied to clipboard");
        navigator.clipboard.writeText(props.text);
      }}
      className={cn(" p-2 min-h-0 aspect-square", className)}
    >
      <Copy size={14} />
    </Button>
  );
}
