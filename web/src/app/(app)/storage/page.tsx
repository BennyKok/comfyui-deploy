import { setInitialUserData } from "../../../lib/setInitialUserData";
import { auth } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs/server";
import { ModelList } from "@/components/ModelList";
import { getAllUserModels } from "@/server/getAllUserModel";

export default function Page() {
  return <ModelListServer />;
}

async function ModelListServer() {
  const { userId } = auth();

  if (!userId) {
    return <div>No auth</div>;
  }

  const user = await clerkClient.users.getUser(userId);

  if (!user) {
    await setInitialUserData(userId);
  }

  const models = await getAllUserModels();

  if (!models) {
    return <div>No models found</div>;
  }

  return (
    <div className="w-full">
      <ModelList data={models} />
    </div>
  );
}
