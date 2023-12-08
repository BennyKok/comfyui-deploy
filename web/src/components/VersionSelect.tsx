"use client";

import { findFirstTableWithVersion } from "@/app/[workflow_id]/page";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMachines } from "@/server/curdMachine";

export function VersionSelect({
  workflow,
}: {
  workflow: Awaited<ReturnType<typeof findFirstTableWithVersion>>;
}) {
  return (
    <Select defaultValue={workflow?.versions[0].version?.toString()}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a version" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Versions</SelectLabel>
          {workflow?.versions.map((x) => (
            <SelectItem value={x.version?.toString() ?? ""}>
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
    return (
      <Select defaultValue={machines[0].id}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select a version" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Versions</SelectLabel>
            {machines?.map((x) => (
              <SelectItem value={x.id ?? ""}>
                {x.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }
  