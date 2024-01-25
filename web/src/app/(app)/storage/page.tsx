import { setInitialUserData } from "../../../lib/setInitialUserData";
import { auth } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs/server";
import { CheckpointList } from "@/components/CheckpointList";
import { getAllUserCheckpoints } from "@/server/getAllUserCheckpoints";

export default function Page() {
  return <CheckpointListServer />;
}

async function CheckpointListServer() {
  const { userId } = auth();

  if (!userId) {
    return <div>No auth</div>;
  }

  const user = await clerkClient.users.getUser(userId);

  if (!user) {
    await setInitialUserData(userId);
  }

  const checkpoints = await getAllUserCheckpoints();

  if (!checkpoints) {
    return <div>No checkpoints found</div>;
  }

  return (
    <div className="w-full">
      <CheckpointList data={checkpoints} />
    </div>
  );
}
