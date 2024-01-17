"use client";

import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import fetcher from "@/components/fetcher";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { findAllDeployments } from "@/server/curdDeploments";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";

export function SnapshotPickerView({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger className="text-sm">Custom Nodes</AccordionTrigger>
        <AccordionContent className="flex gap-2 flex-col px-1">
          <SnapshotPresetPicker field={field} />
          <CustomNodesSelector field={field} />
          {field.value && (
            // <ScrollArea className="w-full bg-gray-100 mx-auto max-w-[500px] rounded-lg">
            <Textarea
              className="min-h-[150px] max-h-[300px] p-2 rounded-md text-xs w-full"
              value={JSON.stringify(field.value, null, 2)}
              onChange={(e) => {
                // Update field.onChange to pass the array of selected models
                field.onChange(JSON.parse(e.target.value));
              }}
            />
            // </ScrollArea>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function SnapshotPresetPicker({
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
      // console.log(a);

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
    return frameworks?.find((item) => item.id === value);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between flex"
        >
          {selected
            ? findItem(selected)?.label
            : "Select snapshot (From deployments)"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[375px] p-0">
        <Command>
          <CommandInput placeholder="Search snapshot..." className="h-9" />
          <CommandEmpty>No snapshot found.</CommandEmpty>
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
  );
}

type CustomNodeList = {
  custom_nodes: {
    author: string;
    title: string;
    reference: string;
    files: string[];
    install_type: string;
    description: string;
  }[];
};

const RepoSchema = z.object({
  default_branch: z.string(),
});

const BranchInfoSchema = z.object({
  commit: z.object({
    sha: z.string(),
  }),
});

function extractRepoName(repoUrl: string) {
  const url = new URL(repoUrl);
  const pathParts = url.pathname.split("/");
  const repoName = pathParts[2].replace(".git", "");
  const author = pathParts[1];
  return `${author}/${repoName}`;
}

function CustomNodesSelector({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  const [open, setOpen] = React.useState(false);

  const customNodeList =
    field.value.git_custom_nodes ??
    ({} as Record<
      string,
      {
        hash: string;
        disabled: boolean;
      }
    >);

  const { data, error, isLoading } = useSWR<CustomNodeList>(
    "https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/custom-node-list.json",
    fetcher
  );

  const keys = React.useMemo(
    () => Object.keys(customNodeList),
    [customNodeList, data]
  );

  function findItem(value: string) {
    // console.log(keys, value.toLowerCase());
    const included = keys.includes(value.toLowerCase());
    return included;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between flex"
        >
          Add custom nodes - {keys.length} selected
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[375px] p-0" side="bottom">
        <Command>
          <CommandInput placeholder="Search custom nodes..." className="h-9" />
          <CommandEmpty>No custom nodes found.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {data &&
                data.custom_nodes?.map((framework, index) => (
                  <CommandItem
                    key={index}
                    value={framework.reference}
                    onSelect={async (currentValue) => {
                      const repoName = extractRepoName(currentValue);

                      console.log(repoName);

                      const id = toast.loading(`Fetching repo info...`);
                      // toast.info("hi");

                      const repo = await fetch(
                        `https://api.github.com/repos/${repoName}`
                      )
                        .then((x) => x.json())
                        .then((x) => {
                          console.log(x);
                          return x;
                        })
                        .then((x) => RepoSchema.parse(x))
                        .catch((e) => {
                          console.error(e);
                          toast.dismiss(id);
                          toast.error(`Failed to fetch repo info ${e.message}`);
                          return null;
                        });

                      if (!repo) return;

                      const branch = repo.default_branch;

                      const branchInfo = await fetch(
                        `https://api.github.com/repos/${repoName}/branches/${branch}`
                      )
                        .then((x) => x.json())
                        .then((x) => BranchInfoSchema.parse(x))
                        .catch((e) => {
                          console.error(e);
                          toast.dismiss(id);
                          toast.error(
                            `Failed to fetch branch info ${e.message}`
                          );
                          return null;
                        });

                      toast.dismiss(id);

                      if (!branchInfo) return;

                      let nodeList: Record<
                        string,
                        {
                          hash: string;
                          disabled: boolean;
                        }
                      >;
                      const x = customNodeList;

                      if (x[currentValue]) {
                        const newNodeList = { ...x };
                        delete newNodeList[currentValue];
                        nodeList = newNodeList;
                      } else {
                        nodeList = {
                          [currentValue]: {
                            hash: branchInfo?.commit.sha,
                            disabled: false,
                          },
                          ...x,
                        };
                      }
                      field.onChange({
                        ...field.value,
                        git_custom_nodes: nodeList,
                      });
                    }}
                  >
                    {framework.title}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        findItem(framework.reference)
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
  );
}
