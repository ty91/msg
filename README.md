# msg

`msg`는 Slack Socket Mode를 사용해 특정 채널로 메시지를 보내는 Node.js/TypeScript 기반 CLI + daemon 도구입니다.

## 요구사항

- Node.js 20+
- pnpm
- Socket Mode가 설정된 Slack App

## 빠른 시작

1) 의존성 설치 및 빌드

```bash
pnpm install
pnpm build
```

2) 전역 명령으로 연결(선택)

```bash
pnpm link --global
```

3) 설정 파일 작성: `~/.msg/config.toml`

```toml
[slack]
app_token = "xapp-..."
bot_token = "xoxb-..."
default_channel = "C12345678"
```

4) 메시지 전송

```bash
msg noti "build done"
```

## 응답 형식

성공:

```json
{"ok":true}
```

실패:

```json
{"ok":false,"error":"SLACK_POST_FAILED"}
```

CLI는 Slack 전송 완료 후에만 응답을 반환합니다.

## 데몬 동작

- `msg noti` 실행 시 daemon이 없으면 자동으로 기동됩니다.
- 런타임 파일 위치:
  - 소켓: `~/.msg/msgd.sock`
  - PID: `~/.msg/msgd.pid`

수동 제어:

```bash
msg daemon start
msg daemon stop
msg daemon status
```

## 검증 명령

```bash
pnpm lint
pnpm typecheck
pnpm test
```
