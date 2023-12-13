import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const file = new URL(request.url).searchParams.get("file");
  console.log(file);
  return NextResponse.redirect(
    `${process.env.SPACES_ENDPOINT}/comfyui-deploy/${file}`
  );
}
