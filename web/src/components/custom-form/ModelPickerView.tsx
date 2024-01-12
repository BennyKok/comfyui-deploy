"use client";

import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { useRef } from "react";
import { z } from "zod";

const Model = z.object({
  name: z.string(),
  type: z.string(),
  base: z.string(),
  save_path: z.string(),
  description: z.string(),
  reference: z.string(),
  filename: z.string(),
  url: z.string(),
});

const ModelList = z.array(Model);

export const ModelListWrapper = z.object({
  models: ModelList,
});

export function ModelPickerView({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  const value = (field.value as z.infer<typeof ModelList>) ?? [];

  const [open, setOpen] = React.useState(false);

  const [modelList, setModelList] =
    React.useState<z.infer<typeof ModelListWrapper>>();

  // const [selectedModels, setSelectedModels] = React.useState<
  //   z.infer<typeof ModelList>
  // >(field.value ?? []);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(
      "https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/model-list.json",
      {
        signal: controller.signal,
      }
    )
      .then((x) => x.json())
      .then((a) => {
        setModelList(ModelListWrapper.parse(a));
      });

    return () => {
      controller.abort();
    };
  }, []);

  function toggleModel(model: z.infer<typeof Model>) {
    const prevSelectedModels = value;
    if (
      prevSelectedModels.some(
        (selectedModel) =>
          selectedModel.url + selectedModel.name === model.url + model.name
      )
    ) {
      field.onChange(
        prevSelectedModels.filter(
          (selectedModel) =>
            selectedModel.url + selectedModel.name !== model.url + model.name
        )
      );
    } else {
      field.onChange([...prevSelectedModels, model]);
    }
  }

  // React.useEffect(() => {
  //   field.onChange(selectedModels);
  // }, [selectedModels]);

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
            Select models... ({value.length} selected)
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[375px] p-0" side="top">
          <Command>
            <CommandInput placeholder="Search models..." className="h-9" />
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandList className="pointer-events-auto">
              <CommandGroup>
                {modelList?.models.map((model) => (
                  <CommandItem
                    key={model.url + model.name}
                    value={model.url}
                    onSelect={() => {
                      toggleModel(model);
                      // Update field.onChange to pass the array of selected models
                    }}
                  >
                    {model.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value.some(
                          (selectedModel) => selectedModel.url === model.url
                        )
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {field.value && (
        <ScrollArea className="w-full bg-gray-100 mx-auto rounded-lg mt-2">
          {/* <div className="max-h-[200px]">
            <pre className="p-2 rounded-md text-xs ">
              {JSON.stringify(field.value, null, 2)}
            </pre>
          </div> */}
          <Textarea
            className="min-h-[150px] max-h-[300px] p-2 rounded-md text-xs w-full"
            value={JSON.stringify(field.value, null, 2)}
            onChange={(e) => {
              // Update field.onChange to pass the array of selected models
              field.onChange(JSON.parse(e.target.value));
            }}
          />
        </ScrollArea>
      )}
    </div>
  );
}
