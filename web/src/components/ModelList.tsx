"use client";

import { getRelativeTime } from "../lib/getRelativeTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InsertModal } from "./InsertModal";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { getAllUserModels as getAllUserModels } from "@/server/getAllUserModel";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import * as React from "react";
import { addCivitaiModel } from "@/server/curdModel";
import { addCivitaiModelSchema } from "@/server/addCivitaiModelSchema";
import { modelEnumType } from "@/db/schema";

export type ModelItemList = NonNullable<
  Awaited<ReturnType<typeof getAllUserModels>>
>[0];

export const columns: ColumnDef<ModelItemList>[] = [
  {
    accessorKey: "id",
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "model_name",
    header: ({ column }) => {
      return (
        <button
          className="flex items-center hover:underline"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Model Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </button>
      );
    },
    cell: ({ row }) => {
      const model = row.original;
      return (
        <>
          {
            /*<a
          className="hover:underline flex gap-2"
          href={`/storage/${model.id}`} // TODO
        >*/
          }
          <span className="truncate max-w-[200px]">
            {row.original.model_name}
          </span>

          {model.is_public
            ? <></>
            : <Badge variant="orange">Private</Badge>}
        </>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <button
          className="flex items-center hover:underline"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </button>
      );
    },
    cell: ({ row }) => {
      return (
        <Badge
          variant={row.original.status === "failed"
            ? "red"
            : (row.original.status === "started" ? "yellow" : "green")}
        >
          {row.original.status}
        </Badge>
      );
      // NOTE: retry downloads on failures
      // const oneHourAgo = new Date(new Date().getTime() - (60 * 60 * 1000));
      // const lastUpdated = new Date(row.original.updated_at);
      // const canRefresh = row.original.status === "failed" && lastUpdated < oneHourAgo;
      // const canRefresh = row.original.status === "failed" && lastUpdated < oneHourAgo;
      // cell: ({ row }) => {
      //   // const oneHourAgo = new Date(new Date().getTime() - (60 * 60 * 1000));
      //   // const lastUpdated = new Date(row.original.updated_at);
      //   // const canRefresh = row.original.status === "failed" && lastUpdated < oneHourAgo;
      //   const canReDownload = true;
      //
      //   return (
      //     <div className="flex items-center space-x-2">
      //       <Badge
      //         variant={row.original.status === "failed"
      //           ? "red"
      //           : row.original.status === "started"
      //           ? "yellow"
      //           : "green"}
      //       >
      //         {row.original.status}
      //       </Badge>
      //       {canReDownload && (
      //         <RefreshCcw
      //           onClick={() => {
      //             redownloadCheckpoint(row.original);
      //           }}
      //           className="h-4 w-4 cursor-pointer" // Adjust the size with h-x and w-x classes
      //         />
      //       )}
      //     </div>
      //   );
      // },
    },
  },
  {
    accessorKey: "upload_type",
    header: ({ column }) => {
      return (
        <button
          className="flex items-center hover:underline"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Source
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </button>
      );
    },
    cell: ({ row }) => {
      return <Badge variant="cyan">{row.original.upload_type}</Badge>;
    },
  },
  {
    accessorKey: "model_type",
    header: ({ column }) => {
      return (
        <button
          className="flex items-center hover:underline"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Model Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </button>
      );
    },
    cell: ({ row }) => {
      const model_type_map: Record<modelEnumType, any> = {
        "checkpoint": "amber",
        "lora": "green",
        "embedding": "violet",
        "vae": "teal",
      };

      function getBadgeColor(modelType: modelEnumType) {
        return model_type_map[modelType] || "default";
      }

      const color = getBadgeColor(row.original.model_type);
      return <Badge variant={color}>{row.original.model_type}</Badge>;
    },
  },
  {
    accessorKey: "date",
    sortingFn: "datetime",
    enableSorting: true,
    header: ({ column }) => {
      return (
        <button
          className="w-full flex items-center justify-end hover:underline truncate"
          // variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Update Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </button>
      );
    },
    cell: ({ row }) => (
      <div className="w-full capitalize text-right truncate">
        {getRelativeTime(row.original.updated_at)}
      </div>
    ),
  },
  // TODO: deletion and editing for future sprint
  // {
  //   id: "actions",
  //   enableHiding: false,
  //   cell: ({ row }) => {
  //     const checkpoint = row.original;
  //
  //     return (
  //       <DropdownMenu>
  //         <DropdownMenuTrigger asChild>
  //           <Button variant="ghost" className="h-8 w-8 p-0">
  //             <span className="sr-only">Open menu</span>
  //             <MoreHorizontal className="h-4 w-4" />
  //           </Button>
  //         </DropdownMenuTrigger>
  //         <DropdownMenuContent align="end">
  //           <DropdownMenuLabel>Actions</DropdownMenuLabel>
  //           <DropdownMenuItem
  //             className="text-destructive"
  //             onClick={() => {
  //               deleteWorkflow(checkpoint.id);
  //             }}
  //           >
  //             Delete Workflow
  //           </DropdownMenuItem>
  //         </DropdownMenuContent>
  //       </DropdownMenu>
  //     );
  //   },
  // },
];

export function ModelList({ data }: { data: ModelItemList[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] = React.useState<
    VisibilityState
  >({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="grid grid-rows-[auto,1fr,auto] h-full">
      <div className="flex flex-row w-full items-center py-4">
        <Input
          placeholder="Filter workflows..."
          value={(table.getColumn("model_name")?.getFilterValue() as string) ??
            ""}
          onChange={(event) =>
            table.getColumn("model_name")?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        <div className="ml-auto flex gap-2">
          <InsertModal
            dialogClassName="sm:max-w-[600px]"
            disabled={
              false
              // TODO: limitations based on plan
            }
            tooltip={"Add models using their civitai url!"}
            title="Add a Civitai Model"
            description="Pick a model from civitai"
            serverAction={addCivitaiModel}
            formSchema={addCivitaiModelSchema}
            fieldConfig={{
              civitai_url: {
                fieldType: "fallback",
                inputProps: { required: true },
                description: (
                  <>
                    Pick a model from{" "}
                    <a
                      href="https://www.civitai.com/models"
                      target="_blank"
                      className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
                    >
                      civitai.com
                    </a>{" "}
                    and place it's url here
                  </>
                ),
              },
            }}
          />
        </div>
      </div>
      <ScrollArea className="h-full w-full rounded-md border">
        <Table>
          <TableHeader className="bg-background top-0 sticky">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length
              ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )
              : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </ScrollArea>
      <div className="flex flex-row items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
