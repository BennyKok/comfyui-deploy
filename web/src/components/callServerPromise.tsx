"use client";

import { toast } from "sonner";

export async function callServerPromise<T>(result: Promise<T>) {
  return result
    .then((x) => {
      if ((x as { message: string })?.message !== undefined) {
        toast.success((x as { message: string }).message);
      }
      return x;
    })
    .catch((error) => {
      toast.error(error.message);
      return null;
    });
}
