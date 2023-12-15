"use server";

import { db } from "@/db/db";
import { deploymentsTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import "server-only";

export async function createDeployments(
  workflow_id: string,
  version_id: string,
  machine_id: string,
  environment: "production" | "staging"
) {
  const { userId } = auth();
  if (!userId) throw new Error("No user id");

  // Same environment and same workflow
  const existingDeployment = await db.query.deploymentsTable.findFirst({
    where: and(
      eq(deploymentsTable.workflow_id, workflow_id),
      eq(deploymentsTable.environment, environment)
    ),
  });

  if (existingDeployment) {
    await db
      .update(deploymentsTable)
      .set({
        workflow_id,
        workflow_version_id: version_id,
        machine_id,
      })
      .where(eq(deploymentsTable.id, existingDeployment.id));
  } else {
    await db.insert(deploymentsTable).values({
      user_id: userId,
      workflow_id,
      workflow_version_id: version_id,
      machine_id,
      environment,
    });
  }
  revalidatePath(`/${workflow_id}`);
  return {
    message: `Successfully created deployment for ${environment}`,
  };
}
