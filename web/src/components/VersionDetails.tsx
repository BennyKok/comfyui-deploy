"use client";

import { getInputsFromWorkflow } from "../lib/getInputsFromWorkflow";
import { getWorkflowVersionFromVersionIndex } from "./VersionSelect";
import { customInputNodes } from "./customInputNodes";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { findFirstTableWithVersion } from "@/server/findFirstTableWithVersion";
import { parseAsInteger, useQueryState } from "next-usequerystate";

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
      Workflow Inputs
      <div className="border rounded-lg p-2">
        {inputs && inputs.length > 0 ? (
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
        ) : (
          <span className="text-sm">No external inputs</span>
        )}
      </div>
    </div>
  );
}
