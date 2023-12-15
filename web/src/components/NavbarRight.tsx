"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

export function NavbarRight() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Tabs
      defaultValue={
        pathname.startsWith("/machines")
          ? "machines"
          : pathname.startsWith("/api-keys")
          ? "api-keys"
          : "workflow"
      }
      className="w-[300px]"
      onValueChange={(value) => {
        if (value === "machines") {
          router.push("/machines");
        } else if (value === "api-keys") {
          router.push("/api-keys");
        } else {
          router.push("/");
        }
      }}
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="workflow">Workflow</TabsTrigger>
        <TabsTrigger value="machines">Machines</TabsTrigger>
        <TabsTrigger value="api-keys">API Keys</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
