import { headers } from "next/headers";

export function getUrlServerSide() {
  const headersList = headers();
  const host = headersList.get("host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "";
  const domain = `${protocol}://${host}`;

  return domain;
}
