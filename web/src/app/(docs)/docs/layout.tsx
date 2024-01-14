import { Providers } from "./providers";
import "@/app/(app)/globals.css";
import { Layout } from "@/components/docs/Layout";
import { type Section } from "@/components/docs/SectionProvider";
import glob from "fast-glob";
import { type Metadata } from "next";
import PlausibleProvider from "next-plausible";

export const metadata: Metadata = {
  title: {
    template: "%s - Protocol API Reference",
    default: "Protocol API Reference",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pages = await glob("**/*.mdx", { cwd: "src/app/(docs)/docs" });
  const allSectionsEntries = (await Promise.all(
    pages.map(async (filename) => [
      `/${filename.replace(/(^|\/)page\.mdx$/, "")}`,
      (await import(`./${filename}`)).sections,
    ])
  )) as Array<[string, Array<Section>]>;
  const allSections = Object.fromEntries(allSectionsEntries);

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      {process.env.PLAUSIBLE_DOMAIN && (
        <head>
          <PlausibleProvider domain={process.env.PLAUSIBLE_DOMAIN} />
        </head>
      )}
      <body className="flex min-h-full bg-white antialiased dark:bg-zinc-900">
        <Providers>
          <div className="w-full">
            <Layout allSections={allSections}>{children}</Layout>
          </div>
        </Providers>
      </body>
    </html>
  );
}
