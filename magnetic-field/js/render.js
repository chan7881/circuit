// three.js 3D 장면 구성·갱신. 모델을 읽기만 하는 쪽에 최대한 가깝게 두지만, three.js는
// 캔버스 2D와 달리 "매 프레임 지우고 다시 그리는" 방식이 아니라 한 번 만든 장면 그래프를
// 계속 갱신하는 방식이라 완전한 순수 함수로는 둘 수 없다. main.js만 DOM(document)을 직접
// 건드린다는 원칙은 유지한다 — 이 파일은 main.js가 넘겨준 <canvas> 엘리먼트 하나만 받는다.
//
// ⚠️ 코일 양 끝에 N/S를 표시하지 않는다: 나침반으로 직접 알아내는 것이 이 시뮬레이터의 핵심.
//
// 「코일 주위의 자기장」기존 2D 모델(model.js)은 코일 축·직선 도선 모두 **축 대칭**이라서
// (자기 쌍극자 공식과 무한 직선 도선 공식 둘 다, 축을 포함하는 어떤 평면에서도 같은 모양의
// 장을 만든다) model.js의 물리 계산은 전혀 손대지 않고, 2D 모델 좌표 {x,y}를 실험대(테이블)
// 평면 위의 3D 좌표 {x, 0, y}로 그대로 옮겨 쓴다. 코일 자기력선은 그 2D 단면 곡선을 코일 축
// 둘레로 여러 방위각에서 복제해 "꽃잎처럼 감싸는" 3D 형태로, 직선 도선의 원형 자기력선은
// 도선을 따라 여러 높이에 쌓아 올린 원으로 그려 실제로 3차원임이 보이게 한다.

import * as THREE from 'three'
import { OrbitControls } from '../../vendor/three/OrbitControls.js'
import { currentLevel, coilFieldAt, COIL_RADIUS as COIL_A_MODEL } from './model.js'

/** 모델 좌표계 단위 → 3D 장면 단위(대략 미터 느낌) 환산 비율 */
export const MODEL_SCALE = 60

export function toScene(p) {
  return { x: p.x / MODEL_SCALE, z: p.y / MODEL_SCALE }
}

const CURRENT_COLOR = 0xf59e0b
const FIELD_LINE_COLOR = 0x2563eb

// ── 장식용 텍스처 ──
//
// render.js는 DOM을 직접 건드리지 않는다는 원칙(main.js만 document를 만짐)이 있어서,
// 배경 그러데이션·전류 흐름 무늬는 <canvas> 2D로 그리지 않고 **숫자 배열로 직접** 만든다
// (THREE.DataTexture — document.createElement 없이 픽셀 값을 바로 채운다).

/** 위(하늘색)→아래(기존 배경색과 자연스럽게 이어짐)로 이어지는 세로 그러데이션. 카메라가
 * 돌아가도 배경은 화면에 고정된 채라(큐브맵이 아닌 일반 텍스처), 항상 "위=하늘"로 읽힌다. */
