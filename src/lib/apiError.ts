/**
 * Converts a failed fetch response (or a caught error) into a user-friendly
 * message and logs full technical details (status, URL, response body) to
 * the browser console so developers can diagnose the real cause.
 */
export async function friendlyError(
  err: unknown,
  res?: Response,
): Promise<string> {
  if (res !== undefined) {
    let body = "(could not read body)";
    try {
      body = await res.clone().text();
    } catch {
      // ignore — body logging is best-effort
    }
    console.error(
      `[VYVA] API error — ${res.status} ${res.statusText} ${res.url}`,
      body,
    );
  } else {
    console.error("[VYVA] Network error:", err);
  }

  if (res !== undefined) {
    if (res.status === 401)
      return "Your session expired — please refresh the page.";
    if (res.status === 403)
      return "Access denied — please refresh and try again.";
    if (res.status >= 500)
      return "Server error — please try again in a moment.";
    if (res.status >= 400)
      return `Request error (${res.status}) — please try again.`;
  }

  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
    return "Cannot reach the server — please check your internet connection.";
  }

  return "Something went wrong — please try again.";
}
