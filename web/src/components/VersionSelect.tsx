"use client";

import type { findFirstTableWithVersion } from "@/app/[workflow_id]/page";
import { LoadingIcon } from "@/components/LoadingIcon";
import { Button } from "@/components/ui/button";
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
import type { getMachines } from "@/server/curdMachine";
import { Play } from "lucide-react";
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
      <SelectTrigger className="w-[180px]">
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
    defaultValue: machines[0].id ?? "",
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
          await createRun(origin, workflow_version_id, machine);
          setIsLoading(false);
        } catch (error) {
          setIsLoading(false);
        }
      }}
    >
      Run <Play size={14} /> {isLoading && <LoadingIcon />}
    </Button>
  );
}
