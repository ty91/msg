import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { MsgError } from "./errors";
import type { MsgConfig } from "./types";

export class SlackClient {
  private readonly webClient: WebClient;
  private readonly socketModeClient: SocketModeClient;
  private started = false;

  constructor(private readonly config: MsgConfig) {
    this.webClient = new WebClient(config.slack.botToken);
    this.socketModeClient = new SocketModeClient({ appToken: config.slack.appToken });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    try {
      await this.socketModeClient.start();
      this.started = true;
    } catch (error) {
      throw new MsgError("SLACK_SOCKET_MODE_FAILED", String(error));
    }
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    await this.socketModeClient.disconnect();
    this.started = false;
  }

  async sendMessage(message: string): Promise<void> {
    try {
      const response = await this.webClient.chat.postMessage({
        channel: this.config.slack.defaultChannel,
        text: message,
      });

      if (!response.ok) {
        throw new MsgError("SLACK_POST_FAILED", response.error ?? "Slack API returned ok=false");
      }
    } catch (error) {
      if (error instanceof MsgError) {
        throw error;
      }

      throw new MsgError("SLACK_POST_FAILED", String(error));
    }
  }
}
