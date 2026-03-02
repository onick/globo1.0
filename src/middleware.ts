import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isPublic = isAuthPage || isApiAuth;

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    return Response.redirect(loginUrl);
  }

  if (req.auth && isAuthPage) {
    const dashboardUrl = new URL("/map", req.url);
    return Response.redirect(dashboardUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
