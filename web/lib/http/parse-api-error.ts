export async function parseJsonError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; detail?: string };
    if (typeof body.error === "string") {
      return body.error;
    }
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // fall through to fallback message
  }
  return fallback;
}
