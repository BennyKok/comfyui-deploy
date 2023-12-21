import type { getWorkflowVersionFromVersionIndex } from "../components/VersionSelect";
import { customInputNodes } from "@/components/customInputNodes";

export function getInputsFromWorkflow(
  workflow_version: ReturnType<typeof getWorkflowVersionFromVersionIndex>
) {
  if (!workflow_version || !workflow_version.workflow_api) return null;
  return Object.entries(workflow_version.workflow_api)
    .map(([_, value]) => {
      if (!value.class_type) return undefined;
      const nodeType = customInputNodes[value.class_type];
      if (nodeType) {
        const input_id = value.inputs.input_id as string;
        const default_value = value.inputs.default_value as string;
        return {
          class_type: value.class_type,
          input_id,
          default_value,
        };
      }
      return undefined;
    })
    .filter((item) => item !== undefined);
}
