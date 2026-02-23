import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { getRuntimePaths, loadConfig, parseConfigText } from "../src/config";
import { MsgError } from "../src/errors";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dirPath) => {
      await rm(dirPath, { recursive: true, force: true });
    }),
  );
});

describe("config", () => {
  test("parses valid config text", () => {
    const config = parseConfigText(`
[slack]
app_token = "xapp-abc"
bot_token = "xoxb-abc"
default_channel = "C123"
`);

    expect(config).toEqual({
      slack: {
        appToken: "xapp-abc",
        botToken: "xoxb-abc",
        defaultChannel: "C123",
      },
    });
  });

  test("throws CONFIG_INVALID when required fields are missing", () => {
    expect(() =>
      parseConfigText(`
[slack]
app_token = "xapp-abc"
`),
    ).toThrowError(MsgError);

    try {
      parseConfigText(`
[slack]
app_token = "xapp-abc"
`);
    } catch (error) {
      expect(error).toBeInstanceOf(MsgError);
      expect((error as MsgError).code).toBe("CONFIG_INVALID");
    }
  });

  test("loads config from ~/.msg/config.toml path", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "msg-home-"));
    tempDirs.push(homeDir);

    const paths = getRuntimePaths(homeDir);
    await mkdir(paths.dirPath, { recursive: true });
    await writeFile(
      paths.configPath,
      `
[slack]
app_token = "xapp-123"
bot_token = "xoxb-123"
default_channel = "C999"
`,
      "utf8",
    );

    const config = await loadConfig(paths);
    expect(config.slack.defaultChannel).toBe("C999");
  });

  test("throws CONFIG_NOT_FOUND when config file does not exist", async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "msg-home-"));
    tempDirs.push(homeDir);

    const paths = getRuntimePaths(homeDir);

    await expect(loadConfig(paths)).rejects.toMatchObject({
      code: "CONFIG_NOT_FOUND",
    });
  });
});
