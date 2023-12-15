import { APIKeyBodyRequest } from "@/server/APIKeyBodyRequest";
import jwt from "jsonwebtoken";

export function parseJWT(token: string) {
  try {
    // Verify the token - this also decodes it
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    return APIKeyBodyRequest.parse(decoded);
  } catch (err) {
    // Handle error (token is invalid, expired, etc.)
    console.error(err);
    return null;
  }
}
