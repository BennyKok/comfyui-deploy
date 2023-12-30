import { LoadingWrapper } from "@/components/LoadingWrapper";
import { DeploymentsTable } from "@/components/RunsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page({
  params,
}: {
  params: { workflow_id: string };
}) {
  const workflow_id = params.workflow_id;

  return (
    <Card className="w-full h-fit">
      <CardHeader>
        <CardTitle>Deployments</CardTitle>
      </CardHeader>

      <CardContent>
        <LoadingWrapper tag="deployments">
          <DeploymentsTable workflow_id={workflow_id} />
        </LoadingWrapper>
      </CardContent>
    </Card>
  );
}
