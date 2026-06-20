import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);
export { auth as middleware };

export const config = {
  // Only protect dashboard and host routes
  matcher: ["/dashboard/:path*", "/host/:path*"],
};
