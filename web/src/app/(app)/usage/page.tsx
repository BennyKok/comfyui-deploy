import PricingList from "@/components/PricingPlan";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentPlanWithAuth } from "@/server/getCurrentPlan";
import { stripe } from "@/server/stripe";

const freeTierSeconds = 30000;

export default async function Home() {
  const sub = await getCurrentPlanWithAuth();

  let data: Awaited<
    ReturnType<typeof stripe.subscriptionItems.listUsageRecordSummaries>
  > | null = null;

  try {
    data = sub?.subscription_item_api_id
      ? await stripe.subscriptionItems.listUsageRecordSummaries(
          sub?.subscription_item_api_id,
        )
      : null;
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="mt-4 flex items-center justify-center">
      <Card className="p-4 w-full max-w-[600px]">
        <CardHeader>
          <CardTitle>Account Usage</CardTitle>
          <CardDescription>View you account usage</CardDescription>
          <Badge className="w-fit">{sub?.plan}</Badge>
        </CardHeader>
        {data && (
          <CardContent className="text-sm flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              <span>Current free gpu usage:</span>
              {
                <div className="flex gap-2">
                  <Badge>
                    {data.data[0].total_usage}s /{Math.floor(freeTierSeconds)}s
                  </Badge>
                  <Badge>
                    {Math.floor(data.data[0].total_usage / 60 / 60)}hr /
                    {Math.floor(freeTierSeconds / 60 / 60)}hr
                  </Badge>
                </div>
              }
            </div>
            <Progress
              value={(data.data[0].total_usage / freeTierSeconds) * 100}
            ></Progress>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
