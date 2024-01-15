import { replaceCDNUrl } from "./replaceCDNUrl";
import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3({
  endpoint: process.env.SPACES_ENDPOINT, //"https://nyc3.digitaloceanspaces.com",
  region: process.env.SPACES_REGION, //"nyc3",
  credentials: {
    accessKeyId: process.env.SPACES_KEY!,
    secretAccessKey: process.env.SPACES_SECRET!,
  },
  forcePathStyle: process.env.SPACES_CDN_FORCE_PATH_STYLE === "true",
});

export type ResourceObject = {
  resourceBucket: string;
  resourceId: string;
  resourceType: "image/png" | "application/zip" | string;
  isPublic?: boolean;
  size?: number;
};

export async function handleResourceUpload(
  resource: Partial<ResourceObject>
): Promise<string> {
  const p: PutObjectCommandInput = {
    Key: resource.resourceId,
    Bucket: resource.resourceBucket,
    ContentType: resource.resourceType,
    ContentLength: resource.size,
  };

  // Only set ACL if resource is public
  if (resource.isPublic) {
    p.ACL = "public-read";
  }

  const url = await getSignedUrl(s3Client, new PutObjectCommand(p), {
    expiresIn: 5 * 60,
  });

  return url;
}

export async function handResourceRemove(
  resource: Partial<ResourceObject>
): Promise<boolean> {
  console.log("Removing resources", resource);
  try {
    const result = await s3Client.send(
      new DeleteObjectCommand({
        Key: `/public-download/sdk/${resource.resourceId}`,
        Bucket: resource.resourceBucket,
      })
    );
    console.log(result);
  } catch (err) {
    console.log("Error", err);
    return false;
  }
  return true;
}

export async function handleResourceDownload(
  resource: Partial<ResourceObject>
): Promise<string> {
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Key: resource.resourceId,
      Bucket: resource.resourceBucket,

      ResponseCacheControl: "no-cache, no-store",
    }),
    { expiresIn: 5 * 60 }
  );
  return replaceCDNUrl(url);
}

export async function handleResourceDelete(
  resource: ResourceObject
): Promise<string> {
  try {
    const result = await s3Client.send(
      new DeleteObjectCommand({
        Key: resource.resourceId,
        Bucket: resource.resourceBucket,
      })
    );
  } catch (e) {
    //TODO handle error
    return "error";
  }
  return "ok";
}
