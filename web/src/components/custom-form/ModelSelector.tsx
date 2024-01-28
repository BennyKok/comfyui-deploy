"use client";
import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import { LoadingIcon } from "@/components/LoadingIcon";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { useRef } from "react";
import { z } from "zod";
import { ModelListWrapper, Model, ModelList } from "./CivitalModelSchema";

export function ModelSelector({
  field,
  modelList,
  label,
  onSearch,
  shouldFilter = true,
  isLoading,
  selectMultiple = true,
}: Pick<AutoFormInputComponentProps, "field"> & {
  modelList?: z.infer<typeof ModelListWrapper>;
  label: string;
  onSearch?: (search: string) => void;
  shouldFilter?: boolean;
  isLoading?: boolean;
  selectMultiple?: boolean;
}) {
  const value = (field.value as z.infer<typeof ModelList>) ?? [];
  const [open, setOpen] = React.useState(false);

  function toggleModel(model: z.infer<typeof Model>) {
    const prevSelectedModels = value;
    if (
      prevSelectedModels.some(
        (selectedModel) =>
          selectedModel.url + selectedModel.name === model.url + model.name,
      )
    ) {
      field.onChange(
        prevSelectedModels.filter(
          (selectedModel) =>
            selectedModel.url + selectedModel.name !== model.url + model.name,
        ),
      );
    } else {
      if (!selectMultiple) {
        field.onChange([model]);
      } else {
        field.onChange([...prevSelectedModels, model]);
      }
    }
  }

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="" ref={containerRef}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between flex"
          >
            Add from {label}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[375px] p-0" side="bottom">
          <Command shouldFilter={shouldFilter}>
            <CommandInput
              placeholder="Search models..."
              className="h-9"
              onValueChange={onSearch}
            >
              {isLoading && <LoadingIcon />}
            </CommandInput>
            <CommandEmpty>No models found.</CommandEmpty>
            <CommandList className="pointer-events-auto">
              <CommandGroup>
                {modelList?.models.map((model) => (
                  <CommandItem
                    key={model.url + model.name}
                    value={model.url}
                    onSelect={() => {
                      toggleModel(model);
                    }}
                  >
                    {model.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value.some(
                          (selectedModel) => selectedModel.url === model.url,
                        )
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
