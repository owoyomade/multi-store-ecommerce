import type { Instrumentation } from "next";
import { redactPath, reportError } from "./server/observability";

// Next.js calls this for every unhandled server error: pages, route
// handlers, server actions and the proxy.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  await reportError("request.failed", error, {
    method: request.method,
    path: redactPath(request.path),
    route: context.routePath,
    routeType: context.routeType,
  });
};
