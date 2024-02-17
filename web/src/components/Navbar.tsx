"use client";

import { NavbarMenu } from "@/components/NavbarMenu";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  OrganizationList,
  OrganizationSwitcher,
  UserButton,
  useOrganization,
} from "@clerk/nextjs";
import { Github, Menu } from "lucide-react";
import meta from "next-gen/config";
import { useEffect, useState } from "react";
import { useMediaQuery } from "usehooks-ts";

export function Navbar() {
  const { organization } = useOrganization();
  const _isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isDesktop, setIsDesktop] = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    setIsDesktop(_isDesktop);
  }, [_isDesktop]);
  return (
    <>
      <div className="flex flex-row items-center gap-4">
        {!isDesktop && (
          <Sheet open={isSheetOpen} onOpenChange={(open) => setSheetOpen(open)}>
            <SheetTrigger asChild>
              <button className="flex items-center justify-center w-8 h-8 p-2">
                <Menu />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col gap-4">
              <SheetHeader>
                <SheetTitle className="text-start">Comfy Deploy</SheetTitle>
              </SheetHeader>
              <div className="grid h-full grid-rows-[1fr_auto]">
                <NavbarMenu
                  className=" h-full"
                  closeSheet={() => setSheetOpen(false)}
                />
                {/* <OrganizationSwitcher
                  appearance={{
                    elements: {
                      rootBox: "flex items-center justify-center  z-[50]",
                    },
                  }}
                /> */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      Organization
                      {organization?.name && ` (${organization?.name})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 border-0 bg-none shadow-none">
                    <OrganizationList />
                  </PopoverContent>
                </Popover>
              </div>
            </SheetContent>
          </Sheet>
        )}
        <a className="font-bold text-md md:text-lg hover:underline" href="/">
          {meta.name}
        </a>
        {isDesktop && (
          <OrganizationSwitcher
            appearance={{
              elements: {
                rootBox: "flex items-center justify-center",
              },
            }}
          />
        )}
      </div>
      <div className="flex flex-row items-center gap-2">
        {isDesktop && <NavbarMenu />}
        <Button
          asChild
          variant="link"
          className="rounded-full aspect-square p-2 mr-4"
        >
          <a href="/docs">Docs</a>
        </Button>
        <UserButton />
        <Button
          asChild
          variant="outline"
          className="rounded-full aspect-square p-2"
        >
          <a target="_blank" href="https://github.com/BennyKok/comfyui-deploy" rel="noreferrer">
            <Github />
          </a>
        </Button>
      </div>
    </>
  );
}
