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
import { getRelativeTime } from "@/lib/getRelativeTime";
import type { findAllDeployments } from "@/server/findAllRuns";

const curlTemplate = `
curl --request POST \
  --url <URL> \
  --header 'Content-Type: application/json' \
  --data '{
  "deployment_id": "<ID>"
}'
`;

const jsTemplate = `
const options = {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: '{"deployment_id":"<ID>"}'
};

fetch('<URL>', options)
  .then(response => response.json())
  .then(response => console.log(response))
  .catch(err => console.error(err));
`;

const jsTemplate_checkStatus = `
const options = {
  method: 'GET',
  headers: {'Content-Type': 'application/json'},
};

const run_id = '<RUN_ID>';

fetch('<URL>?run_id=' + run_id, options)
  .then(response => response.json())
  .then(response => console.log(response))
  .catch(err => console.error(err));
`;

export function DeploymentDisplay({
  deployment,
}: {
  deployment: Awaited<ReturnType<typeof findAllDeployments>>[0];
}) {
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
      <DialogContent className="max-w-xl">
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
            <CodeBlock lang="js" code={formatCode(jsTemplate, deployment)} />
            <CodeBlock
              lang="js"
              code={formatCode(jsTemplate_checkStatus, deployment)}
            />
          </TabsContent>
          <TabsContent value="curl">
            <CodeBlock
              lang="bash"
              code={formatCode(curlTemplate, deployment)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function formatCode(
  codeTemplate: string,
  deployment: Awaited<ReturnType<typeof findAllDeployments>>[0]
) {
  return codeTemplate
    .replace(
      "<URL>",
      `${process.env.VERCEL_URL ?? "http://localhost:3000"}/api/run`
    )
    .replace("<ID>", deployment.id);
}
