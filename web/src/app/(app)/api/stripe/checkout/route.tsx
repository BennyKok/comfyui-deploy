import { stripe } from "@/server/stripe";
import { auth, clerkClient } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUrlServerSide } from "@/server/getUrlServerSide";

export async function GET(req: Request) {
  const { userId, orgId } = auth();

  const plan = new URL(req.url).searchParams.get("plan");

  if (!userId) return redirect("/");
  if (!plan) return redirect("/pricing");

  const user = await clerkClient.users.getUser(userId);

  const mapping = {
    pro: process.env.STRIPE_PR_PRO,
    enterprise: process.env.STRIPE_PR_ENTERPRISE,
  };

  const api = process.env.STRIPE_PR_API;

  const session = await stripe.checkout.sessions.create({
    success_url: getUrlServerSide(),
    line_items: [
      {
        price: mapping[plan as "pro" | "enterprise"],
        quantity: 1,
      },
      {
        price: api,
      },
    ],
    metadata: {
      userId: userId,
      orgId: orgId ?? null,
      plan: plan,
    },
    allow_promotion_codes: true,
    client_reference_id: orgId ?? userId,
    customer_email: user.emailAddresses[0].emailAddress,
    mode: "subscription",
  });

  if (session.url) redirect(session.url);
}
