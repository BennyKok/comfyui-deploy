import { LoadingIcon } from "@/components/LoadingIcon";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

export function LoadingWrapper(props: {
  tag: string;
  children?: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="w-full py-4 flex justify-center items-center gap-2 text-sm">
          Fetching {props.tag} <LoadingIcon />
        </div>
      }
    >
      {props.children}
    </Suspense>
  );
}

export function LoadingPageWrapper(props: {
  tag: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full py-4 flex justify-center items-center gap-2 text-sm",
        props.className
      )}
    >
      Fetching {props.tag} <LoadingIcon />
    </div>
  );
}
