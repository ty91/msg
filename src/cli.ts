#!/usr/bin/env node

import { spawn } from "node:child_process";
import { MsgError, toErrorCode } from "./errors";
import { daemonStatus, runDaemon, stopDaemon } from "./daemon";
import { ensureRuntimeDir, getRuntimePaths } from "./config";
import { isDaemonUnavailableError, sendDaemonRequest } from "./ipc";
import { formatNotifyResponse, normalizeNotifyResponse } from "./noti-response";
import type { NotifyResponse } from "./types";

function writeJsonToStdout(payload: NotifyResponse): void {
  process.stdout.write(formatNotifyResponse(payload));
}

function writeUsage(): void {
  process.stderr.write("Usage:\n");
  process.stderr.write("  msg noti <message>\n");
  process.stderr.write("  msg daemon <start|stop|status|run>\n");
}

function resolveDaemonEntryPath(): string {
  return __filename;
}

async function waitForDaemon(timeoutMs = 5_000): Promise<void> {
  const paths = getRuntimePaths();
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      await sendDaemonRequest(paths, { type: "ping" });
      return;
    } catch (error) {
      if (!isDaemonUnavailableError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new MsgError("DAEMON_START_FAILED", "Timed out while waiting for daemon startup");
}

async function startDaemonIfNeeded(): Promise<void> {
  const paths = getRuntimePaths();
  const status = await daemonStatus(paths);

  if (status.running) {
    return;
  }

  await ensureRuntimeDir(paths);

  const child = spawn(process.execPath, [resolveDaemonEntryPath(), "daemon", "run"], {
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  await waitForDaemon();
}

async function sendNotification(message: string): Promise<NotifyResponse> {
  const paths = getRuntimePaths();

  try {
    const response = await sendDaemonRequest(paths, { type: "notify", message });
    return normalizeNotifyResponse(response);
  } catch (error) {
    if (!isDaemonUnavailableError(error)) {
      throw error;
    }
  }

  await startDaemonIfNeeded();
  const response = await sendDaemonRequest(paths, { type: "notify", message });
  return normalizeNotifyResponse(response);
}

async function handleNotiCommand(args: string[]): Promise<number> {
  const message = args.join(" ").trim();

  if (!message) {
    writeJsonToStdout({ ok: false, error: "INVALID_REQUEST" });
    return 1;
  }

  try {
    const response = await sendNotification(message);
    writeJsonToStdout(response);

    return response.ok ? 0 : 1;
  } catch (error) {
    writeJsonToStdout({ ok: false, error: toErrorCode(error) });
    return 1;
  }
}

async function handleDaemonCommand(args: string[]): Promise<number> {
  const subCommand = args[0];

  switch (subCommand) {
    case "run": {
      await runDaemon();
      return 0;
    }
    case "start": {
      await startDaemonIfNeeded();
      process.stderr.write("daemon started\n");
      return 0;
    }
    case "stop": {
      const stopped = await stopDaemon();
      process.stderr.write(stopped ? "daemon stopped\n" : "daemon not running\n");
      return 0;
    }
    case "status": {
      const status = await daemonStatus();
      process.stderr.write(
        status.running ? `daemon running (pid=${status.pid})\n` : "daemon not running\n",
      );
      return status.running ? 0 : 1;
    }
    default: {
      writeUsage();
      return 1;
    }
  }
}

async function main(): Promise<number> {
  const [, , command, ...args] = process.argv;

  if (command === "noti") {
    return handleNotiCommand(args);
  }

  if (command === "daemon") {
    return handleDaemonCommand(args);
  }

  writeUsage();
  return 1;
}

void main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
