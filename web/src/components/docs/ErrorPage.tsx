"use client";

import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
// Error components must be Client Components
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.log(error.message);
  }, [error]);

  return (
    <div className="border rounded-2xl flex flex-col w-full h-full gap-20 justify-center items-center text-xs">
      <div className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>
            <div className="text-xl">Unexpected error.</div>
          </CardTitle>
          <CardDescription className="flex flex-col gap-4">
            <div className="text-sm">Error: {error.message}</div>
            <div className="flex w-full justify-end">
              <Button
                className="w-fit"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Refresh Page
              </Button>
            </div>
          </CardDescription>
        </CardHeader>
      </div>
    </div>
  );
}

export function ErrorFullPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className={cn(
        "w-full py-4 flex justify-center items-center gap-2 text-sm h-full"
      )}
    >
      <ErrorPage error={error} reset={reset} />
    </div>
  );
}
