"use server";

import type {
  addCustomMachineSchema,
  addMachineSchema,
} from "./addMachineSchema";
import { withServerPromise } from "./withServerPromise";
import { db } from "@/db/db";
import type { MachineType } from "@/db/schema";
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
          : // make sure org_id is null
            and(
              eq(machinesTable.user_id, userId),
              isNull(machinesTable.org_id)
            ),
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

export const updateCustomMachine = withServerPromise(
  async ({
    id,
    ...data
  }: z.infer<typeof addCustomMachineSchema> & {
    id: string;
  }) => {
    const { userId } = auth();
    if (!userId) return { error: "No user id" };

    const currentMachine = await db.query.machinesTable.findFirst({
      where: eq(machinesTable.id, id),
    });

    if (!currentMachine) return { error: "Machine not found" };

    // Check if snapshot or models have changed
    const snapshotChanged =
      JSON.stringify(data.snapshot) !== JSON.stringify(currentMachine.snapshot);
    const modelsChanged =
      JSON.stringify(data.models) !== JSON.stringify(currentMachine.models);
    const gpuChanged = data.gpu !== currentMachine.gpu;

    // return {
    //   message: `snapshotChanged: ${snapshotChanged}, modelsChanged: ${modelsChanged}`,
    // };

    await db.update(machinesTable).set(data).where(eq(machinesTable.id, id));

    // If there are changes
    if (snapshotChanged || modelsChanged || gpuChanged) {
      // Update status to building
      await db
        .update(machinesTable)
        .set({
          status: "building",
          endpoint: "not-ready",
        })
        .where(eq(machinesTable.id, id));

      // Perform custom build if there are changes
      await _buildMachine(data, currentMachine);
      redirect(`/machines/${id}`);
    } else {
      revalidatePath("/machines");
    }

    return { message: "Machine Updated" };
  }
);

export const buildMachine = withServerPromise(
  async ({ id }: { id: string }) => {
    const { userId } = auth();
    if (!userId) return { error: "No user id" };

    const currentMachine = await db.query.machinesTable.findFirst({
      where: eq(machinesTable.id, id),
    });

    if (!currentMachine) return { error: "Machine not found" };

    const datas = await db
      .update(machinesTable)
      .set({
        status: "building",
        endpoint: "not-ready",
      })
      .where(eq(machinesTable.id, id))
      .returning();

    // Perform custom build if there are changes
    await _buildMachine(datas[0], currentMachine);
    redirect(`/machines/${id}`);
  }
);

export const addCustomMachine = withServerPromise(
  async (data: z.infer<typeof addCustomMachineSchema>) => {
    const { userId, orgId } = auth();

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

    await _buildMachine(data, b);
    redirect(`/machines/${b.id}`);
    // revalidatePath("/machines");
    return { message: "Machine Building" };
  }
);

async function _buildMachine(
  data: z.infer<typeof addCustomMachineSchema>,
  b: MachineType
) {
  const headersList = headers();

  const domain = headersList.get("x-forwarded-host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "";

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
      snapshot: data.snapshot, //JSON.parse( as string),
      callback_url: `${protocol}://${domain}/api/machine-built`,
      models: data.models, //JSON.parse(data.models as string),
      gpu: data.gpu && data.gpu.length > 0 ? data.gpu : "T4",
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
  } else {
    // setting the build machine id
    const json = await result.json();
    await db
      .update(machinesTable)
      .set({
        ...data,
        build_machine_instance_id: json.build_machine_instance_id,
      })
      .where(eq(machinesTable.id, b.id));
  }
}

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
    const machine = await db.query.machinesTable.findFirst({
      where: eq(machinesTable.id, machine_id),
    });

    if (machine?.type === "comfy-deploy-serverless") {
      // Call remote builder to stop the app on modal
      const result = await fetch(`${process.env.MODAL_BUILDER_URL!}/stop-app`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          machine_id: machine_id,
        }),
      });

      if (!result.ok) {
        const error_log = await result.text();
        throw new Error(`Error: ${result.statusText} ${error_log}`);
      }
    }

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
