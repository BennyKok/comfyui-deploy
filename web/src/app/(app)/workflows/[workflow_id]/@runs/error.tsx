"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// Error components must be Client Components
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error?: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.log(error?.message);
  }, [error]);

  return (
    <div className="border rounded-2xl flex flex-col w-full gap-20 justify-center items-center">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            <div className="text-2xl">Something went wrong!</div>
          </CardTitle>
          <CardDescription
            suppressHydrationWarning={true}
            className="flex flex-col gap-4"
          >
            <div className="text-lg">{error?.message}</div>
            <Button
              className="w-full"
              onClick={
                // Attempt to recover by trying to re-render the segment
                () => reset?.()
              }
            >
              Try again
            </Button>
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
