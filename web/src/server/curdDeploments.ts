"use server";

import { db } from "@/db/db";
import type { DeploymentType, publicShareDeployment } from "@/db/schema";
import { deploymentsTable, workflowTable } from "@/db/schema";
import { createNewWorkflow } from "@/server/createNewWorkflow";
import { addCustomMachine } from "@/server/curdMachine";
import { withServerPromise } from "@/server/withServerPromise";
import { auth } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs/server";
import slugify from "@sindresorhus/slugify";
import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import "server-only";
import { validate as isValidUUID } from "uuid";
import type { z } from "zod";
export async function createDeployments(
  workflow_id: string,
  version_id: string,
  machine_id: string,
  environment: DeploymentType["environment"],
) {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");

  if (!machine_id) {
    throw new Error("No machine id provided");
  }

  // Same environment and same workflow
  const existingDeployment = await db.query.deploymentsTable.findFirst({
    where: and(
      eq(deploymentsTable.workflow_id, workflow_id),
      eq(deploymentsTable.environment, environment),
    ),
  });

  if (existingDeployment) {
    await db
      .update(deploymentsTable)
      .set({
        workflow_id,
        workflow_version_id: version_id,
        machine_id,
        org_id: orgId,
      })
      .where(eq(deploymentsTable.id, existingDeployment.id));
  } else {
    const workflow = await db.query.workflowTable.findFirst({
      where: eq(workflowTable.id, workflow_id),
      with: {
        user: {
          columns: {
            name: true,
          },
        },
      },
    });

    if (!workflow) throw new Error("No workflow found");

    const userName = workflow.org_id
      ? await clerkClient.organizations
        .getOrganization({
          organizationId: workflow.org_id,
        })
        .then((x) => x.name)
      : workflow.user.name;

    await db.insert(deploymentsTable).values({
      user_id: userId,
      workflow_id,
      workflow_version_id: version_id,
      machine_id,
      environment,
      org_id: orgId,
      // only create share slug if this is public share
      share_slug: environment == "public-share" ? slugify(`${userName} ${workflow.name}`) : null
    });
  }
  revalidatePath(`/${workflow_id}`);
  return {
    message: `Successfully created deployment for ${environment}`,
  };
}

export async function findAllDeployments() {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");

  const deployments = await db.query.workflowTable.findMany({
    where: and(
      orgId
        ? eq(workflowTable.org_id, orgId)
        : and(eq(workflowTable.user_id, userId), isNull(workflowTable.org_id)),
    ),
    columns: {
      name: true,
    },
    with: {
      deployments: {
        columns: {
          environment: true,
        },
        with: {
          version: {
            columns: {
              id: true,
              snapshot: true,
            },
          },
        },
      },
    },
  });

  return deployments;
}

export async function findSharedDeployment(workflow_id: string) {
  const deploymentData = await db.query.deploymentsTable.findFirst({
    where: and(
      eq(deploymentsTable.environment, "public-share"),
      isValidUUID(workflow_id)
        ? eq(deploymentsTable.id, workflow_id)
        : eq(deploymentsTable.share_slug, workflow_id),
    ),
    with: {
      user: true,
      machine: true,
      workflow: {
        columns: {
          name: true,
          org_id: true,
          user_id: true,
        },
      },
      version: true,
    },
  });

  return deploymentData;
}

export const removePublicShareDeployment = withServerPromise(
  async (deployment_id: string) => {
    const [removed] = await db
      .delete(deploymentsTable)
      .where(
        and(
          eq(deploymentsTable.environment, "public-share"),
          eq(deploymentsTable.id, deployment_id),
        ),
      )
      .returning();

    // revalidatePath(
    //   `/workflows/${removed.workflow_id}`
    // )
  },
);

export const cloneWorkflow = withServerPromise(
  async (deployment_id: string) => {
    const deployment = await db.query.deploymentsTable.findFirst({
      where: and(
        eq(deploymentsTable.environment, "public-share"),
        eq(deploymentsTable.id, deployment_id),
      ),
      with: {
        version: true,
        workflow: true,
      },
    });

    if (!deployment) throw new Error("No deployment found");

    const { userId, orgId } = auth();

    if (!userId) throw new Error("No user id");

    await createNewWorkflow({
      user_id: userId,
      org_id: orgId,
      workflow_name: `${deployment.workflow.name} (Cloned)`,
      workflowData: {
        workflow: deployment.version.workflow,
        workflow_api: deployment?.version.workflow_api,
        snapshot: deployment?.version.snapshot,
      },
    });

    redirect(`/workflows/${deployment.workflow.id}`);

    return {
      message: "Successfully cloned workflow",
    };
  },
);

export const cloneMachine = withServerPromise(async (deployment_id: string) => {
  const deployment = await db.query.deploymentsTable.findFirst({
    where: and(
      eq(deploymentsTable.environment, "public-share"),
      eq(deploymentsTable.id, deployment_id),
    ),
    with: {
      machine: true,
    },
  });

  if (!deployment) throw new Error("No deployment found");
  if (deployment.machine.type !== "comfy-deploy-serverless")
    throw new Error("Can only clone comfy-deploy-serverlesss");

  const { userId, orgId } = auth();

  if (!userId) throw new Error("No user id");

  await addCustomMachine({
    gpu: deployment.machine.gpu,
    models: deployment.machine.models,
    snapshot: deployment.machine.snapshot,
    name: `${deployment.machine.name} (Cloned)`,
    type: "comfy-deploy-serverless",
  });

  return {
    message: "Successfully cloned workflow",
  };
});

export async function findUserShareDeployment(share_id: string) {
  const { userId, orgId } = auth();

  if (!userId) throw new Error("No user id");

  const [deployment] = await db
    .select()
    .from(deploymentsTable)
    .where(
      and(
        isValidUUID(share_id)
          ? eq(deploymentsTable.id, share_id)
          : eq(deploymentsTable.share_slug, share_id),
        eq(deploymentsTable.environment, "public-share"),
        orgId
          ? eq(deploymentsTable.org_id, orgId)
          : and(
            eq(deploymentsTable.user_id, userId),
            isNull(deploymentsTable.org_id),
          ),
      ),
    );

  if (!deployment) throw new Error("No deployment found");

  return deployment;
}

export const updateSharePageInfo = withServerPromise(
  async ({
    id,
    ...data
  }: z.infer<typeof publicShareDeployment> & {
    id: string;
  }) => {
    const { userId } = auth();
    if (!userId) return { error: "No user id" };

    console.log(data);

    const [deployment] = await db
      .update(deploymentsTable)
      .set(data)
      .where(
        and(
          eq(deploymentsTable.environment, "public-share"),
          eq(deploymentsTable.id, id),
        ),
      )
      .returning();

    return { message: "Info Updated" };
  },
);
