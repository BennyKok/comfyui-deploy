import "./globals.css";
import { NavbarRight } from "@/components/NavbarRight";
import { Button } from "@/components/ui/button";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { Github } from "lucide-react";
import type { Metadata } from "next";
import PlausibleProvider from "next-plausible";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

import meta from 'next-gen/config';

export const metadata: Metadata = {
  title: meta['og:title'],
  description: meta['og:description'],

  category: 'technology',

  openGraph: {
    type: 'website',
    title: meta['og:title'],
    description: meta['og:description'],
    locale: 'en_US',
    images: '/og.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <ClerkProvider>
        <head>
          {process.env.PLAUSIBLE_DOMAIN && (
            <PlausibleProvider domain={process.env.PLAUSIBLE_DOMAIN} />
          )}
        </head>
        <body className={inter.className}>
          <main className="w-full flex min-h-[100dvh] flex-col items-center justify-start">
          <div className="z-[-1] fixed h-full w-full bg-white"><div className="absolute h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div></div>
            <div className="w-full h-18 flex items-center justify-between gap-4 p-4 border-b border-gray-200">
              <div className="flex flex-row items-center gap-4">
                <a className="font-bold text-md md:text-lg hover:underline" href="/">
                  {meta.name}
                </a>
                <NavbarRight />
              </div>
              <div className="flex flex-row items-center gap-2">
                <UserButton />
                <Button
                  asChild
                  variant={"outline"}
                  className="rounded-full aspect-square p-2"
                >
                  <a
                    target="_blank"
                    href="https://github.com/BennyKok/comfyui-deploy"
                  >
                    <Github />
                  </a>
                </Button>
              </div>
              {/* <div></div> */}
            </div>
            <div className="md:px-10 px-6 w-full min-h-[calc(100dvh-73px)]">
              {children}
            </div>
            <Toaster richColors />
          </main>
        </body>
      </ClerkProvider>
    </html>
  );
}
