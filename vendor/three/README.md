# vendor/three — three.js 0.160.0 (직접 내려받아 포함)

이 폴더는 [three.js](https://threejs.org)를 CDN에서 매번 불러오지 않고 저장소 안에
직접 포함한 것입니다 — 이 리포지토리의 "빌드 도구 없음·CDN 의존 없음" 원칙(README 참고)을
지키면서도 3D 시뮬레이터(코일 자기장·전동기)를 만들기 위한 것입니다(2026-08-06 사용자 결정).

## 들어있는 파일

- `three.module.js` — three.js 본체의 **축소(minified) ES 모듈** 빌드. npm의 `three@0.160.0`
  패키지에서 `build/three.module.min.js`를 그대로 가져왔습니다. 우리가 직접 고치는 파일이
  아니라서 축소본을 썼습니다 — 저장소 용량을 아끼기 위함입니다.
- `OrbitControls.js` — 손가락(마우스)으로 카메라를 궤도 회전시키는 공식 애드온. three.js
  예제(`examples/jsm/controls/OrbitControls.js`)에서 그대로 가져왔고, 손대지 않았습니다.
  터치 한 손가락 회전·두 손가락 확대/축소를 기본 지원합니다.
- `LICENSE` — three.js의 MIT 라이선스 원문.

## 왜 빌드 도구 없이 쓸 수 있나 — import map

`OrbitControls.js`는 내부에서 `import ... from 'three'`처럼 **맨 이름(bare specifier)** 을
쓰는데, 번들러 없이는 브라우저가 이 이름을 파일 경로로 바꿀 방법이 없습니다. 그래서 이
파일을 쓰는 각 시뮬레이터의 `index.html`에 아래처럼 **[import map](https://developer.mozilla.org/ko/docs/Web/HTML/Element/script/type/importmap)**
을 넣어 해결합니다(모던 브라우저 네이티브 기능 — Chrome/Edge는 오래전부터, Safari는
16.4부터 지원):

```html
<script type="importmap">
{ "imports": { "three": "../vendor/three/three.module.js" } }
</script>
```

이렇게 해두면 `main.js`에서 `import * as THREE from 'three'`, 그리고
`import { OrbitControls } from '../vendor/three/OrbitControls.js'`처럼 평범한 ES 모듈
문법으로 그대로 쓸 수 있습니다. 번들 단계 없이, 정적 파일만으로 동작합니다.

## 버전을 올리려면

1. 아무 빈 폴더에서 `npm install three@<새 버전>` 실행
2. `node_modules/three/build/three.module.min.js` → 이 폴더의 `three.module.js`로 교체
3. `node_modules/three/examples/jsm/controls/OrbitControls.js` → 이 폴더의 `OrbitControls.js`로 교체
   (OrbitControls는 API가 비교적 안정적이지만, three 메이저 버전을 크게 건너뛰면 시그니처가
   바뀔 수 있으니 교체 후 `magnetic-field/`·`motor/` 양쪽을 반드시 다시 확인할 것)
4. `LICENSE`도 새로 받아 갱신
5. 이 파일의 버전 번호(0.160.0)를 갱신
