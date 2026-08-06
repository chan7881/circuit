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
import { coilFieldAt, currentLevel } from './model.js'

/** 모델 좌표계 단위 → 3D 장면 단위(대략 미터 느낌) 환산 비율 */
export const MODEL_SCALE = 60

export function toScene(p) {
  return { x: p.x / MODEL_SCALE, z: p.y / MODEL_SCALE }
}

const CURRENT_COLOR = 0xf59e0b
const FIELD_LINE_COLOR = 0x2563eb

const COIL_HALF_LEN = 62 / MODEL_SCALE
const COIL_RADIUS = 26 / MODEL_SCALE
const COIL_LOOPS = 5
const COMPASS_RADIUS = 17 / MODEL_SCALE
const WIRE_HALF_LEN = 1.3

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#eef2f7')

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

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cf, 1.0))
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(4, 6, 3)
  scene.add(sun)

  // ── 실험대 ──
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9 }),
  )
  table.position.y = -0.06
  scene.add(table)
  const grid = new THREE.GridHelper(8.8, 22, '#cbd5e1', '#dbe3ec')
  grid.position.y = 0.001
  scene.add(grid)

  // ── 코일 ──
  const coilGroup = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, COIL_HALF_LEN * 2, 16),
    new THREE.MeshStandardMaterial({ color: '#cbd5e1' }),
  )
  core.rotation.z = Math.PI / 2
  coilGroup.add(core)

  const loopMat = new THREE.MeshStandardMaterial({ color: '#92400e' })
  const arrowMat = new THREE.MeshStandardMaterial({ color: CURRENT_COLOR })
  const coilArrows = []
  const loopGap = (COIL_HALF_LEN * 2) / (COIL_LOOPS - 1)
  for (let i = 0; i < COIL_LOOPS; i++) {
    const lx = -COIL_HALF_LEN + loopGap * i
    const torus = new THREE.Mesh(new THREE.TorusGeometry(COIL_RADIUS, 0.028, 10, 40), loopMat)
    torus.rotation.y = Math.PI / 2 // 토러스의 구멍 방향(기본 Z축)을 코일 축(X축)으로 돌린다
    torus.position.x = lx
    coilGroup.add(torus)

    // 전류 방향 화살표 — 학생이 정한 조건을 그대로 보여줄 뿐, 결과를 알려주는 게 아니다.
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), arrowMat)
    arrow.position.set(lx, COIL_RADIUS + 0.03, 0)
    coilArrows.push(arrow)
    coilGroup.add(arrow)
  }
  scene.add(coilGroup)

  // ── 직선 도선 ──
  const wireGroup = new THREE.Group()
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, WIRE_HALF_LEN * 2, 20),
    new THREE.MeshStandardMaterial({ color: '#e2e8f0' }),
  )
  wireGroup.add(wire)
  const wireArrowMat = new THREE.MeshStandardMaterial({ color: CURRENT_COLOR })
  const wireArrows = []
  for (const y of [-0.6, 0, 0.6]) {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 12), wireArrowMat)
    arrow.position.y = y
    wireArrows.push(arrow)
    wireGroup.add(arrow)
  }
  scene.add(wireGroup)

  // ── 나침반 8개 ──
  const housingMat = new THREE.MeshStandardMaterial({ color: '#ffffff' })
  const rimMat = new THREE.MeshStandardMaterial({ color: '#94a3b8' })
  const nMat = new THREE.MeshStandardMaterial({ color: '#dc2626' })
  const sMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8' })
  const compasses = []
  for (let i = 0; i < 8; i++) {
    const group = new THREE.Group()
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(COMPASS_RADIUS, COMPASS_RADIUS, 0.05, 28), housingMat)
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
    needle.add(north)
    const south = new THREE.Mesh(new THREE.ConeGeometry(0.045, COMPASS_RADIUS * 0.85, 8), sMat)
    south.rotation.z = Math.PI / 2
    south.position.x = -COMPASS_RADIUS * 0.42
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

  /** 코일(쌍극자) 자기력선 하나를 시작점에서 field 방향을 따라가며 추적한다(2D, 모델 좌표) */
  function traceCoilFieldLine(model, start, maxSteps = 240, stepSize = 4) {
    const pts = [start]
    let p = start
    for (let i = 0; i < maxSteps; i++) {
      const f = coilFieldAt(model, p)
      const mag = Math.hypot(f.x, f.y)
      if (mag < 1e-6) break
      p = { x: p.x + (f.x / mag) * stepSize, y: p.y + (f.y / mag) * stepSize }
      pts.push(p)
      if (Math.hypot(p.x, p.y) > 300) break
    }
    return pts
  }

  function rebuildFieldLines(model, showFieldLines) {
    while (fieldLineGroup.children.length) {
      fieldLineGroup.remove(fieldLineGroup.children[fieldLineGroup.children.length - 1]).geometry?.dispose()
    }
    if (!showFieldLines || currentLevel(model) <= 0) return

    if (model.mode === 'coil') {
      // 2D 단면 자기력선을 코일 축(X) 둘레 여러 방위각으로 복제해 3D 꽃잎 모양을 만든다 —
      // 쌍극자 자기장은 축 대칭이라 어느 방위각에서 봐도 같은 모양의 단면을 가진다.
      //
      // 시작점은 코일 축(원점)에서 본 각도(극각)가 어느 정도 커야(30°~85°) 자기력선이 화면
      // 안에서 둥글게 휘어 돌아오는 고리 모양을 보인다 — 극에 아주 가까운 각도로 시작하면
      // 고리 반지름이 너무 커져(r ∝ 1/sin²θ) 화면 밖으로 거의 직선처럼 빠져나가 버린다.
      const poleSign = model.direction > 0 ? 1 : -1
      const startR = 40
      const baseAngles = [30, 50, 70, 85]
      const azimuths = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3]
      for (const deg of baseAngles) {
        const rad = (deg * Math.PI) / 180
        const start = { x: poleSign * startR * Math.cos(rad), y: startR * Math.sin(rad) }
        const pts2d = traceCoilFieldLine(model, start)
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
      const heights = [-0.9, -0.45, 0, 0.45, 0.9]
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
   */
  function update(model, positions, needleAngles, state) {
    coilGroup.visible = model.mode === 'coil'
    wireGroup.visible = model.mode === 'wire'

    const on = currentLevel(model) > 0
    const coilArrowRotX = model.direction > 0 ? Math.PI / 2 : -Math.PI / 2
    for (const arrow of coilArrows) {
      arrow.visible = on
      arrow.rotation.x = coilArrowRotX
    }
    const wireArrowRotZ = model.direction > 0 ? 0 : Math.PI
    for (const arrow of wireArrows) {
      arrow.visible = on
      arrow.rotation.z = wireArrowRotZ
    }

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
