import { findWorkflowById } from "@/server/findFirstTableWithVersion";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: { workflow_id: string };
}) {
  const workflow = await findWorkflowById(params.workflow_id);
  if (!workflow) redirect("/workflows");

  return <></>;
}
