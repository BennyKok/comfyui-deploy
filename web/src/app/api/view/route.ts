import { replaceCDNUrl } from "@/server/resource";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const file = new URL(request.url).searchParams.get("file");
  // console.log(`${process.env.SPACES_ENDPOINT}/comfyui-deploy/${file}`);
  return NextResponse.redirect(
    replaceCDNUrl(
      `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}/${file}`
    )
  );
}
