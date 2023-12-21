import { CodeBlock } from "@/components/CodeBlock";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInputsFromWorkflow } from "@/lib/getInputsFromWorkflow";
import { getRelativeTime } from "@/lib/getRelativeTime";
import type { findAllDeployments } from "@/server/findAllRuns";
import { headers } from "next/headers";

const curlTemplate = `
curl --request POST \
  --url <URL> \
  --header 'Content-Type: application/json' \
  --data '{
  "deployment_id": "<ID>"
}'
`;

const curlTemplate_checkStatus = `
curl --request GET \
  --url 'http://localhost:3000/api/run?run_id=xxx' \
  --header 'Content-Type: application/json'
`;

const jsTemplate = `
const { run_id } = await fetch('<URL>', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.COMFY_DEPLOY_API_KEY,
  },
  body: JSON.stringify({
    deployment_id: '<ID>',
    inputs: {}
  }),
}).then(response => response.json())
`;

const jsTemplate_checkStatus = `
const run_id = '<RUN_ID>';

const output = fetch('<URL>?run_id=' + run_id, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.COMFY_DEPLOY_API_KEY,
  },
}).then(response => response.json())
`;

export function DeploymentDisplay({
  deployment,
}: {
  deployment: Awaited<ReturnType<typeof findAllDeployments>>[0];
}) {
  const headersList = headers();
  const host = headersList.get("host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "";
  const domain = `${protocol}://${host}`;

  const workflowInput = getInputsFromWorkflow(deployment.version);

  return (
    <Dialog>
      <DialogTrigger asChild className="appearance-none hover:cursor-pointer">
        <TableRow>
          <TableCell className="capitalize">{deployment.environment}</TableCell>
          <TableCell className="font-medium">
            {deployment.version?.version}
          </TableCell>
          <TableCell className="font-medium">
            {deployment.machine?.name}
          </TableCell>
          <TableCell className="text-right">
            {getRelativeTime(deployment.updated_at)}
          </TableCell>
        </TableRow>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {deployment.environment} Deployment
          </DialogTitle>
          <DialogDescription>Code for your deployment client</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="js" className="w-full">
          <TabsList className="grid w-fit grid-cols-2">
            <TabsTrigger value="js">js</TabsTrigger>
            <TabsTrigger value="curl">curl</TabsTrigger>
          </TabsList>
          <TabsContent className="flex flex-col gap-2" value="js">
            Trigger the workflow
            <CodeBlock
              lang="js"
              code={formatCode(jsTemplate, deployment, domain, workflowInput)}
            />
            Check the status of the run, and retrieve the outputs
            <CodeBlock
              lang="js"
              code={formatCode(jsTemplate_checkStatus, deployment, domain)}
            />
          </TabsContent>
          <TabsContent className="flex flex-col gap-2" value="curl">
            <CodeBlock
              lang="bash"
              code={formatCode(curlTemplate, deployment, domain)}
            />
            <CodeBlock
              lang="bash"
              code={formatCode(curlTemplate_checkStatus, deployment, domain)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function formatCode(
  codeTemplate: string,
  deployment: Awaited<ReturnType<typeof findAllDeployments>>[0],
  domain: string,
  inputs?: ReturnType<typeof getInputsFromWorkflow>
) {
  if (inputs && inputs.length > 0) {
    codeTemplate = codeTemplate.replace(
      "inputs: {}",
      `inputs: ${JSON.stringify(
        Object.fromEntries(
          inputs.map((x) => {
            return [x?.input_id, ""];
          })
        ),
        null,
        2
      )
        .split("\n")
        .map((line, index) => (index === 0 ? line : `    ${line}`)) // Add two spaces indentation except for the first line
        .join("\n")}`
    );
  } else {
    codeTemplate = codeTemplate.replace(
      `
    inputs: {}`,
      ""
    );
  }
  return codeTemplate
    .replace("<URL>", `${domain ?? "http://localhost:3000"}/api/run`)
    .replace("<ID>", deployment.id);
}
