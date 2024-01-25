import { auth, clerkClient } from "@clerk/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { stripe } from "../../../../../server/stripe";
import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { subscriptionStatusTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const secret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  try {
    const body = await req.text();

    const signature = headers().get("stripe-signature");

    if (!signature)
      return new NextResponse("Signature not found.", {
        status: 500,
      });

    const event = stripe.webhooks.constructEvent(body, signature, secret);

    console.log(event);

    if (event.type === "checkout.session.completed") {
      if (!event.data.object.customer_details?.email) {
        throw new Error(`missing user email, ${event.id}`);
      }

      const userId = event.data.object.metadata?.userId;
      const plan = event.data.object.metadata?.plan;
      if (!userId) {
        throw new Error(`missing itinerary_id on metadata, ${event.id}`);
      }
      if (!plan) {
        throw new Error(`missing plan on metadata, ${event.id}`);
      }

      const orgId = event.data.object.metadata?.orgId;

      const customerId =
        typeof event.data.object.customer == "string"
          ? event.data.object.customer
          : event.data.object.customer?.id;
      const subscriptionId =
        typeof event.data.object.subscription == "string"
          ? event.data.object.subscription
          : event.data.object.subscription?.id;

      if (!customerId) {
        throw new Error(`missing customerId, ${event.id}`);
      }
      if (!subscriptionId) {
        throw new Error(`missing subscriptionId, ${event.id}`);
      }

      const items = await stripe.subscriptionItems.list({
        subscription: subscriptionId,
        limit: 5,
      });

      // getting the subscription item id for the api plan
      const subscription_item_api_id = items.data.find(
        (x) => x.price.id === process.env.STRIPE_PR_API,
      )?.id;

      // the plan could be either pro or enterprise
      const subscription_item_plan_id =
        items.data.find((x) => x.price.id === process.env.STRIPE_PR_PRO)?.id ??
        items.data.find((x) => x.price.id === process.env.STRIPE_PR_ENTERPRISE)
          ?.id;

      if (!subscription_item_api_id) {
        throw new Error(
          `missing plan on subscription_item_api_id, ${event.id}`,
        );
      }
      if (!subscription_item_plan_id) {
        throw new Error(
          `missing plan on subscription_item_plan_id, ${event.id}`,
        );
      }

      console.log(items);

      await db
        .insert(subscriptionStatusTable)
        .values({
          stripe_customer_id: customerId,
          org_id: orgId,
          user_id: userId,
          subscription_id: subscriptionId,
          plan: plan as "pro" | "enterprise" | "basic",
          status: "active",
          subscription_item_api_id: subscription_item_api_id,
          subscription_item_plan_id: subscription_item_plan_id,
        })
        .onConflictDoNothing();

      // updateDatabase(event.data.object.metadata.itinerary_id);
      // sendEmail(event.data.object.customer_details.email);
    } else if (event.type === "customer.subscription.paused") {
      const customerId =
        typeof event.data.object.customer == "string"
          ? event.data.object.customer
          : event.data.object.customer?.id;

      if (!customerId) {
        throw new Error(`missing customerId, ${event.id}`);
      }

      await db
        .update(subscriptionStatusTable)
        .set({ status: "paused" })
        .where(eq(subscriptionStatusTable.stripe_customer_id, customerId));
    } else if (event.type === "customer.subscription.resumed") {
      const customerId =
        typeof event.data.object.customer == "string"
          ? event.data.object.customer
          : event.data.object.customer?.id;

      if (!customerId) {
        throw new Error(`missing customerId, ${event.id}`);
      }

      await db
        .update(subscriptionStatusTable)
        .set({ status: "active" })
        .where(eq(subscriptionStatusTable.stripe_customer_id, customerId));
    } else if (event.type === "customer.subscription.deleted") {
      const customerId =
        typeof event.data.object.customer == "string"
          ? event.data.object.customer
          : event.data.object.customer?.id;

      if (!customerId) {
        throw new Error(`missing customerId, ${event.id}`);
      }

      await db
        .update(subscriptionStatusTable)
        .set({ status: "deleted" })
        .where(eq(subscriptionStatusTable.stripe_customer_id, customerId));
    } else if (event.type === "customer.subscription.updated") {
      const customerId =
        typeof event.data.object.customer == "string"
          ? event.data.object.customer
          : event.data.object.customer?.id;

      if (!customerId) {
        throw new Error(`missing customerId, ${event.id}`);
      }

      const cancel_at_period_end = event.data.object.cancel_at_period_end;

      await db
        .update(subscriptionStatusTable)
        .set({ cancel_at_period_end: cancel_at_period_end })
        .where(eq(subscriptionStatusTable.stripe_customer_id, customerId));
    }

    return NextResponse.json({ result: event, ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        message: `Something went wrong: ${error}`,
        ok: false,
      },
      { status: 500 },
    );
  }
}
