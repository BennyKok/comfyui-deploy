"use client";

import { CopyButton } from "@/components/CopyButton";
import type { StringLiteralUnion } from "shikiji";
import useSWR from "swr";
import { highlight } from "../server/highlight";

export function CodeBlockClient({
  code,
  lang,
}: {
  code: string;
  lang: StringLiteralUnion<string>;
}) {
  const { data } = useSWR(code, async () => {
    return highlight(code.trim(), lang);
  });

  return (
    <div className="relative w-full text-sm">
      {data && (
        <p
          className="[&>pre]:p-4 rounded-lg max-h-96 overflow-auto w-full"
          style={{
            overflowWrap: "break-word",
          }}
          dangerouslySetInnerHTML={{
            __html: data,
          }}
        />
      )}
      <CopyButton className="absolute right-2 top-2" text={code} />
    </div>
  );
}
