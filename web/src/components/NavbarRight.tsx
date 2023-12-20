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

export function NavbarRight() {
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
    <div>
      <Tabs
        defaultValue={pathname}
        className="w-[300px] hidden lg:flex"
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
