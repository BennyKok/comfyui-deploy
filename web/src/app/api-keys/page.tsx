import { APIKeyList } from "@/components/APIKeyList";
import { getAPIKeys } from "@/server/curdApiKeys";
import { auth } from "@clerk/nextjs";

export default function Page() {
  return <Component />;
}

async function Component() {
  const { userId } = await auth();

  if (!userId) {
    return <div>No auth</div>;
  }

  const workflow = await getAPIKeys();

  return (
    <div className="w-full">
      <APIKeyList
        data={workflow.map((x) => {
          return {
            id: x.id,
            name: x.name,
            date: x.updated_at,
            endpoint: `****${x.key.slice(-4)}`,
          };
        })}
      />
    </div>
  );
}
