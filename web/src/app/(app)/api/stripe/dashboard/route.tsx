import { stripe } from "@/server/stripe";
import { createCheckout } from "@/server/linkToPricing";
import { auth, clerkClient } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUrlServerSide } from "@/server/getUrlServerSide";
import { db } from "@/db/db";
import { and, eq, isNull } from "drizzle-orm";
import { subscriptionStatusTable } from "@/db/schema";
import { getCurrentPlan } from "@/server/getCurrentPlan";

export async function GET(req: Request) {
  const { userId, orgId } = auth();

  if (!userId) return redirect("/");

  const change = new URL(req.url).searchParams.get("change");

  const sub = await getCurrentPlan({
    org_id: orgId,
    user_id: userId,
  });

  if (!sub) return redirect("/pricing");

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: getUrlServerSide() + "/pricing",
    // flow_data:
    //   change === "true" && sub.subscription_id
    //     ? {
    //         type: "subscription_update",
    //         subscription_update: {
    //           subscription: sub.subscription_id,
    //         },
    //       }
    //     : undefined,
  });

  redirect(session.url);
  // if (session.url) redirect(session.url);
}
