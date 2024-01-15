"use server";

import { LemonSqueezy } from "@lemonsqueezy/lemonsqueezy.js";
import "server-only";

const ls = new LemonSqueezy(process.env.LEMONSQUEEZY_API_KEY || "");

export async function getPricing() {
  const products = await ls.getProducts();

  return products;
}
