"use server";

import { db } from "@/db/db";
import { machinesTable, workflowTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import "server-only";

// export async function addMachine(form: FormData) {
//   const name = form.get("name") as string;
//   const endpoint = form.get("endpoint") as string;

//   await db.insert(machinesTable).values({
//     name,
//     endpoint,
//   });
//   revalidatePath("/machines");
// }

export async function getMachines() {
  const { userId } = auth();
  if (!userId) throw new Error("No user id");
  const machines = await db
    .select()
    .from(machinesTable)
    .where(eq(machinesTable.user_id, userId));
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

export async function deleteMachine(machine_id: string) {
  await db.delete(machinesTable).where(eq(machinesTable.id, machine_id));
  revalidatePath("/machines");
}
