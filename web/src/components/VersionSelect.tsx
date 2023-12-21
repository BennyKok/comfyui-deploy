"use client";

import { getInputsFromWorkflow } from "../lib/getInputsFromWorkflow";
import { callServerPromise } from "./callServerPromise";
import { customInputNodes } from "./customInputNodes";
import { LoadingIcon } from "@/components/LoadingIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createRun } from "@/server/createRun";
import { createDeployments } from "@/server/curdDeploments";
import type { getMachines } from "@/server/curdMachine";
import type { findFirstTableWithVersion } from "@/server/findFirstTableWithVersion";
import { Copy, MoreVertical, Play } from "lucide-react";
import { parseAsInteger, useQueryState } from "next-usequerystate";
import { useState } from "react";
import { toast } from "sonner";

export function VersionSelect({
  workflow,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
}) {
  const [version, setVersion] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version?.toString() ?? "",
  });
  return (
    <Select
      value={version}
      onValueChange={(v) => {
        setVersion(v);
      }}
    >
      <SelectTrigger className="w-[100px]">
        <SelectValue placeholder="Select a version" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Versions</SelectLabel>
          {workflow?.versions.map((x) => (
            <SelectItem key={x.id} value={x.version?.toString() ?? ""}>
              {x.version}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function MachineSelect({
  machines,
}: {
  machines: Awaited<ReturnType<typeof getMachines>>;
}) {
  const [machine, setMachine] = useQueryState("machine", {
    defaultValue: machines?.[0].id ?? "",
  });
  return (
    <Select
      value={machine}
      onValueChange={(v) => {
        setMachine(v);
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a machine" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Machines</SelectLabel>
          {machines?.map((x) => (
            <SelectItem key={x.id} value={x.id ?? ""}>
              {x.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function RunWorkflowButton({
  workflow,
  machines,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
  machines: Awaited<ReturnType<typeof getMachines>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });
  const [machine] = useQueryState("machine", {
    defaultValue: machines[0].id ?? "",
  });
  const [isLoading, setIsLoading] = useState(false);
  return (
    <Button
      className="gap-2"
      disabled={isLoading}
      onClick={async () => {
        const workflow_version_id = workflow?.versions.find(
          (x) => x.version === version
        )?.id;
        if (!workflow_version_id) return;

        setIsLoading(true);
        try {
          const origin = window.location.origin;
          await callServerPromise(
            createRun(origin, workflow_version_id, machine, undefined, true)
          );
          // console.log(res.json());
          setIsLoading(false);
        } catch (error) {
          setIsLoading(false);
        }
      }}
    >
      Run {isLoading ? <LoadingIcon /> : <Play size={14} />}
    </Button>
  );
}

export function CreateDeploymentButton({
  workflow,
  machines,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
  machines: Awaited<ReturnType<typeof getMachines>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });
  const [machine] = useQueryState("machine", {
    defaultValue: machines[0].id ?? "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const workflow_version_id = workflow?.versions.find(
    (x) => x.version === version
  )?.id;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" disabled={isLoading} variant="outline">
          Deploy {isLoading ? <LoadingIcon /> : <MoreVertical size={14} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem
          onClick={async () => {
            if (!workflow_version_id) return;

            setIsLoading(true);
            await callServerPromise(
              createDeployments(
                workflow.id,
                workflow_version_id,
                machine,
                "production"
              )
            );
            setIsLoading(false);
          }}
        >
          Production
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            if (!workflow_version_id) return;

            setIsLoading(true);
            await callServerPromise(
              createDeployments(
                workflow.id,
                workflow_version_id,
                machine,
                "staging"
              )
            );
            setIsLoading(false);
          }}
        >
          Staging
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CopyWorkflowVersion({
  workflow,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });
  const workflow_version = workflow?.versions.find(
    (x) => x.version === version
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="outline">
          Copy Workflow <Copy size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem
          onClick={async () => {
            navigator.clipboard.writeText(
              JSON.stringify(workflow_version?.workflow)
            );
            toast("Copied to clipboard");
          }}
        >
          Copy (JSON)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            navigator.clipboard.writeText(
              JSON.stringify(workflow_version?.workflow_api)
            );
            toast("Copied to clipboard");
          }}
        >
          Copy API (JSON)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getWorkflowVersionFromVersionIndex(
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>,
  version: number
) {
  const workflow_version = workflow?.versions.find(
    (x) => x.version === version
  );

  return workflow_version;
}

export function VersionDetails({
  workflow,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
}) {
  const [version] = useQueryState("version", {
    defaultValue: workflow?.versions[0].version ?? 1,
    ...parseAsInteger,
  });
  const workflow_version = getWorkflowVersionFromVersionIndex(
    workflow,
    version
  );
  const inputs = getInputsFromWorkflow(workflow_version);
  return (
    <div className="mt-4">
      Workflow Details
      <div className="border rounded-lg p-2">
        {inputs && (
          <div className="flex flex-col gap-2">
            {inputs.map((value) => {
              if (!value || !value.class_type) return <> </>;
              const nodeType = customInputNodes[value.class_type];
              if (nodeType) {
                const input_id = value.input_id;
                const defaultValue = value.default_value;
                return (
                  <div key={input_id}>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="secondary">
                          <div>
                            {input_id}
                            {" : "}
                            <span className="text-orange-500">{nodeType}</span>
                          </div>
                        </Badge>
                        {/* {nodeType}{" "} */}
                        {/* <Button variant="outline">Hover</Button> */}
                      </TooltipTrigger>
                      <TooltipContent>
                        Default Value: {defaultValue}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              }
              return <></>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
