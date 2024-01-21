"use server";

import { LemonSqueezy } from "@lemonsqueezy/lemonsqueezy.js";
import "server-only";

const ls = new LemonSqueezy(process.env.LEMONSQUEEZY_API_KEY || "");

export async function getPricing() {
  const products = await ls.getProducts();

  return products;
}

export async function getUsage() {
  const usageRecord = await ls.getUsageRecords();

  return usageRecord;
}

export async function setUsage(id: number, quantity: number) {
  const setUsage = await ls.createUsageRecord({
    subscriptionItemId: id,
    quantity: quantity,
  });

  return setUsage;
}

export async function getSubscription() {
  const subscription = await ls.getSubscriptions();

  return subscription;
}

export async function getSubscriptionItem() {
  const subscriptionItem = await ls.getSubscriptionItems();

  return subscriptionItem;
}

export async function getUserData() {
  const user = await ls.getUser();

  return user;
}
