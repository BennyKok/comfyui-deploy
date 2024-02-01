"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseAsInteger } from "next-usequerystate";
import {
  findAllRunsWithCounts,
  getAllRunstableContent,
} from "../server/findAllRuns";
import { PaginationControl } from "./PaginationControl";
import { RunDisplay } from "./RunDisplay";
import useSWR from "swr";
import { LoadingIcon } from "@/components/LoadingIcon";

const itemPerPage = 6;
const pageParser = parseAsInteger.withDefault(1);

export function RunsTable(props: {
  workflow_id: string;
  searchParams: { [key: string]: any };
}) {
  const page = pageParser.parse(props.searchParams?.page ?? undefined) ?? 1;
  const { data, error, isLoading, isValidating } = useSWR(
    "runs+" + page,
    async () => {
      const data = await getAllRunstableContent({
        workflow_id: props.workflow_id,
        limit: itemPerPage,
        offset: (page - 1) * itemPerPage,
      });
      return data;
    },
    {
      // suspense: false,
      refreshInterval: 5000,
    },
  );

  // await new Promise((resolve) => setTimeout(resolve, 5000));

  return (
    <div>
      {isValidating ? (
        <div className="absolute right-8 top-8">
          <LoadingIcon />
        </div>
      ) : null}
      <div className="overflow-auto h-fit w-full">
        <Table className="">
          {/* {data?.allRuns.length === 0 && (
            <TableCaption>A list of your recent runs.</TableCaption>
          )} */}
          <TableHeader className="bg-background top-0 sticky">
            <TableRow>
              <TableHead className="truncate">Number</TableHead>
              <TableHead className="truncate">Machine</TableHead>
              <TableHead className="truncate">Time</TableHead>
              <TableHead className="truncate">Version</TableHead>
              <TableHead className="truncate">Origin</TableHead>
              <TableHead className="truncate">Duration</TableHead>
              <TableHead className="truncate">Live Status</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{data?.table}</TableBody>
        </Table>
      </div>

      {data && Math.ceil(data.total / itemPerPage) > 0 && (
        <PaginationControl
          totalPage={Math.ceil(data.total / itemPerPage)}
          currentPage={page}
        />
      )}
    </div>
  );
}
