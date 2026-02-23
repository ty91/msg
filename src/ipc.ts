import net from "node:net";
import { MsgError } from "./errors";
import type { DaemonRequest, DaemonResponse, RuntimePaths } from "./types";

const IPC_TIMEOUT_MS = 15_000;

function parseResponse(raw: string): DaemonResponse {
  try {
    return JSON.parse(raw) as DaemonResponse;
  } catch {
    throw new MsgError("DAEMON_BAD_RESPONSE", "Daemon returned non-JSON response");
  }
}

export function isDaemonUnavailableError(error: unknown): boolean {
  const nodeError = error as NodeJS.ErrnoException;

  return (
    nodeError?.code === "ENOENT" ||
    nodeError?.code === "ECONNREFUSED" ||
    nodeError?.code === "EPIPE" ||
    nodeError?.code === "ENOTCONN"
  );
}

export async function sendDaemonRequest(
  paths: RuntimePaths,
  request: DaemonRequest,
): Promise<DaemonResponse> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(paths.socketPath);
    const timer = setTimeout(() => {
      socket.destroy(new MsgError("DAEMON_UNAVAILABLE", "Daemon timed out"));
    }, IPC_TIMEOUT_MS);

    let responseBuffer = "";

    const cleanup = (): void => {
      clearTimeout(timer);
      socket.removeAllListeners();
    };

    socket.once("error", (error) => {
      cleanup();
      reject(error);
    });

    socket.on("data", (chunk) => {
      responseBuffer += chunk.toString("utf8");
    });

    socket.once("end", () => {
      cleanup();
      const trimmed = responseBuffer.trim();

      if (!trimmed) {
        reject(new MsgError("DAEMON_BAD_RESPONSE", "Daemon returned empty response"));
        return;
      }

      try {
        resolve(parseResponse(trimmed));
      } catch (error) {
        reject(error);
      }
    });

    socket.once("connect", () => {
      socket.end(`${JSON.stringify(request)}\n`);
    });
  });
}

export function writeDaemonResponse(socket: net.Socket, response: DaemonResponse): void {
  socket.end(`${JSON.stringify(response)}\n`);
}

export function parseDaemonRequest(raw: string): DaemonRequest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new MsgError("INVALID_REQUEST", "Request is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new MsgError("INVALID_REQUEST", "Request body must be an object");
  }

  const type = (parsed as { type?: unknown }).type;

  if (type === "ping") {
    return { type: "ping" };
  }

  if (type === "notify") {
    const message = (parsed as { message?: unknown }).message;

    if (typeof message !== "string" || message.trim().length === 0) {
      throw new MsgError("INVALID_REQUEST", "notify.message must be a non-empty string");
    }

    return { type: "notify", message };
  }

  throw new MsgError("INVALID_REQUEST", "Unsupported request type");
}
