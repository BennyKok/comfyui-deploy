"use client";

import { callServerPromise } from "@/components/callServerPromise";
import { useEffect, useState, useTransition } from "react";

export function useServerActionData<I, O>(
  action: (data: I) => Promise<O>,
  input: I
) {
  const [data, setData] = useState<O | null>(null);
  const [pending, startTransition] = useTransition();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setStarted(true);
      callServerPromise(action(input)).then(setData);
    });
  }, [action, input]);

  return {
    started,
    data,
    pending,
  };
}
