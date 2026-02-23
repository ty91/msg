import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as toml from "toml";
import { MsgError } from "./errors";
import type { MsgConfig, RuntimePaths } from "./types";

const MSG_DIR_NAME = ".msg";
const CONFIG_FILE_NAME = "config.toml";
const SOCKET_FILE_NAME = "msgd.sock";
const PID_FILE_NAME = "msgd.pid";

export function getRuntimePaths(homeDir = os.homedir()): RuntimePaths {
  const dirPath = path.join(homeDir, MSG_DIR_NAME);

  return {
    dirPath,
    configPath: path.join(dirPath, CONFIG_FILE_NAME),
    socketPath: path.join(dirPath, SOCKET_FILE_NAME),
    pidPath: path.join(dirPath, PID_FILE_NAME),
  };
}

export async function ensureRuntimeDir(paths: RuntimePaths): Promise<void> {
  await fs.mkdir(paths.dirPath, { recursive: true, mode: 0o700 });
}

type RawSlackConfig = {
  app_token?: unknown;
  appToken?: unknown;
  bot_token?: unknown;
  botToken?: unknown;
  default_channel?: unknown;
  defaultChannel?: unknown;
};

type RawConfig = {
  slack?: RawSlackConfig;
};

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MsgError("CONFIG_INVALID", `Missing or invalid field: ${fieldName}`);
  }

  return value.trim();
}

export function parseConfigText(configText: string): MsgConfig {
  let parsed: RawConfig;

  try {
    parsed = toml.parse(configText) as RawConfig;
  } catch (error) {
    throw new MsgError("CONFIG_INVALID", `Invalid TOML: ${String(error)}`);
  }

  const slack = parsed.slack;

  if (!slack) {
    throw new MsgError("CONFIG_INVALID", "Missing [slack] section");
  }

  return {
    slack: {
      appToken: parseRequiredString(slack.app_token ?? slack.appToken, "slack.app_token"),
      botToken: parseRequiredString(slack.bot_token ?? slack.botToken, "slack.bot_token"),
      defaultChannel: parseRequiredString(
        slack.default_channel ?? slack.defaultChannel,
        "slack.default_channel",
      ),
    },
  };
}

export async function loadConfig(paths: RuntimePaths): Promise<MsgConfig> {
  let configText: string;

  try {
    configText = await fs.readFile(paths.configPath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      throw new MsgError("CONFIG_NOT_FOUND", `Config not found: ${paths.configPath}`);
    }

    throw error;
  }

  return parseConfigText(configText);
}

export const EXAMPLE_CONFIG = `# ~/.msg/config.toml
[slack]
app_token = "xapp-..."
bot_token = "xoxb-..."
default_channel = "C12345678"
`;
