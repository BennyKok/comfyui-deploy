"use server";

import { withServerPromise } from "./withServerPromise";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import "server-only";

export async function getMachines() {
  const { userId } = auth();
  if (!userId) throw new Error("No user id");
  const machines = await db
    .select()
    .from(machinesTable)
    .where(
      and(eq(machinesTable.user_id, userId), eq(machinesTable.disabled, false))
    );
  return machines;
}

export async function addMachine(name: string, endpoint: string) {
  const { userId } = auth();
  if (!userId) throw new Error("No user id");
  console.log(name, endpoint);
  await db.insert(machinesTable).values({
    user_id: userId,
    name,
    endpoint,
  });
  revalidatePath("/machines");
}

export const deleteMachine = withServerPromise(
  async (machine_id: string): Promise<{ message: string }> => {
    await db.delete(machinesTable).where(eq(machinesTable.id, machine_id));
    revalidatePath("/machines");
    return { message: "Machine Deleted" };
  }
);

export const disableMachine = withServerPromise(
  async (machine_id: string): Promise<{ message: string }> => {
    await db
      .update(machinesTable)
      .set({
        disabled: true,
      })
      .where(eq(machinesTable.id, machine_id));
    revalidatePath("/machines");
    return { message: "Machine Disabled" };
  }
);

export const enableMachine = withServerPromise(
  async (machine_id: string): Promise<{ message: string }> => {
    await db
      .update(machinesTable)
      .set({
        disabled: false,
      })
      .where(eq(machinesTable.id, machine_id));
    revalidatePath("/machines");
    return { message: "Machine Enabled" };
  }
);
