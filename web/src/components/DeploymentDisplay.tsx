import { ButtonAction } from "@/components/ButtonActionLoader";
import { CodeBlock } from "@/components/CodeBlock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInputsFromWorkflow } from "@/lib/getInputsFromWorkflow";
import { getRelativeTime } from "@/lib/getRelativeTime";
import { removePublicShareDeployment } from "@/server/curdDeploments";
import type { findAllDeployments } from "@/server/findAllRuns";
import { ExternalLink } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

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

const clientTemplate = `
const client = new ComfyDeployClient({
  apiBase: "<URLONLY>",
  apiToken: process.env.COMFY_DEPLOY_API_KEY!,
});

export async function generateTextures(scrImageId: string) {
  const result = await client.run("<ID>", {
    input_image: "",
  });
  if (!result || !result.run_id) return { error: "run id not found" };
  return { id: result.run_id };
}
`;

const clientTemplate_checkStatus = `
const run_id = "<RUN_ID>";

while (true) {
  const run = await client.getRun(run_id);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  
  if (!run) continue;
  run.outputs.map((val) => {
    if (!val.data.image) return;
  });
}

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
          <TableCell className="capitalize truncate">
            {deployment.environment}
          </TableCell>
          <TableCell className="font-medium truncate">
            {deployment.version?.version}
          </TableCell>
          <TableCell className="font-medium truncate">
            {deployment.machine?.name}
          </TableCell>
          <TableCell className="text-right truncate">
            {getRelativeTime(deployment.updated_at)}
          </TableCell>
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
          {deployment.environment !== "public-share" ? (
            <Tabs defaultValue="client" className="w-full gap-2">
              <TabsList className="grid w-fit grid-cols-3">
                <TabsTrigger value="client">client</TabsTrigger>
                <TabsTrigger value="js">js</TabsTrigger>
                <TabsTrigger value="curl">curl</TabsTrigger>
              </TabsList>
              <TabsContent className="flex flex-col gap-2 !mt-0" value="client">
                <div>
                  Trigger the workflow with
                  <a
                    href="https://github.com/BennyKok/comfyui-deploy-next-example/blob/main/src/lib/comfy-deploy.ts"
                    className="text-blue-500 hover:underline"
                    target="_blank"
                  >
                    &nbsp;comfy deploy wrapper
                  </a>
                </div>
                <div>
                  Copy the wrapper to your project, and import the function
                </div>
                <CodeBlock
                  lang="js"
                  code={formatCode(
                    clientTemplate,
                    deployment,
                    domain,
                    workflowInput
                  )}
                />
                Check the status of the run, and retrieve the outputs
                <CodeBlock
                  lang="js"
                  code={formatCode(
                    clientTemplate_checkStatus,
                    deployment,
                    domain
                  )}
                />
              </TabsContent>
              <TabsContent className="flex flex-col gap-2 !mt-0" value="js">
                Trigger the workflow
                <CodeBlock
                  lang="js"
                  code={formatCode(
                    jsTemplate,
                    deployment,
                    domain,
                    workflowInput
                  )}
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
                  code={formatCode(
                    curlTemplate_checkStatus,
                    deployment,
                    domain
                  )}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="w-full justify-end flex gap-2 py-1">
              <Button asChild className="gap-2" variant="outline" type="submit">
                <ButtonAction
                  action={removePublicShareDeployment.bind(null, deployment.id)}
                >
                  Remove
                </ButtonAction>
              </Button>
              <Button asChild className="gap-2">
                <Link href={`/share/${deployment.id}`} target="_blank">
                  View Share Page <ExternalLink size={14} />
                </Link>
              </Button>
            </div>
          )}
        </ScrollArea>
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
    .replace("<ID>", deployment.id)
    .replace("<URLONLY>", domain ?? "http://localhost:3000");
}
