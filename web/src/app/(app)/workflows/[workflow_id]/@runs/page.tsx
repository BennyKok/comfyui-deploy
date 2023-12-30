import { LoadingWrapper } from "@/components/LoadingWrapper";
import { RunsTable } from "@/components/RunsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page({
  params,
  searchParams,
}: {
  params: { workflow_id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const workflow_id = params.workflow_id;

  return (
    <Card className="w-full h-fit min-w-0">
      <CardHeader>
        <CardTitle>Run</CardTitle>
      </CardHeader>

      <CardContent>
        <LoadingWrapper tag="runs">
          <RunsTable workflow_id={workflow_id} searchParams={searchParams} />
        </LoadingWrapper>
      </CardContent>
    </Card>
  );
}
