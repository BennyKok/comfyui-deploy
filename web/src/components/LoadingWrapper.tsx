'use cient'
import { LoadingIcon } from "@/components/LoadingIcon";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Suspense } from "react";

export function LoadingWrapper(props: {
  tag: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("LoadingWrapper")
  return (
    <Suspense
      fallback={
        <div className="w-full py-4 flex justify-center items-center gap-2 text-sm">
          {t("Fetching")} {props.tag} <LoadingIcon />
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
  const t = useTranslations("LoadingWrapper")
  return (
    <div
      className={cn(
        "w-full py-4 flex justify-center items-center gap-2 text-sm",
        props.className
      )}
    >
      {t("Fetching")} {props.tag} <LoadingIcon />
    </div>
  );
}
