"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMediaQuery } from "usehooks-ts";

export function NavbarMenu({
  className,
  closeSheet,
}: {
  className?: string;
  closeSheet?: () => void;
}) {
  const _isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    setIsDesktop(_isDesktop);
  }, [_isDesktop]);

  const pathnames = usePathname();
  const pathname = `/${pathnames.split("/")[1]}`;

  const pages = [
    {
      name: "Workflows",
      path: "/workflows",
    },
    {
      name: "Machines",
      path: "/machines",
    },
    {
      name: "API Keys",
      path: "/api-keys",
    },
    {
      name: "Examples",
      path: "/examples"
    }
  ];

  return (
    <div className={cn("mr-2", className)}>
      {/* <div className="w-full h-full absolute inset-x-0 top-0 flex items-center justify-center pointer-events-none"> */}
      {isDesktop && (
        <Tabs
          defaultValue={pathname}
          className="w-fit flex pointer-events-auto"
        >
          <TabsList className="w-full">
            {pages.map((page) => (
              <TabsTrigger
                key={page.name}
                value={page.path}
              >
                <Link href={page.path}>{page.name}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {/* </div> */}

      {!isDesktop && (
        <ScrollArea>
          <div className="w-full flex flex-col h-full">
            {pages.map((page) => (
              <Link
                key={page.name}
                href={page.path}
                onClick={() => {
                  if (!!closeSheet) closeSheet();
                }}
                className="p-2 hover:bg-gray-100/20 hover:underline"
              >
                {page.name}
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
