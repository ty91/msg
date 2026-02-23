import { promises as fs } from "node:fs";
import net from "node:net";
import { MsgError, toErrorCode } from "./errors";
import { ensureRuntimeDir, getRuntimePaths, loadConfig } from "./config";
import { parseDaemonRequest, writeDaemonResponse } from "./ipc";
import { SlackClient } from "./slack-client";
import type { DaemonResponse, RuntimePaths } from "./types";

type SlackNotifier = {
  sendMessage: (message: string) => Promise<void>;
};

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
}

async function readPid(paths: RuntimePaths): Promise<number | null> {
  try {
    const raw = await fs.readFile(paths.pidPath, "utf8");
    const pid = Number.parseInt(raw.trim(), 10);

    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid: number, timeoutMs = 3_000): Promise<boolean> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return !isProcessAlive(pid);
}

export async function stopDaemon(paths = getRuntimePaths()): Promise<boolean> {
  const pid = await readPid(paths);

  if (!pid) {
    await safeUnlink(paths.socketPath);
    await safeUnlink(paths.pidPath);
    return false;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== "ESRCH") {
      throw error;
    }
  }

  await waitForExit(pid);
  await safeUnlink(paths.socketPath);
  await safeUnlink(paths.pidPath);

  return true;
}

export async function daemonStatus(paths = getRuntimePaths()): Promise<{
  running: boolean;
  pid: number | null;
}> {
  const pid = await readPid(paths);

  if (!pid) {
    return { running: false, pid: null };
  }

  return { running: isProcessAlive(pid), pid };
}

async function removeStaleSocket(paths: RuntimePaths): Promise<void> {
  const status = await daemonStatus(paths);

  if (!status.running) {
    await safeUnlink(paths.socketPath);
  }
}

async function handleRequest(
  rawRequest: string,
  slackClient: SlackNotifier,
): Promise<DaemonResponse> {
  try {
    const request = parseDaemonRequest(rawRequest.trim());

    if (request.type === "ping") {
      return { ok: true, pid: process.pid };
    }

    if (request.type === "notify") {
      await slackClient.sendMessage(request.message);
      return { ok: true };
    }

    return { ok: false, error: "INVALID_REQUEST" };
  } catch (error) {
    return { ok: false, error: toErrorCode(error) };
  }
}

async function writePid(paths: RuntimePaths): Promise<void> {
  await fs.writeFile(paths.pidPath, `${process.pid}\n`, "utf8");
}

function setupConnectionHandler(server: net.Server, slackClient: SlackNotifier): void {
  server.on("connection", (socket) => {
    let buffer = "";
    let responded = false;

    const respond = async (): Promise<void> => {
      if (responded) {
        return;
      }

      responded = true;
      const response = await handleRequest(buffer, slackClient);
      writeDaemonResponse(socket, response);
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      if (buffer.includes("\n")) {
        void respond();
      }
    });

    socket.on("end", () => {
      void respond();
    });

    socket.on("error", () => {
      socket.destroy();
    });
  });
}

export function createIpcServer(slackClient: SlackNotifier): net.Server {
  const server = net.createServer({ allowHalfOpen: true });
  setupConnectionHandler(server, slackClient);
  return server;
}

export async function runDaemon(paths = getRuntimePaths()): Promise<void> {
  await ensureRuntimeDir(paths);
  await removeStaleSocket(paths);

  const config = await loadConfig(paths);
  const slackClient = new SlackClient(config);
  await slackClient.start();

  const server = createIpcServer(slackClient);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(paths.socketPath, resolve);
  });

  await fs.chmod(paths.socketPath, 0o600);
  await writePid(paths);

  let shuttingDown = false;

  const shutdown = async (exitCode = 0): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await slackClient.stop();
    await safeUnlink(paths.socketPath);
    await safeUnlink(paths.pidPath);

    process.exit(exitCode);
  };

  process.on("SIGINT", () => {
    void shutdown(0);
  });

  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  process.on("uncaughtException", () => {
    void shutdown(1);
  });

  process.on("unhandledRejection", () => {
    void shutdown(1);
  });

  if (process.argv.includes("--once")) {
    throw new MsgError("INVALID_REQUEST", "--once is not supported");
  }

  await new Promise(() => {
    // Keep daemon process alive until it receives a termination signal.
  });
}
