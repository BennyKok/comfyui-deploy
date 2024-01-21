"use client";

import { ButtonAction } from "@/components/ButtonActionLoader";
import { UpdateModal } from "@/components/InsertModal";
import { LoadingPageWrapper } from "@/components/LoadingWrapper";
import { Button } from "@/components/ui/button";
import { publicShareDeployment } from "@/db/schema";
import {
  findUserShareDeployment,
  removePublicShareDeployment,
  updateSharePageInfo,
} from "@/server/curdDeploments";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useServerActionData } from "./useServerActionData";

export function SharePageSettings({
  deployment_id,
}: {
  deployment_id: string;
}) {
  const {
    data: deployment,
    pending,
    started,
  } = useServerActionData(findUserShareDeployment, deployment_id);

  const [_open, _setOpen] = useState(false);
  const router = useRouter();

  if (pending) return <LoadingPageWrapper className="h-full" tag="settings" />;

  if (!deployment && started && !pending)
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p>Settings page not found.</p>
      </div>
    );

  if (!deployment) return null;

  return (
    <>
      <UpdateModal
        dialogClassName="sm:max-w-[600px]"
        open={true}
        setOpen={() => {
          router.back();
        }}
        extraButtons={
          <>
            <Button
              asChild
              className="gap-2 truncate"
              variant="outline"
              type="button"
            >
              <ButtonAction
                routerAction="back"
                action={removePublicShareDeployment.bind(null, deployment.id)}
              >
                Remove
              </ButtonAction>
            </Button>
            <Button asChild className="gap-2 truncate" type="button">
              <Link href={`/share/${deployment.share_slug ?? deployment.id}`} target="_blank">
                View Share Page <ExternalLink size={14} />
              </Link>
            </Button>
          </>
        }
        data={{
          id: deployment.id,
          description: deployment.description,
          showcase_media: deployment.showcase_media ?? [],
        }}
        title="Share Page"
        description="Edit share page details."
        serverAction={updateSharePageInfo}
        formSchema={publicShareDeployment}
        fieldConfig={{
          description: {
            fieldType: "textarea",
          },
        }}
      />
    </>
  );
}
