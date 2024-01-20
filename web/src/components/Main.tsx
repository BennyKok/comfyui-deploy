import { Section } from "@/components/Section";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { setInitialUserData } from "@/lib/setInitialUserData";
import { cn } from "@/lib/utils";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import meta from "next-gen/config";

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

function FeatureCard(props: {
  className?: string;
  title: React.ReactNode;
  description: string;
}) {
  return (
    <div
      className={cn(
        "group relative text-center bg-opacity-20 rounded-lg py-6 ring-1 shadow-sm ring-stone-200/50 overflow-hidden"
        // props.className,
      )}
    >
      {/* <div className="z-[1] top-0 absolute h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div> */}
      <div
        className={cn(
          "opacity-60 group-hover:opacity-100 transition-all -z-[5] absolute top-0 h-full w-full duration-700",
          props.className
        )}
      />
      <div className="opacity-60 group-hover:opacity-100 absolute top-0 inset-0 -z-[5] h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <div className="">
        <div className="font-mono text-lg ">{props.title}</div>
        <div className="divider px-4 py-0 h-[1px] opacity-30 my-2" />
        <div className="px-8 text-stone-800 ">{props.description}</div>
      </div>
    </div>
  );
}

export default async function Main() {
  const { userId } = await auth();

  if (userId) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!user) {
      await setInitialUserData(userId);
    }
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col items-center gap-10">
        {/* Hero Section */}

        <Section className="items-left min-h-[calc(100dvh-73px)] flex-col ">
          <div className="flex flex-col justify-center gap-2">
            <Section.Announcement
              className="text-sm"
              href="https://github.com/BennyKok/comfyui-deploy"
            >
              ✨ Open Source on Github
            </Section.Announcement>

            <Section.Title className="text-left">
              <span className="text-5xl sm:text-6xl md:text-7xl pb-2 inline-flex animate-background-shine bg-[linear-gradient(110deg,#1e293b,45%,#939393,55%,#1e293b)] bg-[length:250%_100%] bg-clip-text text-transparent">
                {meta.tagline}
              </span>
            </Section.Title>

            <Section.Subtitle className="text-left">
              {meta.description}
            </Section.Subtitle>

            <Section.PrimaryAction
              href="/workflows"
              className="mt-10 px-8 py-8 rounded-2xl w-fit text-lg font-bold"
            >
              Get Started
            </Section.PrimaryAction>
          </div>

          <div className="z-[-10] flex items-center mt-8 mb-4 w-full">
            {/* <Image
              loading="eager"
              // placeholder="blur"
              // blurDataURL="data:image/webp;base64,LPFO]k}w-Rn1F,K-NjR#-UwDf1o*"
              className="shadow-lg object-contain object-top w-full rounded-2xl h-fit"
              src={macBookMainImage}
              alt="Find My Ports on MacBook Pro 14"
            ></Image> */}
          </div>
        </Section>
      </div>

      <footer className="text-base-content mx-auto flex flex-col md:flex-row items-center justify-center w-full max-w-5xl  gap-4 p-10 ">
        {/* <div className="md:col-span-4"> */}
        <div className="font-bold">{meta.name}</div>
        <div>© {meta.author} 2023 . All rights reserved.</div>
        {/* </div> */}
      </footer>
    </div>
  );
}
