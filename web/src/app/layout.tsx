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
            <div className="md:px-10 px-6 w-full h-full">
              {children}
            </div>
            <Toaster richColors />
          </main>
        </body>
      </ClerkProvider>
    </html>
  );
}
