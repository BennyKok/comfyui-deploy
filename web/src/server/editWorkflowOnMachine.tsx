"use server";

import { getMachineById } from "@/server/curdMachine";
import { auth } from "@clerk/nextjs";
import jwt from "jsonwebtoken";
import { getOrgOrUserDisplayName } from "@/server/getOrgOrUserDisplayName";
import { withServerPromise } from "@/server/withServerPromise";
import "server-only";
import { headers } from "next/headers";

export const editWorkflowOnMachine = withServerPromise(
  async (workflow_version_id: string, machine_id: string) => {
    const { userId, orgId } = auth();

    const headersList = headers();
    const host = headersList.get("host") || "";
    const protocol = headersList.get("x-forwarded-proto") || "";
    const domain = `${protocol}://${host}`;

    if (!userId) {
      throw new Error("No user id");
    }

    const machine = await getMachineById(machine_id);

    const expireTime = "1w";
    const token = jwt.sign(
      { user_id: userId, org_id: orgId },
      process.env.JWT_SECRET!,
      {
        expiresIn: expireTime,
      },
    );

    const userName = await getOrgOrUserDisplayName(orgId, userId);

    let endpoint = machine.endpoint;

    if (machine.type === "comfy-deploy-serverless") {
      endpoint = machine.endpoint.replace("comfyui-api", "comfyui-app");
    }

    return `${endpoint}?workflow_version_id=${encodeURIComponent(
      workflow_version_id,
    )}&auth_token=${encodeURIComponent(token)}&org_display=${encodeURIComponent(
      userName,
    )}&origin=${encodeURIComponent(domain)}`;
  },
);
