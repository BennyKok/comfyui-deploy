"use server";

import { auth } from "@clerk/nextjs";
import {
  checkpointTable,
  CheckpointType,
  checkpointVolumeTable,
  CheckpointVolumeType,
} from "@/db/schema";
import { withServerPromise } from "./withServerPromise";
import { db } from "@/db/db";
import type { z } from "zod";
import { headers } from "next/headers";
import { addCivitaiCheckpointSchema } from "./addCheckpointSchema";
import { and, eq, isNull } from "drizzle-orm";
import { CivitaiModelResponse } from "@/types/civitai";

export async function getCheckpoints() {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");
  const checkpoints = await db
    .select()
    .from(checkpointTable)
    .where(
      orgId
        ? eq(checkpointTable.org_id, orgId)
        // make sure org_id is null
        : and(
          eq(checkpointTable.user_id, userId),
          isNull(checkpointTable.org_id),
        ),
    );
  return checkpoints;
}

export async function getCheckpointById(id: string) {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");
  const checkpoint = await db
    .select()
    .from(checkpointTable)
    .where(
      and(
        orgId ? eq(checkpointTable.org_id, orgId) : and(
          eq(checkpointTable.user_id, userId),
          isNull(checkpointTable.org_id),
        ),
        eq(checkpointTable.id, id),
      ),
    );
  return checkpoint[0];
}

export async function getCheckpointVolumes() {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");
  const volume = await db
    .select()
    .from(checkpointVolumeTable)
    .where(
      and(
        orgId
          ? eq(checkpointVolumeTable.org_id, orgId)
          // make sure org_id is null
          : and(
            eq(checkpointVolumeTable.user_id, userId),
            isNull(checkpointVolumeTable.org_id),
          ),
        eq(checkpointVolumeTable.disabled, false),
      ),
    );
  return volume;
}

export async function retrieveCheckpointVolumes() {
  let volumes = await getCheckpointVolumes();
  if (volumes.length === 0) {
    // create volume if not already created
    volumes = await addCheckpointVolume();
  }
  return volumes;
}

export async function addCheckpointVolume() {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");

  // Insert the new checkpointVolume into the checkpointVolumeTable
  const insertedVolume = await db
    .insert(checkpointVolumeTable)
    .values({
      user_id: userId,
      org_id: orgId,
      volume_name: `checkpoints_${userId}`,
      // created_at and updated_at will be set to current timestamp by default
      disabled: false, // Default value
    })
    .returning(); // Returns the inserted row
  return insertedVolume;
}

function getUrl(civitai_url: string) {
  // expect to be a URL to be https://civitai.com/models/36520
  // possiblity with slugged name and query-param modelVersionId
  const baseUrl = "https://civitai.com/api/v1/models/";
  const url = new URL(civitai_url);
  const pathSegments = url.pathname.split("/");
  const modelId = pathSegments[pathSegments.indexOf("models") + 1];
  const modelVersionId = url.searchParams.get("modelVersionId");

  return { url: baseUrl + modelId, modelVersionId };
}

export const addCivitaiCheckpoint = withServerPromise(
  async (data: z.infer<typeof addCivitaiCheckpointSchema>) => {
    const { userId, orgId } = auth();

    if (!data.civitai_url) return { error: "no civitai_url" };
    if (!userId) return { error: "No user id" };

    const { url, modelVersionId } = getUrl(data?.civitai_url);
    const civitaiModelRes = await fetch(url)
      .then((x) => x.json())
      .then((a) => {
        console.log(a);
        return CivitaiModelResponse.parse(a);
      });

    if (civitaiModelRes?.modelVersions?.length === 0) {
      return; // no versions to download
    }

    let selectedModelVersion;
    let selectedModelVersionId: string | null = modelVersionId;
    if (!selectedModelVersionId) {
      selectedModelVersion = civitaiModelRes.modelVersions[0];
      selectedModelVersionId = civitaiModelRes.modelVersions[0].id.toString();
    } else {
      selectedModelVersion = civitaiModelRes.modelVersions.find((version) =>
        version.id.toString() === selectedModelVersionId
      );
      if (!selectedModelVersion) {
        return; // version id is wrong
      }
      selectedModelVersionId = selectedModelVersion?.id.toString();
    }

    const checkpointVolumes = await getCheckpointVolumes();
    let cVolume;
    if (checkpointVolumes.length === 0) {
      const volume = await addCheckpointVolume();
      cVolume = volume[0];
    } else {
      cVolume = checkpointVolumes[0];
    }

    const a = await db
      .insert(checkpointTable)
      .values({
        user_id: userId,
        org_id: orgId,
        upload_type: "civitai",
        model_name: selectedModelVersion.files[0].name,
        civitai_id: civitaiModelRes.id.toString(),
        civitai_version_id: selectedModelVersionId,
        civitai_url: data.civitai_url,
        civitai_download_url: selectedModelVersion.files[0].downloadUrl,
        civitai_model_response: civitaiModelRes,
        checkpoint_volume_id: cVolume.id,
        updated_at: new Date(),
      })
      .returning();

    const b = a[0];

    await uploadCheckpoint(data, b, cVolume);
    // redirect(`/checkpoints/${b.id}`);
  },
);

// export const redownloadCheckpoint = withServerPromise(
//   async (data: CheckpointItemList) => {
//     const { userId } = auth();
//     if (!userId) return { error: "No user id" };
//
//     const checkpointVolumes = await getCheckpointVolumes();
//     let cVolume;
//     if (checkpointVolumes.length === 0) {
//       const volume = await addCheckpointVolume();
//       cVolume = volume[0];
//     } else {
//       cVolume = checkpointVolumes[0];
//     }
//
//     console.log("data");
//     console.log(data);
//
//     const a = await db
//       .update(checkpointTable)
//       .set({
//         // status: "started",
//         // updated_at: new Date(),
//       })
//       .returning();
//
//     const b = a[0];
//
//     console.log("b");
//     console.log(b);
//
//     await uploadCheckpoint(data, b, cVolume);
//     // redirect(`/checkpoints/${b.id}`);
//   },
// );

async function uploadCheckpoint(
  data: z.infer<typeof addCivitaiCheckpointSchema>,
  c: CheckpointType,
  v: CheckpointVolumeType,
) {
  const headersList = headers();

  const domain = headersList.get("x-forwarded-host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "";

  if (domain === "") {
    throw new Error("No domain");
  }

  // Call remote builder
  const result = await fetch(
    `${process.env.MODAL_BUILDER_URL!}/upload-volume`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        download_url: c.civitai_download_url,
        volume_name: v.volume_name,
        volume_id: v.id,
        checkpoint_id: c.id,
        callback_url: `${protocol}://${domain}/api/volume-upload`,
        upload_type: "checkpoint"
      }),
    },
  );

  if (!result.ok) {
    const error_log = await result.text();
    await db
      .update(checkpointTable)
      .set({
        ...data,
        status: "failed",
        error_log: error_log,
      })
      .where(eq(checkpointTable.id, c.id));
    throw new Error(`Error: ${result.statusText} ${error_log}`);
  } else {
    // setting the build machine id
    const json = await result.json();
    await db
      .update(checkpointTable)
      .set({
        ...data,
        upload_machine_id: json.build_machine_instance_id,
      })
      .where(eq(checkpointTable.id, c.id));
  }
}
