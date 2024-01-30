"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { workflowAPINodeType } from "@/db/schema";
import type { findFirstTableWithVersion } from "@/server/findFirstTableWithVersion";
import { ExternalLink, Info } from "lucide-react";
import { parseAsInteger, useQueryState } from "next-usequerystate";
import { useMemo } from "react";
import useSWR from "swr";
import type { z } from "zod";
import fetcher from "./fetcher";
import { getWorkflowVersionFromVersionIndex } from "./VersionSelect";

export function ViewWorkflowDetailsButton({
  workflow,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });

  const {
    data,
    error,
    isLoading: isNodesIndexLoading,
  } = useSWR(
    "https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/extension-node-map.json",
    fetcher,
  );

  const groupedByAuxName = useMemo(() => {
    if (!data) return null;

    const workflow_version = getWorkflowVersionFromVersionIndex(
      workflow,
      version,
    );

    const api = workflow_version?.workflow_api;

    if (!api) return null;

    const crossCheckedApi = Object.entries(api)
      .map(([_, value]) => {
        const classType = value.class_type;
        const classTypeData = Object.entries(data).find(([_, nodeArray]) =>
          nodeArray[0].includes(classType),
        );
        return classTypeData ? { node: value, classTypeData } : null;
      })
      .filter((item) => item !== null);

    // console.log(crossCheckedApi);
    const groupedByAuxName = crossCheckedApi.reduce(
      (acc, data) => {
        if (!data) return acc;

        const { node, classTypeData } = data;
        const auxName = classTypeData[1][1].title_aux;
        // console.log(auxName);
        if (!acc[auxName]) {
          acc[auxName] = {
            url: classTypeData[0],
            node: [],
          };
        }
        acc[auxName].node.push(node);
        return acc;
      },
      {} as Record<
        string,
        {
          node: z.infer<typeof workflowAPINodeType>[];
          url: string;
        }
      >,
    );

    // console.log(groupedByAuxName);
    return groupedByAuxName;
  }, [version, data]);

  return (
    <Dialog>
      <DialogTrigger asChild className="appearance-none hover:cursor-pointer">
        <Button className="gap-2" variant="outline">
          Details <Info size={14} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Workflow Details</DialogTitle>
          <DialogDescription>
            View your custom nodes, models, external files used in this workflow
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto max-h-[400px] w-full">
          <Table>
            <TableHeader className="bg-background top-0 sticky">
              <TableRow>
                <TableHead className="w-[200px]">File</TableHead>
                <TableHead className="">Output</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByAuxName &&
                Object.entries(groupedByAuxName).map(([key, group]) => {
                  // const filePath
                  return (
                    <TableRow key={key}>
                      <TableCell className="break-words">
                        <a
                          href={group.url}
                          target="_blank"
                          className="hover:underline"
                          rel="noreferrer"
                        >
                          {key}
                          <ExternalLink
                            className="inline-block ml-1"
                            size={12}
                          />
                        </a>
                      </TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        {group.node.map((x) => (
                          <Badge key={x.class_type} variant="outline">
                            {x.class_type}
                          </Badge>
                        ))}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <DialogClose asChild>
            <Button className="w-fit">Close</Button>
          </DialogClose>
        </div>
        {/* </div> */}
        {/* <div className="max-h-96 overflow-y-scroll">{view}</div> */}
      </DialogContent>
    </Dialog>
  );
}
