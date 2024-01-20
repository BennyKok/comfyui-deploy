import { Navbar } from "../../components/Navbar";
import "./globals.css";
import { PHProvider } from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import meta from "next-gen/config";
import PlausibleProvider from "next-plausible";
import dynamic from "next/dynamic";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

const PostHogPageView = dynamic(() => import("./PostHogPageView"), {
  ssr: false,
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: meta["og:title"],
  description: meta["og:description"],

  category: "technology",

  openGraph: {
    type: "website",
    title: meta["og:title"],
    description: meta["og:description"],
    locale: "en_US",
    images: "/og.jpg",
  },
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="en">
      <ClerkProvider>
        <TooltipProvider>
          {process.env.PLAUSIBLE_DOMAIN && (
            <head>
              <PlausibleProvider domain={process.env.PLAUSIBLE_DOMAIN} />
            </head>
          )}
          <PHProvider>
            <body className={inter.className}>
              <PostHogPageView />
              <main className="w-full flex min-h-[100dvh] flex-col items-center justify-start">
                <div className="z-[-1] fixed h-full w-full bg-white">
                  <div className="absolute h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                </div>
                <div className="sticky w-full h-18 flex items-center justify-between gap-4 p-4 border-b border-gray-200">
                  <Navbar />
                </div>
                <div className="md:px-10 px-6 w-full h-[calc(100dvh-73px)]">
                  {children}
                </div>
                <Toaster richColors />
                {modal}
              </main>
            </body>
          </PHProvider>
        </TooltipProvider>
      </ClerkProvider>
    </html>
  );
}
