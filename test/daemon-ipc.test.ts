import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createIpcServer } from "../src/daemon";
import { getRuntimePaths } from "../src/config";
import { sendDaemonRequest } from "../src/ipc";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dirPath) => {
      await rm(dirPath, { recursive: true, force: true });
    }),
  );
});

describe("daemon ipc", () => {
  test("returns notify response over socket", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "msgd-home-"));
    tempDirs.push(homeDir);

    const paths = getRuntimePaths(homeDir);
    await mkdir(paths.dirPath, { recursive: true });

    const receivedMessages: string[] = [];
    const server = createIpcServer({
      sendMessage: async (message: string) => {
        receivedMessages.push(message);
      },
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(paths.socketPath, resolve);
    });

    const response = await sendDaemonRequest(paths, {
      type: "notify",
      message: "hi",
    });

    expect(response).toEqual({ ok: true });
    expect(receivedMessages).toEqual(["hi"]);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });
});
