"use client";

import { LoadingIcon } from "@/components/LoadingIcon";
import { callServerPromise } from "@/components/callServerPromise";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ButtonAction({
  action,
  children,
  ...rest
}: {
  action: () => Promise<any>;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        if (pending) return;

        setPending(true);
        await callServerPromise(action());
        setPending(false);

        router.refresh();
      }}
      {...rest}
    >
      {children} {pending && <LoadingIcon />}
    </button>
  );
}
