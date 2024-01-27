"use server";

import { getMachineById } from "@/server/curdMachine";
import { auth } from "@clerk/nextjs";
import jwt from "jsonwebtoken";
import { getOrgOrUserDisplayName } from "@/server/getOrgOrUserDisplayName";
import { withServerPromise } from "@/server/withServerPromise";
import "server-only";
import { getUrlServerSide } from "./getUrlServerSide";

export const editWorkflowOnMachine = withServerPromise(
  async (machine_id: string, workflow_version_id?: string) => {
    const { userId, orgId } = auth();

    const domain = getUrlServerSide();

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

    const params = {
      workflow_version_id: workflow_version_id,
      auth_token: token,
      org_display: userName,
      origin: domain,
    };

    const queryString = Object.entries(params)
      .filter(([key, value]) => value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
      .join('&');

    return `${endpoint}?${queryString}`;
  },
);
