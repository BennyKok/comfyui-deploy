import { CopyButton } from "@/components/CopyButton";
import type { StringLiteralUnion } from "shikiji";
import { getHighlighter } from "shikiji";

export async function CodeBlock(props: {
  code: string;
  lang: StringLiteralUnion<string>;
}) {
  const highlighter = await getHighlighter({
    themes: ["one-dark-pro"],
    langs: [props.lang],
  });

  return (
    <div className="relative w-full text-sm">
      {/* max-w-[calc(32rem-1.5rem-1.5rem)] */}
      {/* <div className=""> */}
      <p
        // tabIndex={1}
        className="[&>pre]:p-4 rounded-lg max-h-96 overflow-auto w-full"
        style={{
          overflowWrap: "break-word",
        }}
        dangerouslySetInnerHTML={{
          __html: highlighter.codeToHtml(props.code.trim(), {
            lang: props.lang,
            theme: "one-dark-pro",
          }),
        }}
      />
      {/* </div> */}
      <CopyButton className="absolute right-2 top-2" text={props.code} />
    </div>
  );
}
