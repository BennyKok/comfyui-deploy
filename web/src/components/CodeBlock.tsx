import { CopyButton } from "@/components/CopyButton";
import type { Lang } from "shiki";
import shiki from "shiki";

export async function CodeBlock(props: { code: string; lang: Lang }) {
  const highlighter = await shiki.getHighlighter({
    theme: "one-dark-pro",
  });

  return (
    <div className="relative w-full max-w-full text-sm">
      {/* max-w-[calc(32rem-1.5rem-1.5rem)] */}
      {/* <div className=""> */}
      <p
        // tabIndex={1}
        className="[&>pre]:p-4 rounded-sm "
        style={{
          overflowWrap: "break-word",
        }}
        dangerouslySetInnerHTML={{
          __html: highlighter.codeToHtml(props.code.trim(), {
            lang: props.lang,
          }),
        }}
      />
      {/* </div> */}
      <CopyButton className="absolute right-2 top-2" text={props.code} />
    </div>
  );
}
