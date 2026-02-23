import { MsgError } from "./errors";
import type { NotifyResponse } from "./types";

export function normalizeNotifyResponse(response: unknown): NotifyResponse {
  if (!response || typeof response !== "object") {
    throw new MsgError("DAEMON_BAD_RESPONSE", "Response is not an object");
  }

  const ok = (response as { ok?: unknown }).ok;

  if (ok === true) {
    return { ok: true };
  }

  if (ok === false) {
    const error = (response as { error?: unknown }).error;

    if (typeof error !== "string" || error.length === 0) {
      throw new MsgError("DAEMON_BAD_RESPONSE", "Response error is missing");
    }

    return { ok: false, error };
  }

  throw new MsgError("DAEMON_BAD_RESPONSE", "Response has invalid shape");
}

export function formatNotifyResponse(response: NotifyResponse): string {
  return `${JSON.stringify(response)}\n`;
}
