"use server";

import type {
  addCustomMachineSchema,
  addMachineSchema,
} from "./addMachineSchema";
import { withServerPromise } from "./withServerPromise";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

export async function getMachineById(id: string) {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");
  const machines = await db
    .select()
    .from(machinesTable)
    .where(
      and(
        orgId
          ? eq(machinesTable.org_id, orgId)
          : and(
              eq(machinesTable.user_id, userId),
              isNull(machinesTable.org_id)
            ),
        eq(machinesTable.id, id)
      )
    );
  return machines[0];
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

export const addCustomMachine = withServerPromise(
  async (data: z.infer<typeof addCustomMachineSchema>) => {
    const { userId, orgId } = auth();
    const headersList = headers();

    if (!userId) return { error: "No user id" };

    // Insert to our db
    const a = await db
      .insert(machinesTable)
      .values({
        ...data,
        org_id: orgId,
        user_id: userId,
        status: "building",
        endpoint: "not-ready",
      })
      .returning();

    const b = a[0];

    // const origin = new URL(request.url).origin;
    const domain = headersList.get("x-forwarded-host") || "";
    const protocol = headersList.get("x-forwarded-proto") || "";
    // console.log("domain", domain);
    // console.log("domain", `${protocol}://${domain}/api/machine-built`);
    // return { message: "Machine Building" };

    if (domain === "") {
      throw new Error("No domain");
    }

    // Call remote builder
    const result = await fetch(`${process.env.MODAL_BUILDER_URL!}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        machine_id: b.id,
        name: b.id,
        snapshot: JSON.parse(data.snapshot as string),
        callback_url: `${protocol}://${domain}/api/machine-built`,
      }),
    });

    if (!result.ok) {
      const error_log = await result.text();
      await db
        .update(machinesTable)
        .set({
          ...data,
          status: "error",
          build_log: error_log,
        })
        .where(eq(machinesTable.id, b.id));
      throw new Error(`Error: ${result.statusText} ${error_log}`);
    }

    redirect(`/machines/${b.id}`);

    // revalidatePath("/machines");
    return { message: "Machine Building" };
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
