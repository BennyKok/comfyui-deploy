"use server";

import type { addMachineSchema } from "./addMachineSchema";
import { withServerPromise } from "./withServerPromise";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import "server-only";
import type { z } from "zod";

export async function getMachines() {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");
  const machines = await db
    .select()
    .from(machinesTable)
    .where(
      and(
        orgId
          ? eq(machinesTable.org_id, orgId)
          : eq(machinesTable.user_id, userId),
        eq(machinesTable.disabled, false)
      )
    );
  return machines;
}

export const addMachine = withServerPromise(
  async (data: z.infer<typeof addMachineSchema>) => {
    const { userId, orgId } = auth();
    if (!userId) return { error: "No user id" };
    // console.log(name, endpoint);
    await db.insert(machinesTable).values({
      ...data,
      org_id: orgId,
      user_id: userId,
    });
    revalidatePath("/machines");
    return { message: "Machine Added" };
  }
);

export const updateMachine = withServerPromise(
  async ({
    id,
    ...data
  }: z.infer<typeof addMachineSchema> & {
    id: string;
  }) => {
    const { userId } = auth();
    if (!userId) return { error: "No user id" };
    await db.update(machinesTable).set(data).where(eq(machinesTable.id, id));
    revalidatePath("/machines");
    return { message: "Machine Updated" };
  }
);

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
