import { toast } from "sonner";
import { z } from "zod";

const RepoSchema = z.object({
  default_branch: z.string(),
});
const BranchInfoSchema = z.object({
  commit: z.object({
    sha: z.string(),
  }),
});
function extractRepoName(repoUrl: string) {
  const url = new URL(repoUrl);
  const pathParts = url.pathname.split("/");
  const repoName = pathParts[2].replace(".git", "");
  const author = pathParts[1];
  return `${author}/${repoName}`;
}
export async function getBranchInfo(gitUrl: string) {
  const repoName = extractRepoName(gitUrl);
  const id = toast.loading(`Fetching repo info...`);
  const repo = await fetch(`https://api.github.com/repos/${repoName}`)
    .then((x) => x.json())
    .then((x) => {
      console.log(x);
      return x;
    })
    .then((x) => RepoSchema.parse(x))
    .catch((e) => {
      console.error(e);
      toast.dismiss(id);
      toast.error(`Failed to fetch repo info ${e.message}`);
      return null;
    });

  if (!repo) return;
  const branch = repo.default_branch;
  const branchInfo = await fetch(
    `https://api.github.com/repos/${repoName}/branches/${branch}`,
  )
    .then((x) => x.json())
    .then((x) => BranchInfoSchema.parse(x))
    .catch((e) => {
      console.error(e);
      toast.dismiss(id);
      toast.error(`Failed to fetch branch info ${e.message}`);
      return null;
    });

  toast.dismiss(id);
  return branchInfo;
}
