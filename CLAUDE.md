# circuit — 작업 규칙

중학교 「전기와 자기」 단원 수업용 시뮬레이터 모음. 학습지 앱(`chan7881/class`)에
iframe으로 임베드해서 쓴다. 배포: `https://chan7881.github.io/circuit/`

> 공통 규칙(결론을 미리 말하지 않기, 물리 검증 절차, 화면·배포 규칙)은
> **`../CLAUDE.md`**에 있다. 여기에는 이 리포에만 해당하는 것만 적는다.

## 구조

빌드 도구 없음. 순수 ES 모듈. 시뮬레이터마다:

```
<이름>/index.html      레이아웃 · 조작 UI
<이름>/js/model.js     순수 로직(DOM 모름) — 여기만 테스트한다
<이름>/js/render.js    그리기
<이름>/js/main.js      DOM 이벤트 ↔ 모델 ↔ 그리기 (document를 만지는 유일한 파일)
<이름>/js/tests.js     model.js 검증
<이름>/test.html       브라우저에서 여는 자체 검증 페이지
```

- 스타일은 `friction/styles.css` 하나를 모든 하위 시뮬레이터가 공유한다.
- 3D는 `vendor/three/`(three.js 0.160.0, MIT)를 import map으로 불러 쓴다. CDN 의존 없음.
- 임베드가 납작하다(높이 ~260px). `touch-action: none` 필요.

## 물리 검증 절차

공통 규칙 2번의 7단계를 따른다. **전체 절차와 이 리포에서 잡은 버그 목록은
`docs/물리_검증_절차.md`**에 있다 — 다른 프로젝트도 이 문서를 참조한다.

## 이 리포에서만 겪는 것

- **브라우저가 ES 모듈을 캐시한다.** 고쳤는데 화면이 그대로면 **포트를 바꿔서** 열어 볼 것.
- **백그라운드 탭에서는 `requestAnimationFrame`이 돌지 않는다** → 확인용 스크립트에서는
  그리기 함수를 직접 호출한다. `await new Promise(r => requestAnimationFrame(r))`는 영영 안 풀린다.
- 캔버스를 이미지로 뽑으려면 WebGL 컨텍스트에 **`preserveDrawingBuffer: true`**가 있어야 한다.
- 배포 확인은 파일을 그대로 올리므로 함수명으로 볼 수 있다(번들이 아니라서):
  `curl -s https://chan7881.github.io/circuit/<시뮬>/js/model.js | grep <바꾼_함수명>`
  — 다만 공통 규칙 5번대로 **그 이름이 이번에 처음 생긴 것인지** 먼저 확인할 것.

## 테스트

각 시뮬의 `test.html`을 브라우저에서 열거나, node로 한 번에 돌린다:

```bash
node --input-type=module -e "
const m = await import('file:///<절대경로>/<시뮬>/js/tests.js')
const r = m.runAll()
console.log('PASS ' + r.filter(x=>x.ok).length + ' / FAIL ' + r.filter(x=>!x.ok).length)
for (const x of r) if (!x.ok) console.log(x.label)"
```

⚠️ 결과 객체의 필드는 **`label`**이다(`message`가 아니다) — 잘못 쓰면 실패 내용이 `undefined`로 찍힌다.
