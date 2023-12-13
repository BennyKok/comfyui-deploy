import { NextResponse } from "next/server";
import type { ZodType, z } from "zod";
import { ZodError } from "zod";

export async function parseDataSafe<T extends ZodType<any, any, any>>(
  schema: T,
  request: Request,
  headers?: HeadersInit
): Promise<[z.infer<T> | undefined, NextResponse | undefined]> {
  let data: z.infer<T> | undefined = undefined;
  try {
    if (request.method === "GET") {
      // Parse data from query parameters for GET requests
      const url = new URL(request.url);
      const params = Object.fromEntries(url.searchParams);
      data = await schema.parseAsync(params);
    } else {
      // Parse data from request body for other types of requests
      data = await schema.parseAsync(await request.json());
    }
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      const message = e.flatten().fieldErrors;
      return [
        undefined,
        NextResponse.json(message, {
          status: 500,
          statusText: "Invalid request",
          headers: headers,
        }),
      ];
    }
  }

  if (!data)
    return [
      undefined,
      NextResponse.json(
        {
          message: "Invalid request",
        },
        { status: 500, statusText: "Invalid request", headers: headers }
      ),
    ];

  return [data, undefined];
}
