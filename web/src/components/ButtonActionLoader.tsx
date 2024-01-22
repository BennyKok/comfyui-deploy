"use client";

import { LoadingIcon } from "@/components/LoadingIcon";
import { callServerPromise } from "@/components/callServerPromise";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useClerk } from "@clerk/nextjs";
import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ButtonAction({
  action,
  children,
  routerAction = "back",
  ...rest
}: {
  action: () => Promise<any>;
  routerAction?: "refresh" | "back" | "do-nothing";
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

        if (routerAction === "back") {
          router.back();
          router.refresh();
        } else if (routerAction === "refresh") router.refresh();
      }}
      {...rest}
    >
      {children} {pending && <LoadingIcon />}
    </button>
  );
}

export function ButtonActionMenu(props: {
  title?: string;
  actions: {
    title: string;
    action: () => Promise<any>;
  }[];
}) {
  const user = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const clerk = useClerk();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="outline" disabled={isLoading}>
          {props.title}
          {isLoading ? <LoadingIcon /> : <MoreVertical size={14} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {props.actions.map((action) => (
          <DropdownMenuItem
            key={action.title}
            onClick={async () => {
              if (!user.isSignedIn) {
                clerk.openSignIn({
                  redirectUrl: window.location.href,
                });
                return;
              }

              setIsLoading(true);
              await callServerPromise(action.action());
              setIsLoading(false);
            }}
          >
            {action.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
