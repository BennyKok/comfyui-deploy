import { OutputRender } from "./RunDisplay";
import { CodeBlock } from "@/components/CodeBlock";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRunsOutput } from "@/server/getRunsOutput";

export async function RunOutputs({ run_id }: { run_id: string }) {
  const outputs = await getRunsOutput(run_id);
  console.log("Getting runs out put");

  // const [outputs, setOutputs] =
  //   useState<Awaited<ReturnType<typeof getRunsOutput>>>();

  // useEffect(() => {
  //   if (!run_id) return;
  //   // fetch(`/api/run?run_id=${run_id}`)
  //   //   .then((x) => x.json())
  //   //   .then((x) => setOutputs(x));
  //   callServerPromise(getRunsOutput(run_id).then((x) => setOutputs(x)));
  // }, [run_id]);

  return (
    <Table className="table-fixed">
      {/* <TableCaption>A list of your recent runs.</TableCaption> */}
      <TableHeader className="bg-background top-0 sticky">
        <TableRow>
          <TableHead className="w-[200px]">File</TableHead>
          <TableHead className="">Output</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {outputs?.map((run) => {
          const fileName = run.data.images?.[0].filename;

          if (!fileName)
            return (
              <TableRow key={run.id}>
                <TableCell>Output</TableCell>
                <TableCell className="">
                  <CodeBlock
                    code={JSON.stringify(run.data, null, 2)}
                    lang="json"
                  />
                </TableCell>
              </TableRow>
            );

          // const filePath
          return (
            <TableRow key={run.id}>
              <TableCell className="break-words">{fileName}</TableCell>
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
