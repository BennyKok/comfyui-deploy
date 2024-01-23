import { CodeBlock } from "@/components/CodeBlock";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInputsFromWorkflow } from "@/lib/getInputsFromWorkflow";
import type { findAllDeployments } from "@/server/findAllRuns";
import { DeploymentRow, SharePageDeploymentRow } from "./DeploymentRow";

const curlTemplate = `
curl --request POST \
  --url <URL> \
  --header "Content-Type: application/json" \
  --data "{
  "deployment_id": "<ID>"
}"
`;

const curlTemplate_checkStatus = `
curl --request GET \
  --url "<URL>/api/run?run_id=xxx" \
  --header "Content-Type: application/json"
`;

const jsTemplate = `
const { run_id } = await fetch("<URL>", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + process.env.COMFY_DEPLOY_API_KEY,
  },
  body: JSON.stringify({
    deployment_id: "<ID>",
    inputs: {}
  }),
}).then(response => response.json())
`;

const jsTemplate_checkStatus = `
const run_id = "<RUN_ID>";

const output = fetch("<URL>?run_id=" + run_id, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + process.env.COMFY_DEPLOY_API_KEY,
  },
}).then(response => response.json())
`;

const jsClientSetupTemplate = `
const client = new ComfyDeployClient({
  apiBase: "<URLONLY>",
  apiToken: process.env.COMFY_DEPLOY_API_KEY!,
});
`;

const jsClientSetupTemplateHostedVersion = `
const client = new ComfyDeployClient({
  apiToken: process.env.COMFY_DEPLOY_API_KEY!,
});
`;

const jsClientCreateRunTemplate = `
const { run_id } = await client.run("<ID>", {
  inputs: {}
});
`;

const jsClientCreateRunNoInputsTemplate = `
const { run_id } = await client.run("<ID>");
`;

const clientTemplate_checkStatus = `
const run = await client.getRun(run_id);
`;

export function DeploymentDisplay({
  deployment,
  domain,
}: {
  deployment: Awaited<ReturnType<typeof findAllDeployments>>[0];
  domain: string;
}) {
  const workflowInput = getInputsFromWorkflow(deployment.version);

  if (deployment.environment === "public-share") {
    return <SharePageDeploymentRow deployment={deployment} />;
  }

  return (
    <Dialog>
      <DialogTrigger asChild className="appearance-none hover:cursor-pointer">
        <TableRow>
          <DeploymentRow deployment={deployment} />
        </TableRow>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {deployment.environment} Deployment
          </DialogTitle>
          <DialogDescription>Code for your deployment client</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[600px] pr-4">
          <Tabs defaultValue="client" className="w-full gap-2 text-sm">
            <TabsList className="grid w-fit grid-cols-3 mb-2">
              <TabsTrigger value="client">Server Client</TabsTrigger>
              <TabsTrigger value="js">NodeJS Fetch</TabsTrigger>
              <TabsTrigger value="curl">CURL</TabsTrigger>
            </TabsList>
            <TabsContent className="flex flex-col gap-2 !mt-0" value="client">
              <div>
                Copy and paste the ComfyDeployClient form&nbsp;
                <a
                  href="https://github.com/BennyKok/comfyui-deploy-next-example/blob/main/src/lib/comfy-deploy.ts"
                  className="text-blue-500 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  here
                </a>
              </div>
              <CodeBlock
                lang="js"
                code={formatCode(
                  domain == "https://www.comfydeploy.com"
                    ? jsClientSetupTemplateHostedVersion
                    : jsClientSetupTemplate,
                  deployment,
                  domain,
                  workflowInput,
                )}
              />
              Create a run via deployment id
              <CodeBlock
                lang="js"
                code={formatCode(
                  workflowInput && workflowInput.length > 0
                    ? jsClientCreateRunTemplate
                    : jsClientCreateRunNoInputsTemplate,
                  deployment,
                  domain,
                  workflowInput,
                )}
              />
              Check the status of the run, and retrieve the outputs
              <CodeBlock
                lang="js"
                code={formatCode(
                  clientTemplate_checkStatus,
                  deployment,
                  domain,
                )}
              />
            </TabsContent>
            <TabsContent className="flex flex-col gap-2 !mt-0" value="js">
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
            <TabsContent className="flex flex-col gap-2 !mt-2" value="curl">
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function formatCode(
  codeTemplate: string,
  deployment: Awaited<ReturnType<typeof findAllDeployments>>[0],
  domain: string,
  inputs?: ReturnType<typeof getInputsFromWorkflow>,
  inputsTabs?: number,
) {
  if (inputs && inputs.length > 0) {
    codeTemplate = codeTemplate.replace(
      "inputs: {}",
      `inputs: ${JSON.stringify(
        Object.fromEntries(
          inputs.map((x) => {
            return [x?.input_id, ""];
          }),
        ),
        null,
        2,
      )
        .split("\n")
        .map((line, index) => (index === 0 ? line : `    ${line}`)) // Add two spaces indentation except for the first line
        .join("\n")}`,
    );
  } else {
    codeTemplate = codeTemplate.replace(
      `
    inputs: {}`,
      "",
    );
  }
  return codeTemplate
    .replace("<URL>", `${domain ?? "http://localhost:3000"}/api/run`)
    .replace("<ID>", deployment.id)
    .replace("<URLONLY>", domain ?? "http://localhost:3000");
}
