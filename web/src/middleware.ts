import { authMiddleware, redirectToSignIn } from "@clerk/nextjs";
import createMiddleware from 'next-intl/middleware';

const I18nMiddleware = createMiddleware({
  locales: ["en", "zh"],
  defaultLocale: "en",
});

export default authMiddleware({
  beforeAuth: (req) => {
    // Execute next-intl middleware before Clerk's auth middleware
    const url = new URL(req.url);
    const pathname = url.pathname;
    if (pathname.startsWith("/api/")) return null;
    return I18nMiddleware(req);
  },
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
