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
      process.env.JWT_SECRET!
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
      .delete(apiKeyTable)
      .where(and(eq(apiKeyTable.id, id), eq(apiKeyTable.org_id, orgId)))
      .execute();
  } else {
    await db
      .delete(apiKeyTable)
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
      where: eq(apiKeyTable.org_id, orgId),
      orderBy: desc(apiKeyTable.created_at),
    });
  } else {
    return await db.query.apiKeyTable.findMany({
      where: eq(apiKeyTable.user_id, userId),
      orderBy: desc(apiKeyTable.created_at),
    });
  }
}
