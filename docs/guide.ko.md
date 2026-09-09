# 수다리 자세히 보기 🐚

[처음으로 / 설치 안내](../README.md) · [English](../README.en.md)

## 🤖 AI 에이전트 연동

수다리는 `127.0.0.1:37421` 에만 열리는 아주 작은 로컬 창구를 갖고 있어요.
작업 시작·끝에 요청 한 번씩만 보내면 같이 고민하고, 끝나면 폴짝 뛰어요.

```
http://127.0.0.1:37421/thinking          → 함께 고민
http://127.0.0.1:37421/done              → 완료 점프
http://127.0.0.1:37421/done?text=배포끝   → 말풍선 문구까지
```

아래 예시는 Windows용이에요. macOS에서는 `curl.exe`를 `curl`로 바꾸세요.

**Claude Code** 라면 `.claude/settings.json` 에 훅 두 개:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "curl.exe -s -m 1 http://127.0.0.1:37421/thinking" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "curl.exe -s -m 1 http://127.0.0.1:37421/done" } ] }
    ]
  }
}
```

Codex, Cursor 등 "작업 시작/종료에 명령 한 줄"을 걸 수 있는 도구라면 똑같이 동작해요.

<br>

## 🧩 어떻게 만들었나

수달은 그림 파일을 하나하나 그린 게 아니라 **[tools/gen_sprites.py](../tools/gen_sprites.py) 가 파라미터로 굽는** 스프라이트예요.
머리 크기·주둥이 위치·앞발 높이·꼬리 곡선 같은 값을 포즈마다 바꿔 17개 애니메이션 73프레임(72×64)을 만들어요.

'귀여운 캐릭터' 규칙을 그대로 따랐어요 — 머리는 크고 둥글게, 눈은 얼굴 중간 아래에 멀리, 큰 눈동자에 하이라이트,
코는 작고 뭉툭, 입은 작고 끝이 올라간 ω, 순검정 대신 채도 있는 어두운 갈색 외곽선, 디더링 없이 재질당 3톤.

- **눈은 굽지 않아요.** 프레임마다 눈 좌표만 내보내고 런타임에 그려요 → 시선 추적·깜빡임·`^^` 눈이 프레임 폭발 없이 가능
- **색은 팔레트 치환**으로 바꿔요. 크림색 부위는 밝기를 고정해 어떤 털색이든 얼굴이 읽혀요
- 손에 든 **가리비**는 13×11 비트맵을 손으로 찍었어요. 위쪽 세 결, 경첩으로 모이는 골, 왼쪽 위 하이라이트
- 소리는 오디오 파일 없이 **WebAudio 합성** — 수달다운 찍찍 소리, 고롱고롱, 조개 "딱", 폭죽 "펑"

```
main.js                 Electron 메인 — 투명·항상 위 창, 커서 폴링, 트레이, 로컬 엔드포인트
preload.js              contextBridge (nodeIntegration 없음)
renderer/pet.js         행동 엔진 — 상태 머신, 반응, 타이머, 애정 표현, 혼자 놀기, 폭죽
renderer/layout.js      창 크기·위치·배율 (Electron/브라우저 공통)
renderer/sprite.js      시트 로더 · 팔레트 리컬러 · 런타임 눈 · 정수 배율 전사
renderer/audio.js       WebAudio 합성 사운드
renderer/settings.*     설정 창 (실시간 미리보기)
tools/gen_sprites.py    ★ 스프라이트 제너레이터
tools/input_hook.ps1    전역 키/휠 후크 (키 내용은 읽지 않음)
tools/make_docs.py      이 README 의 이미지들
assets/                 생성된 시트·아틀라스 (커밋됨 — 실행에 Python 불필요)
```

<br>

