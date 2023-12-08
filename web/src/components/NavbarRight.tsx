"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

export function NavbarRight() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Tabs
      defaultValue={pathname.startsWith("/machines") ? "machines" : "workflow"}
      className="w-[200px]"
      onValueChange={(value) => {
        if (value === "machines") {
          router.push("/machines");
        } else {
          router.push("/");
        }
      }}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="workflow">Workflow</TabsTrigger>
        <TabsTrigger value="machines">Machines</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
