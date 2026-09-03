// 3D 시뮬레이터가 함께 쓰는 **화면 연출용 재료**(배경·실험대 무늬 등). 물리와는 무관하다 —
// 방향·부호·크기를 정하는 것이 하나도 없으므로 물리 검증 절차의 대상이 아니다.
//
// 여기 있는 것은 전부 **숫자 배열로 직접 만든 텍스처**(THREE.DataTexture)다. render.js는
// DOM을 직접 건드리지 않는다는 원칙이 있어서 <canvas>에 그려 만들지 않는다.
//
// 쓰는 곳: magnetic-field · motor. 새 시뮬레이터도 같은 연출을 쓰려면 여기서 가져다 쓴다 —
// 같은 코드를 각 render.js에 복사해 두면 반드시 어긋난다.

import * as THREE from 'three'

/**
 * 위(옅은 하늘색)에서 아래(밝은 회백색)로 이어지는 세로 그러데이션 배경.
 * 큐브맵이 아닌 일반 텍스처라 카메라를 돌려도 화면에 고정된 채 남는다 — 늘 "위가 하늘"로 읽힌다.
 */
export function makeSkyGradientTexture() {
  const H = 64
  const stops = [
    [0, 219, 234, 254], // 위쪽 #dbeafe
    [0.55, 238, 242, 247], // 지평선 근처 #eef2f7 (예전 단색 배경과 같은 값)
    [1, 248, 250, 252], // 아래쪽 #f8fafc
  ]
  const data = new Uint8Array(H * 4)
  for (let y = 0; y < H; y++) {
    const t = 1 - y / (H - 1) // 텍스처 y=0이 화면 아래쪽이라 뒤집어 채운다
    let a = stops[0]
    let b = stops[stops.length - 1]
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        a = stops[i]
        b = stops[i + 1]
        break
      }
    }
    const span = b[0] - a[0] || 1
    const k = (t - a[0]) / span
    const idx = y * 4
    data[idx + 0] = Math.round(a[1] + (b[1] - a[1]) * k)
    data[idx + 1] = Math.round(a[2] + (b[2] - a[2]) * k)
    data[idx + 2] = Math.round(a[3] + (b[3] - a[3]) * k)
    data[idx + 3] = 255
  }
  const tex = new THREE.DataTexture(data, 1, H, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * 실험대 상판에 얹는 원형 그러데이션 — 가운데가 밝고 가장자리로 갈수록 살짝 가라앉아
 * 시선이 장치 쪽으로 모인다. 격자(GridHelper)는 그대로 두어 척도 기준으로 쓴다.
 */
export function makeTableVignetteTexture() {
  const N = 64
  const data = new Uint8Array(N * N * 4)
  const center = [246, 249, 252]
  const edge = [199, 209, 222]
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N - 0.5
      const v = (y + 0.5) / N - 0.5
      const d = Math.min(Math.hypot(u, v) / 0.5, 1)
      const idx = (y * N + x) * 4
      data[idx + 0] = Math.round(center[0] + (edge[0] - center[0]) * d)
      data[idx + 1] = Math.round(center[1] + (edge[1] - center[1]) * d)
      data[idx + 2] = Math.round(center[2] + (edge[2] - center[2]) * d)
      data[idx + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * 도선 표면을 타고 흐르는 밝은 띠 — emissiveMap으로 써서 "전류가 흐른다"는 인상을 준다.
 *
 * ⚠️ **흐르는 방향은 물리적 의미를 가진다.** offset.y를 늘리면 무늬는 **−y 쪽으로** 흘러
 * 보인다(렌더링해 픽셀로 확인). 쓰는 쪽에서 전류 방향과 맞는지 반드시 화면으로 검증할 것.
 */
export function makeFlowStripeTexture() {
  const H = 16
  const data = new Uint8Array(H * 4)
  for (let i = 0; i < H; i++) {
    const v = i < H * 0.4 ? 255 : 60
    data[i * 4 + 0] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, 1, H, THREE.RGBAFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 24)
  tex.needsUpdate = true
  return tex
}

/**
 * 금속·구리가 **비출 것**을 만들어 준다(scene.environment).
 *
 * ⚠️ 이게 없으면 metalness를 올릴수록 물체가 **검게 죽는다.** 금속은 스스로 색을 내는 게
 * 아니라 주변을 비추는 것이라, 비출 환경이 없으면 반사할 것이 없어 어두워지기 때문이다.
 * 2026-09-03에 이것 없이 metalness만 0.7로 올렸다가 지지대가 숯덩이처럼 나왔다.
 *
 * 위(밝은 하늘)–아래(어두운 바닥)로만 변하는 아주 단순한 환경이라, 금속에 **위가 밝고
 * 아래가 어두운 자연스러운 그러데이션**이 생긴다. 색을 입히지 않으므로 N/S 빨강·파랑 같은
 * 색 규약은 그대로다.
 */
export function applyStudioEnvironment(renderer, scene) {
  const W = 16
  const H = 64
  const data = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    // 텍스처 y=0이 아래쪽 — 아래는 어둡게, 위로 갈수록 밝게
    const t = y / (H - 1)
    const v = Math.round(150 + 105 * t)
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      data[idx + 0] = v
      data[idx + 1] = Math.round(v * 0.99)
      data[idx + 2] = Math.round(Math.min(255, v * 1.04)) // 아주 살짝 푸르게
      data[idx + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromEquirectangular(tex).texture
  pmrem.dispose()
  tex.dispose()
}

/**
 * 그림자를 쓰도록 렌더러와 태양광을 맞춰 준다. 장치가 실험대에 발을 딛고 있는 느낌을 준다.
 * @param extent 그림자를 드리울 범위(장면 단위) — 실험대 반지름 정도면 넉넉하다.
 */
export function enableSoftShadows(renderer, sun, extent = 6) {
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -extent
  sun.shadow.camera.right = extent
  sun.shadow.camera.top = extent
  sun.shadow.camera.bottom = -extent
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = extent * 2.8
  sun.shadow.bias = -0.0015
}
