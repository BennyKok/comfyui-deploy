"use client";

import { toast } from "sonner";

export async function callServerPromise<T>(result: Promise<T>, props?: {
  loadingText: string
}) {
  let id: string | number
  if (props?.loadingText) {
    id = toast.loading(props.loadingText)
  }
  return result
    .then((x) => {
      if ((x as { message: string })?.message !== undefined) {
        toast.success((x as { message: string }).message);
      } else if ((x as { error: string })?.error !== undefined) {
        toast.error((x as { error: string }).error);
      }
      return x;
    })
    .catch((error) => {
      toast.error(error.message);
      return null;
    }).finally(() => {
      if (id != undefined)
        toast.dismiss(id)
    });
}
