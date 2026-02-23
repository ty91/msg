import { describe, expect, test } from "vitest";
import { MsgError } from "../src/errors";
import { parseDaemonRequest } from "../src/ipc";

describe("ipc request parser", () => {
  test("parses ping request", () => {
    expect(parseDaemonRequest('{"type":"ping"}')).toEqual({ type: "ping" });
  });

  test("parses notify request", () => {
    expect(parseDaemonRequest('{"type":"notify","message":"hello"}')).toEqual({
      type: "notify",
      message: "hello",
    });
  });

  test("throws on invalid notify payload", () => {
    expect(() => parseDaemonRequest('{"type":"notify","message":""}')).toThrowError(MsgError);
  });
});
