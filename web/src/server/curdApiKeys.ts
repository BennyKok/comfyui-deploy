"use server";

import { db } from "@/db/db";
import { apiKeyTable } from "@/db/schema";
import { auth } from "@clerk/nextjs";
import { and, desc, eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { revalidatePath } from "next/cache";

// export const nanoid = customAlphabet(
//   "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
// );

// const prefixes = {
//   cd: "cd",
// } as const;

// function newId(prefix: keyof typeof prefixes): string {
//   return [prefixes[prefix], nanoid(16)].join("_");
// }

export async function addNewAPIKey(name: string) {
  const { userId, orgId } = auth();

  if (!userId) throw new Error("No user id");

  let token: string;

  if (orgId) {
    token = jwt.sign(
      { user_id: userId, org_id: orgId },
      process.env.JWT_SECRET!,
    );
  } else {
    token = jwt.sign({ user_id: userId }, process.env.JWT_SECRET!);
  }

  const key = await db
    .insert(apiKeyTable)
    .values({
      name: name,
      key: token,
      user_id: userId,
      org_id: orgId,
    })
    .returning();

  revalidatePath("/api-keys");

  return key[0];
}

export async function deleteAPIKey(id: string) {
  const { userId, orgId } = auth();

  if (!userId) throw new Error("No user id");

  if (orgId) {
    await db
      .update(apiKeyTable)
      .set({
        revoked: true,
        updated_at: new Date(),
      })
      .where(and(eq(apiKeyTable.id, id), eq(apiKeyTable.org_id, orgId)))
      .execute();
  } else {
    await db
      .update(apiKeyTable)
      .set({
        revoked: true,
        updated_at: new Date(),
      })
      .where(and(eq(apiKeyTable.id, id), eq(apiKeyTable.user_id, userId)))
      .execute();
  }

  revalidatePath("/api-keys");
}

export async function getAPIKeys() {
  const { userId, orgId } = auth();

  if (!userId) throw new Error("No user id");

  if (orgId) {
    return await db.query.apiKeyTable.findMany({
      where: and(eq(apiKeyTable.org_id, orgId), eq(apiKeyTable.revoked, false)),
      orderBy: desc(apiKeyTable.created_at),
    });
  } else {
    return await db.query.apiKeyTable.findMany({
      where: and(eq(apiKeyTable.user_id, userId), eq(apiKeyTable.revoked, false)),
      orderBy: desc(apiKeyTable.created_at),
    });
  }
}

export async function isKeyRevoked(key: string) {
  const revokedKey = await db.query.apiKeyTable.findFirst({
    where: and(eq(apiKeyTable.key, key), eq(apiKeyTable.revoked, true)),
  });

  return revokedKey !== undefined;
}