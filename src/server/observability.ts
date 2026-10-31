// One place where server errors are reported. Today it writes a single JSON
// line to the server log (which every hosting platform collects). Setting
// ERROR_REPORT_URL also sends each report to an error-tracking service, so
// adding monitoring in Phase 6 is configuration, not code.

type ErrorDetails = Record<string, string | number | boolean | undefined>;

/**
 * Paths can carry secrets: invite links and password-reset tokens. Reports
 * keep only the shape of the path, e.g. /invite/[token], and never the query
 * string, headers or cookies.
 */
export function redactPath(path: string): string {
  return path
    .split("?")[0]
    .replace(/^\/invite\/[^/]+/, "/invite/[token]")
    .replace(/^\/reset-password\/[^/]+/, "/reset-password/[token]");
}

export async function reportError(
  event: string,
  error: unknown,
  details: ErrorDetails = {},
): Promise<void> {
  const report = {
    level: "error",
    event,
    time: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    // React replaces errors from server components with a digest (an ID)
    // that matches the one shown to the user, which links the two.
    digest:
      typeof error === "object" && error !== null && "digest" in error
        ? String(error.digest)
        : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    ...details,
  };
  console.error(JSON.stringify(report));

  const reportUrl = process.env.ERROR_REPORT_URL;
  if (!reportUrl) return;
  try {
    await fetch(reportUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      // A slow tracker must never hold up the request that failed.
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    console.error(
      JSON.stringify({ level: "warn", event: "error_report.send_failed" }),
    );
  }
}
