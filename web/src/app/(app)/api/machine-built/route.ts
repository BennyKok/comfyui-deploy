import { parseDataSafe } from "../../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const Request = z.object({
  machine_id: z.string(),
  endpoint: z.string().optional(),
  build_log: z.string().optional(),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) return error;

  // console.log(data);

  const { machine_id, endpoint, build_log } = data;

  if (endpoint) {
    await db
      .update(machinesTable)
      .set({
        status: "ready",
        endpoint: endpoint,
        build_log: build_log,
      })
      .where(eq(machinesTable.id, machine_id));
  } else {
    // console.log(data);
    await db
      .update(machinesTable)
      .set({
        status: "error",
        build_log: build_log,
      })
      .where(eq(machinesTable.id, machine_id));
  }

  return NextResponse.json(
    {
      message: "success",
    },
    {
      status: 200,
    }
  );
}
