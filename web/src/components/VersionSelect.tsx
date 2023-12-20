"use client";

import { callServerPromise } from "./callServerPromise";
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
import { createRun } from "@/server/createRun";
import { createDeployments } from "@/server/curdDeploments";
import type { getMachines } from "@/server/curdMachine";
import type { findFirstTableWithVersion } from "@/server/findFirstTableWithVersion";
import { MoreVertical, Play } from "lucide-react";
import { parseAsInteger, useQueryState } from "next-usequerystate";
import { useState } from "react";

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
        <SelectValue placeholder="Select a version" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Versions</SelectLabel>
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

const customInputNodes: Record<string, string> = {
  ComfyUIDeployExternalText: "string",
  ComfyUIDeployExternalImage: "string - image url",
};

export function VersionDetails({
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
    <div className="mt-4">
      Workflow Details
      <div className="border rounded-lg p-2">
        {workflow_version?.workflow_api && (
          <div>
            {Object.entries(workflow_version.workflow_api).map(
              ([key, value]) => {
                if (!value.class_type) return <> </>;
                const nodeType = customInputNodes[value.class_type];
                if (nodeType) {
                  const input_id = value.inputs.input_id;
                  const defaultValue = value.inputs.default_value;
                  return (
                    <>
                      <Badge variant="secondary">{input_id}</Badge> {nodeType}{" "}
                      {defaultValue}
                    </>
                  );
                }
                return <></>;
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
