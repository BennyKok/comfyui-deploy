"use client";

import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import fetcher from "@/components/fetcher";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { findAllDeployments } from "@/server/curdDeploments";
import {
  Check,
  ChevronsUpDown,
  Edit,
  ExternalLink,
  FolderInput,
  MoreVertical,
  Plus,
} from "lucide-react";
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
          <div className="flex flex-wrap gap-2 justify-end">
            <CustomNodesSelector field={field} />
            <SnapshotPresetPicker field={field} />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-fit">
                  Edit <Edit size={14}></Edit>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] h-full max-h-[600px] grid grid-rows-[auto,1fr,auto]">
                <DialogHeader>
                  <DialogTitle>Edit custom nodes</DialogTitle>
                  <DialogDescription>
                    Make advacne changes to the snapshots
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  className="h-full p-2 max-h-[600px] rounded-md text-xs w-full"
                  value={JSON.stringify(field.value, null, 2)}
                  onChange={(e) => {
                    // Update field.onChange to pass the array of selected models
                    field.onChange(JSON.parse(e.target.value));
                  }}
                />
                <DialogFooter>
                  <DialogClose>
                    <Button type="button" variant="secondary">
                      Close
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {field.value && (
            <div className="flex gap-2 flex-col">
              {Object.entries(field.value.git_custom_nodes).map(
                ([key, item], index) => (
                  <Card className="p-4 flex gap-4 items-center justify-between">
                    <div className="flex gap-4 items-center">
                      <div className="bg-gray-200 aspect-square w-6 h-6 rounded-full text-center">
                        {index + 1}
                      </div>
                      <div>
                        <a
                          target="_blank"
                          href={key}
                          className="hover:underline flex items-center gap-2"
                          rel="noreferrer"
                        >
                          <ExternalLink size={12} /> {key}
                        </a>
                        <div className="text-2xs text-primary/50">
                          {item.hash}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild type="button">
                        <Button type="button" variant={"ghost"}>
                          <MoreVertical size={12} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          disabled={key.endsWith("comfyui-deploy.git")}
                          // className="opacity-50"
                          onClick={() => {
                            const newNodeList = {
                              ...field.value.git_custom_nodes,
                            };
                            delete newNodeList[key];
                            const nodeList = newNodeList;
                            const newValue = {
                              ...field.value,
                              git_custom_nodes: nodeList,
                            };
                            field.onChange(newValue);
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Card>
                ),
              )}
            </div>
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

  const [frameworks, setFramework] =
    React.useState<
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
          className="w-fit justify-between flex"
        >
          <FolderInput size={14} />
          Import
          {/* {selected
            ? findItem(selected)?.label
            : "Select snapshot (From deployments)"} */}
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
                      : "opacity-0",
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
    pip: string[];
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
    fetcher,
  );

  const keys = React.useMemo(
    () => Object.keys(customNodeList),
    [customNodeList, data],
  );

  function findItem(value: string) {
    // console.log(keys, value.toLowerCase());
    const included = keys.includes(value.toLowerCase());
    return included;
  }

  const onChangeRef = React.useRef(field.onChange);
  React.useEffect(() => {
    onChangeRef.current = field.onChange;
  }, [field.onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-fit justify-between flex"
        >
          <Plus size={14}></Plus> <Badge>{keys.length} </Badge>
          {/* <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /> */}
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
                      let nodeList: Record<
                        string,
                        {
                          hash: string;
                          disabled: boolean;
                          pip?: string[];
                        }
                      >;
                      const x = customNodeList;

                      if (x[currentValue]) {
                        const newNodeList = { ...x };
                        delete newNodeList[currentValue];
                        nodeList = newNodeList;
                      } else {
                        const repoName = extractRepoName(currentValue);
                        const id = toast.loading(`Fetching repo info...`);
                        const repo = await fetch(
                          `https://api.github.com/repos/${repoName}`,
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
                            toast.error(
                              `Failed to fetch repo info ${e.message}`,
                            );
                            return null;
                          });

                        if (!repo) return;
                        const branch = repo.default_branch;
                        const branchInfo = await fetch(
                          `https://api.github.com/repos/${repoName}/branches/${branch}`,
                        )
                          .then((x) => x.json())
                          .then((x) => BranchInfoSchema.parse(x))
                          .catch((e) => {
                            console.error(e);
                            toast.dismiss(id);
                            toast.error(
                              `Failed to fetch branch info ${e.message}`,
                            );
                            return null;
                          });

                        toast.dismiss(id);

                        if (!branchInfo) return;

                        const value: Record<string, any> = {
                          hash: branchInfo?.commit.sha,
                          disabled: false,
                        };

                        if (framework.pip) {
                          value["pip"] = framework.pip;
                        }

                        nodeList = {
                          ...x,
                          [currentValue]: value,
                        };
                      }

                      const newValue = {
                        ...field.value,
                        git_custom_nodes: nodeList,
                      };

                      field.onChange(newValue);
                    }}
                  >
                    {framework.title}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        findItem(framework.reference)
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
  );
}
