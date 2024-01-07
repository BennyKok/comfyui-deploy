"use client";

import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { findAllDeployments } from "@/server/curdDeploments";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

export function SnapshotPickerView({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);

  const [frameworks, setFramework] = React.useState<
    {
      id: string;
      label: string;
      value: string;
    }[]
  >();

  React.useEffect(() => {
    findAllDeployments().then((a) => {
      console.log(a);

      const frameworks = a
        .map((item) => {
          if (
            item.deployments.length == 0 ||
            item.deployments[0].version.snapshot == null
          )
            return null;

          return {
            id: item.deployments[0].version.id,
            label: `${item.name} - ${item.deployments[0].environment}`,
            value: JSON.stringify(item.deployments[0].version.snapshot),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item != null);

      setFramework(frameworks);
    });
  }, []);

  function findItem(value: string) {
    // console.log(frameworks);

    return frameworks?.find((item) => item.id === value);
  }

  return (
    <div className="">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between flex"
          >
            {selected ? findItem(selected)?.label : "Select snapshot..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[375px] p-0">
          <Command>
            <CommandInput placeholder="Search framework..." className="h-9" />
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {frameworks?.map((framework) => (
                <CommandItem
                  key={framework.id}
                  value={framework.id}
                  onSelect={(currentValue) => {
                    setSelected(currentValue);
                    const json =
                      frameworks?.find((item) => item.id === currentValue)
                        ?.value ?? null;
                    field.onChange(json ? JSON.parse(json) : null);
                    setOpen(false);
                  }}
                >
                  {framework.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      field.value === framework.value
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      {field.value && (
        <ScrollArea className="w-full bg-gray-100 mx-auto max-w-[360px] rounded-lg mt-2">
          <div className="max-h-[200px]">
            <pre className="p-2 rounded-md text-xs ">
              {JSON.stringify(field.value, null, 2)}
            </pre>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
