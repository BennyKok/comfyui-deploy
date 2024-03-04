import { SharePageSettings } from "@/components/SharePageSettings";

export default async function Page({
  params,
}: {
  params: { share_id: string };
}) {
  return <SharePageSettings deployment_id={params.share_id} />;
}
