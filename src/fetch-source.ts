export class SourceFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = "SourceFetchError";
  }
}

export async function fetchSource(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`Fetching source: ${url}`);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "referendum-feed-bot/1.0"
      },
      signal: controller.signal
    });

    console.log(`Source response status: ${response.status}`);

    if (!response.ok) {
      const body = await safeReadText(response);
      const retryable = response.status === 403 || response.status === 429 || response.status >= 500;
      throw new SourceFetchError(
        `Source returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
        response.status,
        retryable
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
      console.warn(`Unexpected content-type: ${contentType || "missing"}`);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new SourceFetchError(`Invalid JSON payload: ${errorMessage(error)}`, response.status, true);
    }
  } catch (error) {
    if (error instanceof SourceFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SourceFetchError(`Source fetch timed out after ${timeoutMs}ms`, undefined, true);
    }
    throw new SourceFetchError(`Source fetch failed: ${errorMessage(error)}`, undefined, true);
  } finally {
    clearTimeout(timeout);
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