function makeSkyGradientTexture() {
  const H = 64
  const stops = [
    [0, 219, 234, 254], // 위쪽 — 옅은 하늘색 #dbeafe
    [0.55, 238, 242, 247], // 지평선 근처 — 기존 배경색 #eef2f7
    [1, 248, 250, 252], // 아래쪽 — 살짝 더 밝게 #f8fafc
  ]
  const data = new Uint8Array(H * 4)
  for (let y = 0; y < H; y++) {
    const t = 1 - y / (H - 1) // 텍스처 y=0이 화면 아래쪽이 되므로 뒤집어 채운다
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

/** 실험대 가운데가 은은하게 밝고 가장자리로 갈수록 살짝 가라앉는 원형 그러데이션 —
 * 시선이 코일·도선 쪽으로 자연스럽게 모이게 한다. */
function makeTableVignetteTexture() {
  const N = 64
  const data = new Uint8Array(N * N * 4)
  const center = [246, 249, 252] // 가운데 — 밝게
  const edge = [199, 209, 222] // 가장자리 — 살짝 어둡게
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

/** 도선 위를 타고 흐르는 밝은 띠 — emissiveMap으로 써서 "전류가 흐른다"는 인상을 준다. */
function makeFlowStripeTexture() {
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

const COIL_HALF_LEN = 62 / MODEL_SCALE
const COIL_RADIUS = 26 / MODEL_SCALE
const COIL_LOOPS = 5
const COMPASS_RADIUS = 17 / MODEL_SCALE
const COIL_TUBE_R = 0.028
const WIRE_R = 0.045
// 이론에서 다루는 "직선 도선의 자기장"은 **무한히 긴** 도선을 상정한다. 실제로 무한을
// 그릴 수는 없지만, 도선이 화면 위아래를 뚫고 나가도록 충분히 길게 그리면 끝이 보이지
// 않아 무한히 이어지는 것처럼 읽힌다(2026-08-07 사용자 피드백).
const WIRE_HALF_LEN = 7

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3))
  // 부드러운 그림자 — 나침반·코일·도선이 실험대에 발을 딛고 있는 느낌을 준다(2026-09-03 개선).
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = makeSkyGradientTexture()

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(3.6, 3.0, 4.6)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 2.2
  controls.maxDistance = 11
  controls.maxPolarAngle = Math.PI / 2 - 0.03
  controls.target.set(0, 0.15, 0)
  controls.update()

  // ── 코일 자기력선용 카메라 자동 맞춤 ──
  //
  // 코일 자기력선은 축 가까이서 출발한 것일수록 크게 부풀어 오른다(안쪽 시드 기준 모델
  // 좌표로 최대 약 239, 장면 좌표로 약 4). 기본 시점(나침반을 크게 보여주려고 가깝게 잡은
  // 거리)에서는 그 부풀어 오른 윗부분이 화면 위로 잘려 나가, 자기력선을 켜도 학생이 전체
  // 모양을 보려면 손가락으로 시점을 직접 돌려야 했다. 코일 모드에서 자기력선을 켤 때만
  // 카메라를 뒤로 물려 전체 모양이 한눈에 들어오게 한다 — 사용자가 이미 돌려놓은 방향(시야각)은
  // 그대로 두고 거리·높이만 부드럽게 바꾼다(2026-09-03 개선).
  const CAMERA_DEFAULT_RADIUS = camera.position.distanceTo(controls.target)
  const CAMERA_DEFAULT_TARGET_Y = controls.target.y
  const CAMERA_COIL_FIELDLINES_RADIUS = CAMERA_DEFAULT_RADIUS * 1.45
  const CAMERA_COIL_FIELDLINES_TARGET_Y = 1.1
  const CAMERA_FIT_DURATION = 0.6 // 초 — 순간이동이 아니라 서서히 물러나는 것처럼 보이게
  /** wantWide가 바뀔 때마다 다시 채워지는 진행 중 애니메이션 상태 */
  let camFit = { active: false, t: 0, fromRadius: CAMERA_DEFAULT_RADIUS, toRadius: CAMERA_DEFAULT_RADIUS, fromTargetY: CAMERA_DEFAULT_TARGET_Y, toTargetY: CAMERA_DEFAULT_TARGET_Y }
  let wantWideView = false
  /** 화살표 맥동·도선 흐름 무늬에 쓰는 누적 시간(초) */
  let elapsedTime = 0
  /** 도선의 흐름 무늬가 1초에 몇 바퀴(텍스처 반복 단위) 도는지 */
  const WIRE_FLOW_SPEED = 0.5

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cf, 1.0))
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(4, 6, 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -6
  sun.shadow.camera.right = 6
  sun.shadow.camera.top = 6
  sun.shadow.camera.bottom = -6
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 16
  sun.shadow.bias = -0.0015
  scene.add(sun)

  // ── 실험대 ──
  // 가운데가 은은하게 밝은 원형 그러데이션(makeTableVignetteTexture)을 얹어 시선이
  // 코일·도선 쪽으로 모이게 한다. 격자는 그대로 두어 척도를 가늠하는 기준으로 쓴다.
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.12, 48),
    new THREE.MeshStandardMaterial({ map: makeTableVignetteTexture(), roughness: 0.9 }),
  )
  table.position.y = -0.06
  table.receiveShadow = true
  scene.add(table)
  const grid = new THREE.GridHelper(8.8, 22, '#cbd5e1', '#dbe3ec')
  grid.position.y = 0.001
  scene.add(grid)

  // ── 전류 방향 화살표 만들기 ──
  //
  // three.js 기본 ArrowHelper는 몸통을 **선(Line)** 으로 그려서 1픽셀 굵기라 잘 안 보인다.
  // 원기둥(몸통)+원뿔(머리)로 직접 만들어 굵기를 정한다. 도선과 **같은 축에** 놓이는
  // 화살표는 도선보다 굵어야 도선 속에 파묻히지 않는다(2026-08-07 사용자 피드백).
  // 화살표는 살짝 빛나는(emissive) 재질을 쓴다 — "지금 전류가 흐르고 있다"는 인상을
  // 더해 준다. update()에서 material.emissiveIntensity를 은은하게 맥동시키므로, 만든
  // 재질을 arrowMaterials에 모아 둔다(2026-09-03 개선).
  const arrowMaterials = []
  function makeArrowMesh(shaftR, length, color) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.15,
      emissive: color,
      emissiveIntensity: 0.35,
    })
    arrowMaterials.push(mat)
    const headLen = Math.min(shaftR * 4.5, length * 0.45)
    const shaftLen = length - headLen
    const g = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR, shaftR, shaftLen, 14), mat)
    shaft.position.y = shaftLen / 2
    shaft.castShadow = true
    const head = new THREE.Mesh(new THREE.ConeGeometry(shaftR * 2.1, headLen, 16), mat)
    head.position.y = shaftLen + headLen / 2
    head.castShadow = true
    g.add(shaft, head)
    // 화살표 한가운데가 원점에 오도록 내려 둔다 — 놓을 자리를 잡기 쉬워진다.
    const inner = new THREE.Group()
    inner.add(g)
    g.position.y = -length / 2
    return inner
  }

  // ── 코일 ──
  //
  // 고리 안에 심지(막대)를 두지 않는다. 이 모델의 코일은 **속이 빈 공기 코일**이고, 쇠막대를
  // 그려 두면 "철심이 있어야 자기장이 생긴다"는 엉뚱한 인상을 줄 수 있다. 고리만으로도
  // 코일이라는 게 충분히 읽힌다(2026-08-07 사용자 피드백).
  const coilGroup = new THREE.Group()

  const loopMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.4, metalness: 0.25 })
  const coilArrows = []
  const loopGap = (COIL_HALF_LEN * 2) / (COIL_LOOPS - 1)
  for (let i = 0; i < COIL_LOOPS; i++) {
    const lx = -COIL_HALF_LEN + loopGap * i
    const torus = new THREE.Mesh(new THREE.TorusGeometry(COIL_RADIUS, COIL_TUBE_R, 10, 40), loopMat)
    torus.rotation.y = Math.PI / 2 // 토러스의 구멍 방향(기본 Z축)을 코일 축(X축)으로 돌린다
    torus.position.x = lx
    torus.castShadow = true
    torus.receiveShadow = true
    coilGroup.add(torus)

    // 전류 방향 화살표 — 학생이 정한 조건을 그대로 보여줄 뿐, 결과를 알려주는 게 아니다.
    //
    // 고리의 **앞쪽 위(45°)** 에 놓는다. 이 자리를 고른 이유가 둘 있다:
    //  · 꼭대기는 전류가 앞뒤(±z) 방향이라 정면에서 보면 점처럼 찌그러진다.
    //  · 정면 한가운데(y=0)는 코일이 실험대 높이에 걸쳐 있어 화살표 절반이 상판에 묻힌다.
    // 45° 자리는 상판 위로 완전히 올라와 있고, 전류 방향도 비스듬해서 어느 시점에서도
    // 눌리지 않는다(2026-08-07 사용자 피드백). 고리 도선보다 굵어야 파묻히지 않는다.
    const arrow = makeArrowMesh(COIL_TUBE_R * 1.5, 0.34, CURRENT_COLOR)
    arrow.position.set(lx, COIL_RADIUS * Math.SQRT1_2, COIL_RADIUS * Math.SQRT1_2)
    coilArrows.push(arrow)
    coilGroup.add(arrow)
  }
  scene.add(coilGroup)

  // ── 직선 도선 ──
  //
  // 도선 표면에 은은하게 빛나는 띠 무늬(makeFlowStripeTexture)를 얹고, 매 프레임 그 무늬를
  // 이동시켜 "전류가 흐르고 있다"는 인상을 더한다. 흐르는 방향은 **전류 방향 화살표와 똑같이
  // model.direction의 부호를 그대로 가져다 쓴다** — 화살표 방향은 이미 오른손 법칙에 맞게
  // 검증되어 있으므로(2026-08-07), 무늬만 그 화살표가 가리키는 쪽으로 흘러가게 하면 새로
  // 방향을 유도할 필요가 없다. 렌더링으로 실제 이동 방향까지 확인했다(2026-09-03).
  const wireGroup = new THREE.Group()
  const wireFlowTex = makeFlowStripeTexture()
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(WIRE_R, WIRE_R, WIRE_HALF_LEN * 2, 20),
    new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.4,
      metalness: 0.35,
      emissive: CURRENT_COLOR,
      emissiveMap: wireFlowTex,
      emissiveIntensity: 0.9,
    }),
  )
  wire.castShadow = true
  wireGroup.add(wire)
  const wireArrows = []
  // 전류 방향 화살표는 **하나만** 크게 둔다 — 여러 개를 늘어놓으면 도선을 가리기만 하고
  // 읽히는 정보는 같다(2026-08-07 사용자 피드백). 도선과 같은 축이라 도선보다 굵게 만들고,
  // 실험대 아래는 상판에 가려 보이지 않으므로 상판 위쪽에 둔다.
  {
    const arrow = makeArrowMesh(WIRE_R * 1.5, 1.0, CURRENT_COLOR)
    arrow.position.y = 0.85
    wireArrows.push(arrow)
    wireGroup.add(arrow)
  }
  scene.add(wireGroup)

  // ── 나침반 8개 ──
  // 살짝 광택 있는 재질(금속성 낮게, 매끈하게)로 바꿔 플라스틱 CAD 모형보다 실제 계기처럼
  // 보이게 한다 — 색 자체(흰 몸통·빨강 N·파랑 S)는 그대로라 판독성은 그대로다(2026-09-03 개선).
  const housingMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.05 })
  const rimMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, metalness: 0.6 })
  const nMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3, metalness: 0.1 })
  const sMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.3, metalness: 0.1 })
  const compasses = []
  for (let i = 0; i < 8; i++) {
    const group = new THREE.Group()
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(COMPASS_RADIUS, COMPASS_RADIUS, 0.05, 28), housingMat)
    housing.castShadow = true
    housing.receiveShadow = true
    group.add(housing)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(COMPASS_RADIUS, 0.014, 8, 28), rimMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.026
    group.add(rim)

    // 바늘 — N을 찾는 쪽(빨강)과 반대쪽(파랑). needle 그룹 전체를 회전시켜 방향을 정한다.
    const needle = new THREE.Group()
    const north = new THREE.Mesh(new THREE.ConeGeometry(0.045, COMPASS_RADIUS * 0.85, 8), nMat)
    north.rotation.z = -Math.PI / 2
    north.position.x = COMPASS_RADIUS * 0.42
    north.castShadow = true
    needle.add(north)
    const south = new THREE.Mesh(new THREE.ConeGeometry(0.045, COMPASS_RADIUS * 0.85, 8), sMat)
    south.rotation.z = Math.PI / 2
    south.position.x = -COMPASS_RADIUS * 0.42
    south.castShadow = true
    needle.add(south)
    needle.position.y = 0.05
    group.add(needle)

    scene.add(group)
    compasses.push({ group, needle })
  }

  // ── 자기력선 ──
  const fieldLineGroup = new THREE.Group()
  scene.add(fieldLineGroup)
  const fieldLineMat = new THREE.LineBasicMaterial({ color: FIELD_LINE_COLOR, transparent: true, opacity: 0.45 })
  let lastFieldKey = ''

  /**
   * 코일 속 반지름 seedR에서 출발해, 가운데 평면(x=0)으로 되돌아올 때까지 자기장을 따라간다.
   * 돌아온 시점이 자기력선의 '반쪽'이다 — 나머지 반쪽은 거울로 만든다.
   *
   * 자기장은 **model.js의 coilFieldAt()을 그대로** 쓴다. 나침반이 보는 장과 자기력선이
   * 같은 계산에서 나와야 둘이 어긋나지 않는다.
   */
  function traceCoilFieldLineHalf(model, seedR) {
    const STEP = 2.5
    const MAX_STEPS = 1200
    const MAX_R = 320
    const pts = []
    let x = 0
    let r = seedR
    // 코일 속에서는 자기장이 축과 나란하다. 항상 +x 쪽으로 먼저 가도록 부호를 맞춘다.
    const seed = coilFieldAt(model, { x: 0, y: seedR })
    const flip = seed.x < 0 ? -1 : 1
    for (let i = 0; i < MAX_STEPS; i++) {
      pts.push({ x, y: r })
      // 중점법(RK2) — 오일러법보다 곡선을 훨씬 덜 벗어난다
      const f1 = coilFieldAt(model, { x, y: r })
      const m1 = Math.hypot(f1.x, f1.y)
      if (m1 < 1e-12) break
      const xh = x + ((flip * f1.x) / m1) * (STEP / 2)
      const rh = r + ((flip * f1.y) / m1) * (STEP / 2)
      const f2 = coilFieldAt(model, { x: xh, y: Math.abs(rh) })
      const m2 = Math.hypot(f2.x, f2.y)
      if (m2 < 1e-12) break
      x += ((flip * f2.x) / m2) * STEP
      r += ((flip * f2.y) / m2) * STEP
      if (r < 0 || Math.hypot(x, r) > MAX_R) break
      if (i > 4 && x <= 0) {
        pts.push({ x: 0, y: r }) // 가운데 평면에 정확히 맞춰 닫아 준다
        break
      }
    }
    return pts
  }

  function rebuildFieldLines(model, showFieldLines) {
    while (fieldLineGroup.children.length) {
      fieldLineGroup.remove(fieldLineGroup.children[fieldLineGroup.children.length - 1]).geometry?.dispose()
    }
    if (!showFieldLines || currentLevel(model) <= 0) return

    if (model.mode === 'coil') {
      // 실제 코일(고리 5개)이 만드는 자기장을 **비오-사바르 법칙으로 직접 적분해서** 그 장을
      // 따라가며 자기력선을 그린다. 그래야 코일 속을 축과 나란히 지나가다가 끝에서 빠져나와
      // 바깥으로 크게 돌아 반대쪽 끝으로 들어가는, **실제 코일의 자기력선 모양**이 나온다.
      //
      // (점 쌍극자 공식 r = L·sin²θ 도 써 봤지만, 그건 코일을 한 점으로 본 것이라 모든 선이
      //  코일 한가운데 한 점으로 모여 버려서 실제 코일 모습과 달랐다 — 2026-08-07 피드백.)
      //
      // 좌우 대칭은 **가운데 평면에서 한쪽만 따라간 뒤 거울로 뒤집어** 보장한다. 코일이 x=0에
      // 대해 대칭이니 자기력선도 대칭이어야 하는데, 양쪽을 따로 적분하면 반올림 오차가 쌓여
      // 미세하게 어긋난다.
      const azimuths = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3]
      // 코일 속(구멍) 여러 반지름에서 출발시킨다 — 코일을 관통하는 선들이 실제 모습의 핵심이다.
      // 출발 반지름이 축에 가까울수록 자기력선이 훨씬 크게 돈다. 네 개가 고르게 겹쳐 보이면서
      // 가장 바깥 것도 실험대를 크게 벗어나지 않는 값으로 골랐다(추적해 확인: 최대 반지름이
      // 각각 약 239·158·103·47 — 모델 좌표).
      const seeds = [0.55, 0.65, 0.75, 0.85].map((f) => f * COIL_A_MODEL)
      for (const seedR of seeds) {
        const half = traceCoilFieldLineHalf(model, seedR)
        if (half.length < 2) continue
        // 따라간 반쪽 + 거울로 뒤집은 반쪽 = 좌우 대칭인 닫힌 고리
        const pts2d = half.concat(
          half
            .slice(0, -1)
            .reverse()
            .map((p) => ({ x: -p.x, y: p.y })),
        )
        for (const az of azimuths) {
          const points = pts2d.map(
            (pt) =>
              new THREE.Vector3(
                pt.x / MODEL_SCALE,
                (pt.y / MODEL_SCALE) * Math.cos(az),
                (pt.y / MODEL_SCALE) * Math.sin(az),
              ),
          )
          fieldLineGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), fieldLineMat))
        }
      }
    } else {
      // 도선을 감싸는 동심원을 도선을 따라 여러 높이에 쌓아, 진짜 3D 구조임을 보여준다.
      const radii = [40, 70, 100, 130, 160].map((r) => r / MODEL_SCALE)
      // 도선이 길어진 만큼 원도 위아래로 더 넓게 쌓아, 도선을 따라 어디서나 같은 모양의
      // 자기장이 이어진다는 것(무한히 긴 도선의 성질)이 보이게 한다.
      const heights = [-1.8, -0.9, 0, 0.9, 1.8]
      for (const y of heights) {
        for (const r of radii) {
          const points = []
          for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2
            points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
          }
          fieldLineGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), fieldLineMat))
        }
      }
    }
  }

  /**
   * @param needleAngles - 위치마다 실제로 그릴 각도(라디안) 배열(2D atan2 규약, model.js와 동일).
   *   main.js가 이전 각도에서 서서히 회전시켜(보간) 만든 값을 그대로 받아 쓴다.
   * @param dt - 지난 프레임과의 시간차(초). 카메라 자동 맞춤 애니메이션에만 쓴다. 생략하면 0.
   */
  function update(model, positions, needleAngles, state, dt = 0) {
    elapsedTime += dt
    coilGroup.visible = model.mode === 'coil'
    wireGroup.visible = model.mode === 'wire'

    const on = currentLevel(model) > 0
    // 고리 앞쪽 위(45°)에서 전류가 흐르는 방향. direction이 +1일 때 자기 모멘트가 +x를
    // 향하도록(오른손 법칙) 맞추면, 이 자리에서 전류는 **비스듬히 아래·앞쪽**으로 흐른다.
    // (확인: 꼭대기(+y)에서 전류가 +z이면 r×v ∝ (0,R,0)×(0,0,1) = +x — 모델의 모멘트와 같다.)
    const coilCurrentDir = new THREE.Vector3(0, -1, 1).normalize().multiplyScalar(model.direction)
    for (const arrow of coilArrows) {
      arrow.visible = on
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), coilCurrentDir)
    }
    const wireArrowRotZ = model.direction > 0 ? 0 : Math.PI
    for (const arrow of wireArrows) {
      arrow.visible = on
      arrow.rotation.z = wireArrowRotZ
    }

    // 전류가 흐르는 동안 화살표를 은은하게 맥동시킨다 — "지금 흐르고 있다"는 살아있는 느낌.
    // 방향 정보는 전혀 담지 않는 단순한 밝기 변화라 방향 검증이 필요 없다.
    const pulse = on ? 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(elapsedTime * 4)) : 0.15
    for (const mat of arrowMaterials) mat.emissiveIntensity = pulse

    // 도선 위 흐름 무늬 — 텍스처는 offset을 늘릴수록 무늬가 반대 방향으로 흘러 보이므로
    // (실제로 렌더링해 확인: +offset일 때 무늬가 -y로 흘렀다), model.direction에 마이너스를
    // 붙여야 화살표가 가리키는 방향(+1이면 +y)과 같은 쪽으로 흐른다.
    if (on) {
      wireFlowTex.offset.y = (wireFlowTex.offset.y - model.direction * WIRE_FLOW_SPEED * dt) % 1
    }
    wire.material.emissiveIntensity = on ? 0.9 : 0

    positions.forEach((p, i) => {
      const sp = toScene(p)
      const c = compasses[i]
      if (!c) return
      c.group.position.set(sp.x, 0.03, sp.z)
      // model.js의 needleAngle은 atan2(y,x) 2D 규약 그대로다. scene에서는 x→x, y→z로 옮겼으니
      // 바늘의 로컬 +X(빨강 쪽)가 (cos angle, 0, sin angle) 방향을 보게 하려면 -angle만큼 돌린다.
      c.needle.rotation.y = -needleAngles[i]
    })

    const key = `${model.mode}|${on}|${model.direction}|${state.showFieldLines}`
    if (key !== lastFieldKey) {
      lastFieldKey = key
      rebuildFieldLines(model, state.showFieldLines)
    }

    // ── 카메라 자동 맞춤 ──
    // 코일 자기력선을 막 켰거나 껐을 때만 새 애니메이션을 시작한다(매 프레임 다시 시작하지 않음).
    const wantWide = model.mode === 'coil' && state.showFieldLines
    if (wantWide !== wantWideView) {
      wantWideView = wantWide
      const currentRadius = camera.position.distanceTo(controls.target)
      camFit = {
        active: true,
        t: 0,
        fromRadius: currentRadius,
        toRadius: wantWide ? CAMERA_COIL_FIELDLINES_RADIUS : CAMERA_DEFAULT_RADIUS,
        fromTargetY: controls.target.y,
        toTargetY: wantWide ? CAMERA_COIL_FIELDLINES_TARGET_Y : CAMERA_DEFAULT_TARGET_Y,
      }
    }
    if (camFit.active) {
      camFit.t = Math.min(camFit.t + dt / CAMERA_FIT_DURATION, 1)
      const eased = 1 - Math.pow(1 - camFit.t, 3) // ease-out — 처음엔 빠르게, 끝엔 서서히
      const radius = camFit.fromRadius + (camFit.toRadius - camFit.fromRadius) * eased
      const targetY = camFit.fromTargetY + (camFit.toTargetY - camFit.fromTargetY) * eased
      // 사용자가 손가락으로 돌려놓은 현재 방향(구면좌표의 theta·phi)은 그대로 두고
      // 거리(radius)만 바꾼다 — 그래야 자동 맞춤이 사용자의 시점 조작과 다투지 않는다.
      const offset = camera.position.clone().sub(controls.target)
      const spherical = new THREE.Spherical().setFromVector3(offset)
      spherical.radius = radius
      controls.target.y = targetY
      camera.position.setFromSpherical(spherical).add(controls.target)
      if (camFit.t >= 1) camFit.active = false
    }
  }

  function resize(width, height) {
    camera.aspect = width / Math.max(height, 1)
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3))
    renderer.setSize(width, height, false)
  }

  function renderFrame() {
    controls.update()
    renderer.render(scene, camera)
  }

  return { update, resize, renderFrame, camera, controls }
}
