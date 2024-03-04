import { LoadingPageWrapper } from "@/components/LoadingWrapper";
import { Card } from "@/components/ui/card";

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return (
    <Card className="w-full h-fit">
      <LoadingPageWrapper tag="workflow details" />
    </Card>
  );
}
