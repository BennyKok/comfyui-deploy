'use server'

import { replaceCDNUrl } from "@/server/resource";

export async function getFileDownloadUrl(file: string) {
  return replaceCDNUrl(
    `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}/${file}`
  );
}
