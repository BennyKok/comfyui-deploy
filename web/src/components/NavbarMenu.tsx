"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

export function NavbarMenu() {
  const pathnames = usePathname();
  const pathname = `/${pathnames.split("/")[1]}`;

  const router = useRouter();

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
  ];

  return (
    <div className="mr-2">
      {/* <div className="w-full h-full absolute inset-x-0 top-0 flex items-center justify-center pointer-events-none"> */}
      <Tabs
        defaultValue={pathname}
        className="w-[300px] hidden lg:flex pointer-events-auto"
        onValueChange={(value) => {
          router.push(value);
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          {pages.map((page) => (
            <TabsTrigger key={page.name} value={page.path}>
              {page.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {/* </div> */}

      <div className="w-[100px] flex lg:hidden">
        <Select
          defaultValue={pathname == "/" ? "" : pathname}
          onValueChange={(v) => {
            router.push(v);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Menu" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {pages.map((page, i) => (
                <SelectItem
                  key={page.name}
                  value={page.path}
                  defaultChecked={i == 0}
                >
                  {page.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
