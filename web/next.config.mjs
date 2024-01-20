import { recmaPlugins } from "./src/mdx/recma.mjs";
import { rehypePlugins } from "./src/mdx/rehype.mjs";
import { remarkPlugins } from "./src/mdx/remark.mjs";
import withSearch from "./src/mdx/search.mjs";
import nextMDX from "@next/mdx";

const withMDX = nextMDX({
  options: {
    remarkPlugins,
    rehypePlugins,
    recmaPlugins,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withSearch(withMDX(nextConfig));

// export default million.next(
//   withSearch(withMDX(nextConfig)), { auto: { rsc: true } }
// );
