import { NextResponse } from "next/server";
import { ZodError, ZodType, z } from "zod";

export async function parseDataSafe<T extends ZodType<any, any, any>>(
  schema: T,
  request: Request,
  headers?: HeadersInit,
): Promise<[z.infer<T> | undefined, NextResponse | undefined]> {
  let data: z.infer<T> | undefined = undefined;
  try {
    data = await schema.parseAsync(await request.json());
  } catch (e: any) {
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
        { status: 500, statusText: "Invalid request", headers: headers },
      ),
    ];

  return [data, undefined];
}
