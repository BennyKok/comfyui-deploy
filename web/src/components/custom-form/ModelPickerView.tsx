"use client";

import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import { LoadingIcon } from "@/components/LoadingIcon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { useDebouncedCallback } from "use-debounce";
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

export const CivitalModelSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      description: z.string(),
      type: z.string(),
      // poi: z.boolean(),
      // nsfw: z.boolean(),
      // allowNoCredit: z.boolean(),
      // allowCommercialUse: z.string(),
      // allowDerivatives: z.boolean(),
      // allowDifferentLicense: z.boolean(),
      // stats: z.object({
      //   downloadCount: z.number(),
      //   favoriteCount: z.number(),
      //   commentCount: z.number(),
      //   ratingCount: z.number(),
      //   rating: z.number(),
      //   tippedAmountCount: z.number(),
      // }),
      creator: z
        .object({
          username: z.string().nullable(),
          image: z.string().nullable().default(null),
        })
        .nullable(),
      tags: z.array(z.string()),
      modelVersions: z.array(
        z.object({
          id: z.number(),
          modelId: z.number(),
          name: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          status: z.string(),
          publishedAt: z.string(),
          trainedWords: z.array(z.unknown()),
          trainingStatus: z.string().nullable(),
          trainingDetails: z.string().nullable(),
          baseModel: z.string(),
          baseModelType: z.string().nullable(),
          earlyAccessTimeFrame: z.number(),
          description: z.string().nullable(),
          vaeId: z.number().nullable(),
          stats: z.object({
            downloadCount: z.number(),
            ratingCount: z.number(),
            rating: z.number(),
          }),
          files: z.array(
            z.object({
              id: z.number(),
              sizeKB: z.number(),
              name: z.string(),
              type: z.string(),
              // metadata: z.object({
              //   fp: z.string().nullable().optional(),
              //   size: z.string().nullable().optional(),
              //   format: z.string().nullable().optional(),
              // }),
              // pickleScanResult: z.string(),
              // pickleScanMessage: z.string(),
              // virusScanResult: z.string(),
              // virusScanMessage: z.string().nullable(),
              // scannedAt: z.string(),
              // hashes: z.object({
              //   AutoV1: z.string().nullable().optional(),
              //   AutoV2: z.string().nullable().optional(),
              //   SHA256: z.string().nullable().optional(),
              //   CRC32: z.string().nullable().optional(),
              //   BLAKE3: z.string().nullable().optional(),
              // }),
              downloadUrl: z.string(),
              // primary: z.boolean().default(false),
            })
          ),
          images: z.array(
            z.object({
              id: z.number(),
              url: z.string(),
              nsfw: z.string(),
              width: z.number(),
              height: z.number(),
              hash: z.string(),
              type: z.string(),
              metadata: z.object({
                hash: z.string(),
                width: z.number(),
                height: z.number(),
              }),
              meta: z.any(),
            })
          ),
          downloadUrl: z.string(),
        })
      ),
    })
  ),
  metadata: z.object({
    totalItems: z.number(),
    currentPage: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
    nextPage: z.string().optional(),
  }),
});

const ModelList = z.array(Model);

export const ModelListWrapper = z.object({
  models: ModelList,
});

export function ModelPickerView({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger className="text-sm">
          Models (ComfyUI Manager & Civitai)
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex gap-2 flex-col px-1">
            <ComfyUIManagerModelRegistry field={field} />
            <CivitaiModelRegistry field={field} />
            {/* <span>{field.value.length} selected</span> */}
            {field.value && (
              <ScrollArea className="w-full bg-gray-100 mx-auto rounded-lg mt-2">
                <Textarea
                  className="min-h-[150px] max-h-[300px] p-2 rounded-lg text-xs w-full"
                  value={JSON.stringify(field.value, null, 2)}
                  onChange={(e) => {
                    field.onChange(JSON.parse(e.target.value));
                  }}
                />
              </ScrollArea>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function mapType(type: string) {
  switch (type) {
    case "checkpoint":
      return "checkpoints";
  }
  return type;
}

function mapModelsList(
  models: z.infer<typeof CivitalModelSchema>
): z.infer<typeof ModelListWrapper> {
  return {
    models: models.items.flatMap((item) => {
      return item.modelVersions.map((v) => {
        return {
          name: `${item.name} ${v.name} (${v.files[0].name})`,
          type: mapType(item.type.toLowerCase()),
          base: v.baseModel,
          save_path: "default",
          description: item.description,
          reference: "",
          filename: v.files[0].name,
          url: v.files[0].downloadUrl,
        } as z.infer<typeof Model>;
      });
    }),
  };
}

function getUrl(search?: string) {
  const baseUrl = "https://civitai.com/api/v1/models";
  const searchParams = {
    limit: 5,
  } as any;
  searchParams["sort"] = "Most Downloaded";

  if (search) {
    searchParams["query"] = search;
  } else {
    // sort: "Highest Rated",
  }

  const url = new URL(baseUrl);
  Object.keys(searchParams).forEach((key) =>
    url.searchParams.append(key, searchParams[key])
  );

  return url;
}

export function CivitaiModelRegistry({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  const [modelList, setModelList] =
    React.useState<z.infer<typeof ModelListWrapper>>();

  const [loading, setLoading] = React.useState(false);

  const handleSearch = useDebouncedCallback((search) => {
    console.log(`Searching... ${search}`);

    setLoading(true);

    const controller = new AbortController();
    fetch(getUrl(search), {
      signal: controller.signal,
    })
      .then((x) => x.json())
      .then((a) => {
        const list = CivitalModelSchema.parse(a);
        console.log(a);

        setModelList(mapModelsList(list));
        setLoading(false);
      });

    return () => {
      controller.abort();
      setLoading(false);
    };
  }, 300);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(getUrl(), {
      signal: controller.signal,
    })
      .then((x) => x.json())
      .then((a) => {
        const list = CivitalModelSchema.parse(a);
        setModelList(mapModelsList(list));
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <ModelSelector
      field={field}
      modelList={modelList}
      label="Civitai"
      onSearch={handleSearch}
      shouldFilter={false}
      isLoading={loading}
    />
  );
}

export function ComfyUIManagerModelRegistry({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  const [modelList, setModelList] =
    React.useState<z.infer<typeof ModelListWrapper>>();

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

  return (
    <ModelSelector
      field={field}
      modelList={modelList}
      label="ComfyUI Manager"
    />
  );
}

export function ModelSelector({
  field,
  modelList,
  label,
  onSearch,
  shouldFilter = true,
  isLoading,
}: Pick<AutoFormInputComponentProps, "field"> & {
  modelList?: z.infer<typeof ModelListWrapper>;
  label: string;
  onSearch?: (search: string) => void;
  shouldFilter?: boolean;
  isLoading?: boolean;
}) {
  const value = (field.value as z.infer<typeof ModelList>) ?? [];
  const [open, setOpen] = React.useState(false);

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
    </div>
  );
}
