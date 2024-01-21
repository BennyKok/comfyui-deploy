"use server";

import { db } from "@/db/db";
import { deploymentsTable, workflowRunsTable } from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";

type RunsSearchTypes = {
  workflow_id: string;
  limit: number;
  offset: number;
};

export async function findAllRuns({
  workflow_id,
  limit = 10,
  offset = 0,
}: RunsSearchTypes) {
  return await db.query.workflowRunsTable.findMany({
			where: eq(workflowRunsTable.workflow_id, workflow_id),
			orderBy: desc(workflowRunsTable.created_at),
			offset: offset,
			limit: limit,
			extras: {
				number: sql<number>`row_number() over (order by created_at)`.as(
					"number",
				),
				total: sql<number>`count(*) over ()`.as("total"),
				duration:
					sql<number>`(extract(epoch from ended_at) - extract(epoch from created_at))`.as(
						"duration",
					),
				cold_start_duration:
					sql<number>`(extract(epoch from started_at) - extract(epoch from created_at))`.as(
						"cold_start_duration",
					),
				run_duration:
					sql<number>`(extract(epoch from ended_at) - extract(epoch from started_at))`.as(
						"run_duration",
					),
			},
			with: {
				machine: {
					columns: {
						name: true,
						endpoint: true,
					},
				},
				version: {
					columns: {
						version: true,
					},
				},
			},
		});
}

export async function findAllRunsWithCounts(props: RunsSearchTypes) {
  const a = await db
    .select({
      count: count(workflowRunsTable.id),
    })
    .from(workflowRunsTable)
    .where(eq(workflowRunsTable.workflow_id, props.workflow_id));

  return {
    allRuns: await findAllRuns(props),
    total: a[0].count,
  };
}

export async function findAllDeployments(workflow_id: string) {
  return await db.query.deploymentsTable.findMany({
    where: eq(deploymentsTable.workflow_id, workflow_id),
    orderBy: desc(deploymentsTable.environment),
    with: {
      machine: {
        columns: {
          name: true,
        },
      },
      version: true,
    },
  });
}
