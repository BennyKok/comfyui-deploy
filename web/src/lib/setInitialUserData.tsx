import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { clerkClient } from "@clerk/nextjs";

export async function setInitialUserData(userId: string) {
  const user = await clerkClient.users.getUser(userId);

  // incase we dont have username such as google login, fallback to first name + last name
  const usernameFallback =
    user.username ?? (user.firstName ?? "") + (user.lastName ?? "");

  // For the display name, if it for some reason is empty, fallback to username
  let nameFallback = (user.firstName ?? "") + (user.lastName ?? "");
  if (nameFallback === "") {
    nameFallback = usernameFallback;
  }

  const result = await db.insert(usersTable).values({
    id: userId,
    // this is used for path, make sure this is unique
    username: usernameFallback,

    // this is for display name, maybe different from username
    name: nameFallback,
  });
}
