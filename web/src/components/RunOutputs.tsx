"use client";

import { OutputRender } from "./RunDisplay";
import { callServerPromise } from "@/components/MachineList";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRunsOutput } from "@/server/getRunsOutput";
import { useEffect, useState } from "react";

export function RunOutputs({ run_id }: { run_id: string }) {
  const [outputs, setOutputs] =
    useState<Awaited<ReturnType<typeof getRunsOutput>>>();

  useEffect(() => {
    if (!run_id) return;
    // fetch(`/api/run?run_id=${run_id}`)
    //   .then((x) => x.json())
    //   .then((x) => setOutputs(x));
    callServerPromise(getRunsOutput(run_id).then((x) => setOutputs(x)));
  }, [run_id]);

  return (
    <Table>
      {/* <TableCaption>A list of your recent runs.</TableCaption> */}
      <TableHeader className="bg-background top-0 sticky">
        <TableRow>
          <TableHead className="w-[100px]">File</TableHead>
          <TableHead className="">Output</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {outputs?.map((run) => {
          const fileName = run.data.images[0].filename;
          // const filePath
          return (
            <TableRow key={run.id}>
              <TableCell>{fileName}</TableCell>
              <TableCell>
                <OutputRender run_id={run_id} filename={fileName} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
