import { authMiddleware, redirectToSignIn } from "@clerk/nextjs";

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your Middleware
export default authMiddleware({
  // debug: true,
  publicRoutes: ["/", "/api/(.*)", "/docs(.*)", "/share(.*)"],
  // publicRoutes: ["/", "/(.*)"],
  async afterAuth(auth, req, evt) {
    // redirect them to organization selection page
    const userId = auth.userId;

    // Parse the URL to get the pathname
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (
      !auth.userId &&
      !auth.isPublicRoute
      // ||
      // pathname === "/create" ||
      // pathname === "/history" ||
      // pathname.startsWith("/edit")
    ) {
      const url = new URL(req.url);
      return redirectToSignIn({ returnBackUrl: url.origin });
    }
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
  // matcher: ['/','/create', '/api/(twitter|generation|init|voice-cloning)'],
};
