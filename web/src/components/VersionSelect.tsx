"use client";

import { callServerPromise } from "./callServerPromise";
import { LoadingIcon } from "@/components/LoadingIcon";
import AutoForm, { AutoFormSubmit } from "@/components/ui/auto-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInputsFromWorkflow } from "@/lib/getInputsFromWorkflow";
import { createRun } from "@/server/createRun";
import { createDeployments } from "@/server/curdDeploments";
import type { getMachines } from "@/server/curdMachine";
import type { findFirstTableWithVersion } from "@/server/findFirstTableWithVersion";
import { Copy, MoreVertical, Play } from "lucide-react";
import { parseAsInteger, useQueryState } from "next-usequerystate";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

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

  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  const schema = useMemo(() => {
    const workflow_version = getWorkflowVersionFromVersionIndex(
      workflow,
      version
    );
    const inputs = getInputsFromWorkflow(workflow_version);

    if (!inputs) return null;

    return z.object({
      ...Object.fromEntries(
        inputs?.map((x) => {
          return [x?.input_id, z.string().optional()];
        })
      ),
    });
  }, [version]);

  const runWorkflow = async () => {
    console.log(values);

    const val = Object.keys(values).length > 0 ? values : undefined;

    const workflow_version_id = workflow?.versions.find(
      (x) => x.version === version
    )?.id;
    console.log(workflow_version_id);
    if (!workflow_version_id) return;

    setIsLoading(true);
    try {
      const origin = window.location.origin;
      await callServerPromise(
        createRun(origin, workflow_version_id, machine, val, true)
      );
      // console.log(res.json());
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="appearance-none hover:cursor-pointer">
        <Button className="gap-2" disabled={isLoading}>
          Run {isLoading ? <LoadingIcon /> : <Play size={14} />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Run inputs</DialogTitle>
          <DialogDescription>
            Run your workflow with custom inputs
          </DialogDescription>
        </DialogHeader>
        {/* <div className="max-h-96 overflow-y-scroll"> */}
        {schema && (
          <AutoForm
            formSchema={schema}
            values={values}
            onValuesChange={setValues}
            onSubmit={runWorkflow}
          >
            <div className="flex justify-end">
              <AutoFormSubmit>
                Run
                <span className="ml-2">
                  {isLoading ? <LoadingIcon /> : <Play size={14} />}
                </span>
              </AutoFormSubmit>
            </div>
          </AutoForm>
        )}
        {!schema && (
          <Button className="gap-2" disabled={isLoading} onClick={runWorkflow}>
            Confirm {isLoading ? <LoadingIcon /> : <Play size={14} />}
          </Button>
        )}
        {/* </div> */}
        {/* <div className="max-h-96 overflow-y-scroll">{view}</div> */}
      </DialogContent>
    </Dialog>
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
  const workflow_version = workflow?.versions.find((x) => x.version == version);

  return workflow_version;
}
