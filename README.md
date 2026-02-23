# msg

`msg` is a Node.js/TypeScript CLI + daemon tool that sends Slack notifications via Socket Mode.

## Requirements

- Node.js 20+
- pnpm
- Slack app configured for Socket Mode

## Install

```bash
pnpm install
pnpm build
```

For local CLI testing:

```bash
pnpm link --global
```

## Config

Create `~/.msg/config.toml`:

```toml
[slack]
app_token = "xapp-..."
bot_token = "xoxb-..."
default_channel = "C12345678"
```

Runtime files are stored in `~/.msg/`:

- socket: `~/.msg/msgd.sock`
- pid: `~/.msg/msgd.pid`

## Usage

Send notification:

```bash
msg noti "build done"
```

Success output:

```json
{"ok":true}
```

Failure output:

```json
{"ok":false,"error":"SLACK_POST_FAILED"}
```

Daemon commands:

```bash
msg daemon start
msg daemon stop
msg daemon status
```

`msg noti` auto-starts daemon when needed.

## Quality Gate

```bash
pnpm lint
pnpm typecheck
pnpm test
```
