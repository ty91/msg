import { describe, expect, test } from "vitest";
import { MsgError } from "../src/errors";
import { formatNotifyResponse, normalizeNotifyResponse } from "../src/noti-response";

describe("noti response", () => {
  test("normalizes success to only ok=true", () => {
    const normalized = normalizeNotifyResponse({ ok: true, ignored: "value" });

    expect(normalized).toEqual({ ok: true });
    expect(formatNotifyResponse(normalized)).toBe('{"ok":true}\n');
  });

  test("normalizes error with ok and error fields", () => {
    const normalized = normalizeNotifyResponse({ ok: false, error: "SLACK_POST_FAILED" });

    expect(normalized).toEqual({ ok: false, error: "SLACK_POST_FAILED" });
    expect(formatNotifyResponse(normalized)).toBe('{"ok":false,"error":"SLACK_POST_FAILED"}\n');
  });

  test("throws on invalid response object", () => {
    expect(() => normalizeNotifyResponse({ ok: false })).toThrowError(MsgError);
  });
});
