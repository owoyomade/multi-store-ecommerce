import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";

// Better Auth handles every /api/auth/* request (sign-in, sign-up, verify, reset).
export const { GET, POST } = toNextJsHandler(auth);
