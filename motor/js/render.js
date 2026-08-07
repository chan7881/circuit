// three.js 3D 장면 구성·갱신. main.js가 넘겨준 <canvas> 하나만 받는다 — DOM은 main.js만
// 직접 건드린다는 원칙을 유지한다. magnetic-field/js/render.js와 같은 구조.
//
// ⚠️ 결과를 말로 풀어주지 않는다 — 그네가 어느 쪽으로 흔들리는지, 전동기가 어느 방향으로
//    도는지는 학생이 화면을 보고 스스로 확인해야 한다.
//
// 장치 모양은 자바실험실의 「전자기력(전기 그네)」·「직류 전동기」 시뮬레이션을 참고해
// 실제 실험 기구 배치를 따랐다(2026-08-07 사용자 피드백). 화살표 색도 같은 규약을 쓴다:
//   전류 I = 검정 · 자기장 B = 초록 · 힘 F = 빨강
//
// 돌림힘(τ) 화살표는 두지 않는다 — 코일이 받는 힘 F를 이미 양쪽에 그리고 있어서, 그 두 힘이
// 회전을 만든다는 것은 F만 봐도 읽힌다. τ까지 겹쳐 그리면 오히려 화면만 복잡해진다
// (2026-08-07 사용자 피드백). 물리 계산에는 model.js의 motorTorque()가 그대로 쓰인다.
//
// 모드 A(전기 그네): 위 두 단자에 매단 **네모난 코일**의 아래쪽 가로 도선이 **말굽자석의
//   위아래 극 사이 틈**을 지난다. 자기장은 위아래 극 사이라 **연직 방향**, 전류는 아래
//   가로 도선을 따라 **가로 방향**, 그래서 힘은 둘 다에 수직인 **앞뒤 방향** — 코일이
//   그네처럼 앞뒤로 흔들린다.
// 모드 B(전동기): 마주 보는 두 자석(N 빨강·S 파랑) 사이에서 같은 네모 코일이 회전축에
//   실려 돈다. 자기장은 두 자석 사이라 **가로 방향**, 회전축은 보는 사람 쪽을 향한다.
//   코일 양쪽 변에 흐르는 전류가 서로 반대라 힘도 서로 반대 → 돌림힘이 생겨 회전한다.
//   정류자가 반 바퀴마다 결선을 뒤집어 회전 방향을 한쪽으로 유지한다.

import * as THREE from 'three'
import { OrbitControls } from '../../vendor/three/OrbitControls.js'
import {
  currentLevel,
  commutatorPhase,
  reducedMotorAngle,
  isCommutatorBreak,
  COMMUTATOR_BREAK_HALF_ANGLE,
} from './model.js'

const N_COLOR = '#e11d48'
const S_COLOR = '#2563eb'
const COPPER = '#c2803a'
const CURRENT_COLOR = 0x111827 // 전류 I — 검정
const FIELD_COLOR = 0x00b050 // 자기장 B — 초록
const FORCE_COLOR = 0xef4444 // 힘 F — 빨강

// ── 공통 코일 치수 ──
const COIL_HALF_W = 0.42 // 가로 반너비(두 세로변 사이 거리의 절반)
const COIL_LEN = 0.92 // 세로변 길이(그네에서는 매단 길이, 전동기에서는 축 방향 길이)
const WIRE_R = 0.028

// ── 모드 A(그네) 배치 ──
const PIVOT_Y = 1.5
const SWING_GAP_Y = PIVOT_Y - COIL_LEN // 아래 가로 도선의 높이(= 말굽자석 틈 한가운데)
/** 자기장 화살표를 놓는 깊이 — 말굽이 트인 앞쪽이라 코일에 가리지 않는다. */
const SWING_B_Z = 0.24

// ── 모드 B(전동기) 배치 ──
const MOTOR_CENTER_Y = 0.95
const MOTOR_MAGNET_X = 0.66

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#eef2f7')

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(2.4, 1.9, 3.4)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 1.5
  controls.maxDistance = 9
  controls.maxPolarAngle = Math.PI / 2 - 0.03
  controls.target.set(0, 0.9, 0)
  controls.update()

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cf, 1.0))
  const sun = new THREE.DirectionalLight(0xffffff, 0.85)
  sun.position.set(4, 6, 3)
  scene.add(sun)

  // ── 실험대 ──
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(3.0, 3.0, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9 }),
  )
  table.position.y = -0.06
  scene.add(table)
  const grid = new THREE.GridHelper(6.0, 15, '#cbd5e1', '#dbe3ec')
  grid.position.y = 0.001
  scene.add(grid)

  const metalMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.6 })
  const copperMat = new THREE.MeshStandardMaterial({ color: COPPER, roughness: 0.45, metalness: 0.3 })

  // ── N·S 글자 표시 ────────────────────────────────────────────────
  //
  // three.js에는 글자를 그리는 기능이 없어서, 화면 밖 캔버스에 글자를 그려 텍스처로 쓴다.
  // (페이지의 DOM을 건드리는 게 아니라 그림을 그릴 종이를 하나 만드는 것뿐이다.)
  // 스프라이트는 항상 카메라를 향하므로 시점을 어떻게 돌려도 글자가 바로 읽힌다.
  function makeLetterTexture(letter, color) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = 'rgba(255,255,255,0.92)'
    g.beginPath()
    g.arc(64, 64, 60, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = color
    g.lineWidth = 7
    g.stroke()
    g.fillStyle = color
    g.font = 'bold 88px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(letter, 64, 70)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }
  const TEX_N = makeLetterTexture('N', '#b91c1c')
  const TEX_S = makeLetterTexture('S', '#1d4ed8')
  const TEX_PLUS = makeLetterTexture('+', '#b91c1c')
  const TEX_MINUS = makeLetterTexture('−', '#1d4ed8')

  /** 글자 딱지 하나. setTexture()로 나중에 다른 글자로 바꿀 수 있다. */
  function makeLabel(parent, x, y, z, size, initialTex) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: initialTex, depthTest: false }))
    sprite.position.set(x, y, z)
    sprite.scale.set(size, size, size)
    sprite.renderOrder = 10 // 물체 뒤에 숨지 않도록 항상 위에 그린다
    parent.add(sprite)
    return {
      setTexture(tex) {
        if (sprite.material.map === tex) return
        sprite.material.map = tex
        sprite.material.needsUpdate = true
      },
    }
  }

  /** 자석 극에 붙이는 N/S 딱지. setPole('N'|'S')로 바꾼다. */
  function makePoleLabel(parent, x, y, z, size = 0.17) {
    const label = makeLabel(parent, x, y, z, size, TEX_N)
    return {
      setPole(p) {
        label.setTexture(p === 'N' ? TEX_N : TEX_S)
      },
    }
  }

  /** 전지 단자에 붙이는 +/− 딱지. setPlus(true|false)로 바꾼다. */
  function makeTerminalLabel(parent, x, y, z, size = 0.15) {
    const label = makeLabel(parent, x, y, z, size, TEX_PLUS)
    return {
      setPlus(isPlus) {
        label.setTexture(isPlus ? TEX_PLUS : TEX_MINUS)
      },
    }
  }

  /**
   * 네모난 코일 한 개(두 세로변 + 아래 가로변)를 만들어 그룹으로 돌려준다. 두 모드가 같은
   * 코일을 쓰되 매다는 방식만 달라진다는 것을 그대로 드러내려고 같은 함수를 쓴다.
   */
  function makeCoil(closedTop) {
    const g = new THREE.Group()
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.CylinderGeometry(WIRE_R, WIRE_R, COIL_LEN, 12), copperMat)
      side.position.set(sx * COIL_HALF_W, -COIL_LEN / 2, 0)
      g.add(side)
    }
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(WIRE_R, WIRE_R, COIL_HALF_W * 2, 12), copperMat)
    bottom.rotation.z = Math.PI / 2
    bottom.position.set(0, -COIL_LEN, 0)
    g.add(bottom)
    if (closedTop) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(WIRE_R, WIRE_R, COIL_HALF_W * 2, 12), copperMat)
      top.rotation.z = Math.PI / 2
      g.add(top)
    }
    return g
  }

  // ══ 모드 A: 전기 그네 ══════════════════════════════════════════════
  const swingScene = new THREE.Group()
  scene.add(swingScene)

  // 지지대(코일을 매다는 가로대 + 두 기둥)
  const standBar = new THREE.Mesh(new THREE.BoxGeometry(COIL_HALF_W * 2 + 0.5, 0.06, 0.06), metalMat)
  standBar.position.set(0, PIVOT_Y, 0)
  swingScene.add(standBar)
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, PIVOT_Y, 12), metalMat)
    post.position.set(sx * (COIL_HALF_W + 0.25), PIVOT_Y / 2, 0)
    swingScene.add(post)
  }
  // 단자 두 개 — 빨강(+)·검정(−). 자바실험실과 같은 색 규약.
  for (const [sx, color] of [[-1, '#dc2626'], [1, '#111827']]) {
    const term = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12),
      new THREE.MeshStandardMaterial({ color }),
    )
    term.position.set(sx * (COIL_HALF_W + 0.25), PIVOT_Y + 0.065, 0)
    swingScene.add(term)
  }

  // 매달린 코일 — 피벗(가로대)을 중심으로 x축 둘레로 흔들린다
  const swingPivot = new THREE.Group()
  swingPivot.position.set(0, PIVOT_Y, 0)
  swingScene.add(swingPivot)
  swingPivot.add(makeCoil(true))

  // 말굽자석 — 위아래 극이 마주 보고, 그 틈으로 코일의 아래 가로 도선이 지나간다.
  // 반원 띠(C자)를 이어붙여 만들고, 열린 쪽이 앞(+z)을 보게 해 코일이 앞뒤로 지나갈 수 있게 한다.
  const horseshoe = new THREE.Group()
  horseshoe.position.set(0, SWING_GAP_Y, 0)
  swingScene.add(horseshoe)
  {
    const GAP_HALF = 0.19 // 위아래 극 사이 틈의 절반
    const YOKE_T = 0.13 // 자석 몸통 두께
    const MAG_HALF_W = 0.17 // x방향 폭의 절반(코일 세로변보다 좁아야 코일이 그 사이를 지난다)
    const BACK_Z = -0.34 // 뒤를 잇는 판의 위치
    const ARM_FRONT_Z = 0.5 // 극 팔이 앞으로 뻗은 끝 — 그네가 흔들려도 도선이 극 사이에 남도록 넉넉히

    // 뒤를 잇는 판(요크) — 여기서 자기 회로가 이어진다
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(MAG_HALF_W * 2, (GAP_HALF + YOKE_T) * 2, YOKE_T),
      metalMat,
    )
    back.position.set(0, 0, BACK_Z)
    horseshoe.add(back)

    // 위·아래 극 팔 — 앞쪽(+z)이 트여 있어 U자(말굽) 모양이 되고, 그 틈으로 코일이 드나든다.
    // 색이 N/S를 나타낸다.
    const armLen = ARM_FRONT_Z - BACK_Z
    const poles = []
    for (const sy of [1, -1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(MAG_HALF_W * 2, YOKE_T, armLen),
        new THREE.MeshStandardMaterial({ color: N_COLOR }),
      )
      arm.position.set(0, sy * (GAP_HALF + YOKE_T / 2), BACK_Z + armLen / 2)
      horseshoe.add(arm)
      poles.push(arm) // [0]=위, [1]=아래
    }
    horseshoe.userData.poles = poles
    horseshoe.userData.gapHalf = GAP_HALF
    // 말굽자석은 자석 하나를 U자로 구부린 것이라 두 극이 이미 함께 보인다 — 글자만 붙여
    // 어느 쪽이 N인지 분명히 한다.
    horseshoe.userData.labels = [
      makePoleLabel(horseshoe, 0, GAP_HALF + YOKE_T + 0.13, 0.42, 0.16), // 위
      makePoleLabel(horseshoe, 0, -(GAP_HALF + YOKE_T) - 0.13, 0.42, 0.16), // 아래
    ]

    // 자석 받침 — 자석이 공중에 떠 있어 보이지 않게 실험대까지 기둥을 내린다
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, SWING_GAP_Y, 12),
      metalMat,
    )
    foot.position.set(0, -(GAP_HALF + YOKE_T) - SWING_GAP_Y / 2 + 0.02, BACK_Z)
    horseshoe.add(foot)
  }

  // ══ 모드 B: 직류 전동기 ════════════════════════════════════════════
  const motorScene = new THREE.Group()
  scene.add(motorScene)

  // 마주 보는 두 자석(N·S) — 자기장이 이 사이를 가로로 지난다
  //
  // ⚠️ 자석 하나를 통째로 한 색(N만 또는 S만)으로 칠하면 **홀극(monopole)** 처럼 보여
  //    "N극만 있는 자석"이라는 오개념을 심을 수 있다. 자석은 언제나 두 극이 함께 있으므로,
  //    막대자석 하나를 안쪽 절반·바깥쪽 절반 두 색으로 나눠 칠하고 N/S 글자를 붙인다.
  //    코일에 영향을 주는 것은 **마주 보는 안쪽 극**이다.
  // 두 극이 각각 하나의 덩어리로 또렷이 보이도록 폭을 넉넉히 준다 — N/S 딱지도 서로 겹치지
  // 않을 만큼 떨어뜨릴 수 있어야 한다.
  const MAG_W = 0.34
  const motorMagnets = []
  for (const sx of [-1, 1]) {
    const group = new THREE.Group()
    group.position.set(sx * MOTOR_MAGNET_X, MOTOR_CENTER_Y, 0)
    motorScene.add(group)

    // 자석은 코일이 도는 원(반지름 COIL_HALF_W)보다 낮게 만든다 — 안 그러면 자석이
    // 코일을 가려서 무엇이 도는지 안 보인다.
    const halves = {}
    for (const side of ['inner', 'outer']) {
      // inner = 가운데(코일) 쪽 절반, outer = 바깥쪽 절반
      const dir = side === 'inner' ? -sx : sx
      const half = new THREE.Mesh(
        new THREE.BoxGeometry(MAG_W / 2, 0.44, 0.66),
        new THREE.MeshStandardMaterial({ color: N_COLOR }),
      )
      half.position.x = dir * MAG_W / 4
      group.add(half)
      halves[side] = half
    }
    const labels = {
      inner: makePoleLabel(group, -sx * MAG_W / 4, 0.33, 0.36, 0.14),
      outer: makePoleLabel(group, sx * MAG_W / 4, 0.33, 0.36, 0.14),
    }
    motorMagnets.push({ halves, labels })

    // 자석 받침
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, MOTOR_CENTER_Y - 0.22, 0.22), metalMat)
    foot.position.set(sx * MOTOR_MAGNET_X, (MOTOR_CENTER_Y - 0.22) / 2, 0)
    motorScene.add(foot)
  }

  // 회전축(보는 사람 쪽 z축) + 그 위에 실린 코일
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.55, 12), metalMat)
  axle.rotation.x = Math.PI / 2
  axle.position.set(0, MOTOR_CENTER_Y, 0.18)
  motorScene.add(axle)

  const rotor = new THREE.Group()
  rotor.position.set(0, MOTOR_CENTER_Y, 0)
  motorScene.add(rotor)
  {
    // 코일을 회전축(z) 위에 눕힌다: 두 긴 변이 z방향(축과 나란)으로 ±COIL_HALF_W 자리에 온다.
    // rotation.x = +π/2가 코일의 세로변을 −z쪽으로 눕히므로, 다시 +COIL_LEN/2만큼 앞으로
    // 옮겨야 코일 한가운데가 축 위(z=0)에 온다.
    const coil = makeCoil(true)
    coil.rotation.x = Math.PI / 2
    coil.position.set(0, 0, COIL_LEN / 2)
    rotor.add(coil)
  }

  // 정류자(반으로 쪼갠 고리) + 브러시 — 반 바퀴마다 결선이 뒤집히는 것을 눈에 보이게 한다
  // 정류자(整流子) — **반으로 쪼갠 고리** 두 조각. 각 조각이 코일의 한쪽 끝에 이어져 있고,
  // 고리는 코일과 함께 돈다. 양옆에 고정된 브러시가 고리에 닿아 전지의 전류를 넘겨준다.
  //
  // 고리의 **틈**은 브러시 자리(양옆, ±x)에 왔을 때 회로가 끊기도록 위·아래(±y)에 둔다.
  // 고리가 회전각 θ만큼 돌면 틈은 θ±π/2에 오므로, θ가 π/2·3π/2(죽은점)일 때 정확히
  // 브러시에 닿는다 — model.js의 isCommutatorBreak()가 보는 각도와 같은 자리다.
  const COMM_Z = 0.72
  const COMM_R = 0.13
  const COMM_TUBE = 0.035
  const BRUSH_X = COMM_R + COMM_TUBE + 0.015
  const commutator = new THREE.Group()
  commutator.position.set(0, MOTOR_CENTER_Y, COMM_Z)
  motorScene.add(commutator)
  {
    const gap = COMMUTATOR_BREAK_HALF_ANGLE // 그림의 틈 = 모델이 전류를 끊는 구간(같은 값)
    const arc = Math.PI - gap * 2
    // 토러스는 +x에서 시작해 반시계로 감긴다. 첫 조각은 +x쪽 절반, 둘째 조각은 −x쪽 절반.
    for (const startRot of [-(Math.PI / 2 - gap), Math.PI / 2 + gap]) {
      const half = new THREE.Mesh(
        new THREE.TorusGeometry(COMM_R, COMM_TUBE, 10, 24, arc),
        new THREE.MeshStandardMaterial({ color: COPPER, metalness: 0.4, roughness: 0.4 }),
      )
      half.rotation.z = startRot
      commutator.add(half)
    }
  }

  // 브러시 — 고리 양옆에 고정된 금속 판(사진의 회색 판). 고리와 함께 돌지 않는다.
  const brushMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.5, roughness: 0.5 })
  for (const sx of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.16), brushMat)
    plate.position.set(sx * (BRUSH_X + 0.012), MOTOR_CENTER_Y, COMM_Z)
    motorScene.add(plate)
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, MOTOR_CENTER_Y - 0.1, 10),
      brushMat,
    )
    post.position.set(sx * (BRUSH_X + 0.012), (MOTOR_CENTER_Y - 0.1) / 2, COMM_Z)
    motorScene.add(post)
  }

  // 전지와 회로 — 사진처럼 앞쪽 낮은 자리에 납작하게 둬서 코일 관찰을 가리지 않게 한다.
  // 전지에서 나온 전류는 도선 → 브러시 → 정류자 → 코일로 흐른다. **바깥 회로(도선)의 전류
  // 방향은 늘 그대로**이고, 정류자가 코일 쪽 연결만 반 바퀴마다 갈아끼운다 — 그래서 코일
  // 속 전류만 뒤집힌다. 이 대비가 직류 전동기의 핵심이라 둘을 한 화면에서 같이 보여 준다.
  const BATT_Y = 0.13
  const BATT_Z = 1.18
  const BATT_HALF = 0.24
  const circuit = { wires: [], terminals: [], labels: [] }
  {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, BATT_HALF * 2, 18),
      new THREE.MeshStandardMaterial({ color: '#1f2937' }),
    )
    body.rotation.z = Math.PI / 2
    body.position.set(0, BATT_Y, BATT_Z)
    motorScene.add(body)

    for (const sx of [-1, 1]) {
      // 전지의 양 끝(+ 또는 −) — model.direction에 따라 색이 바뀐다
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.105, 0.1, 18),
        new THREE.MeshStandardMaterial({ color: '#dc2626' }),
      )
      cap.rotation.z = Math.PI / 2
      cap.position.set(sx * BATT_HALF, BATT_Y, BATT_Z)
      motorScene.add(cap)

      // 전지 끝 → 같은 쪽 브러시로 잇는 도선
      const from = new THREE.Vector3(sx * (BATT_HALF + 0.06), BATT_Y, BATT_Z)
      const to = new THREE.Vector3(sx * (BRUSH_X + 0.02), MOTOR_CENTER_Y - 0.06, COMM_Z)
      const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, from.distanceTo(to), 8),
        new THREE.MeshStandardMaterial({ color: '#dc2626' }),
      )
      wire.position.copy(from.clone().add(to).multiplyScalar(0.5))
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
      motorScene.add(wire)

      // 어느 쪽이 +극인지 글자로 분명히 보여 준다 — 전류가 어디서 나와 어디로 들어가는지
      // 읽으려면 색만으로는 부족하다. 전지 옆(바깥쪽 위)에 띄워 회로를 가리지 않게 한다.
      circuit.labels.push(
        makeTerminalLabel(motorScene, sx * (BATT_HALF + 0.02), BATT_Y + 0.21, BATT_Z),
      )
      circuit.terminals.push(cap)
      circuit.wires.push({ mesh: wire, from, to, sx })
    }
  }

  // ── 보조 화살표(I·B·F·τ) ─────────────────────────────────────────
  //
  // three.js가 기본으로 주는 ArrowHelper는 몸통을 **선(Line)** 으로 그려서 아무리 설정해도
  // 1픽셀 굵기라 잘 안 보인다. 그래서 원기둥(몸통) + 원뿔(머리)로 직접 만들어 굵기를
  // 마음대로 정한다. 기본 방향은 +Y이고, set()에서 원하는 방향으로 회전시킨다.
  function makeArrow(color, shaftR = 0.032) {
    const mat = new THREE.MeshStandardMaterial({ color })
    const HEAD_H = shaftR * 4.2
    const g = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR, shaftR, 1, 14), mat)
    const head = new THREE.Mesh(new THREE.ConeGeometry(shaftR * 2.1, HEAD_H, 16), mat)
    g.add(shaft, head)
    g.visible = false
    scene.add(g)
    const UP = new THREE.Vector3(0, 1, 0)
    return {
      set(origin, dir, length) {
        if (length <= 1e-4 || dir.lengthSq() < 1e-9) {
          g.visible = false
          return
        }
        g.visible = true
        const headLen = Math.min(HEAD_H, length * 0.45)
        const shaftLen = Math.max(1e-3, length - headLen)
        shaft.scale.y = shaftLen
        shaft.position.y = shaftLen / 2
        head.scale.y = headLen / HEAD_H
        head.position.y = shaftLen + headLen / 2
        g.position.copy(origin)
        g.quaternion.setFromUnitVectors(UP, dir.clone().normalize())
      },
      hide() {
        g.visible = false
      },
    }
  }
  // 전류 화살표는 도선과 **같은 축에** 놓이므로 도선(WIRE_R)보다 굵어야 도선 속에 파묻히지
  // 않고 밖에서 보인다. 나머지는 빈 공간에 그려지므로 조금 가늘어도 된다.
  const CURRENT_SHAFT_R = WIRE_R * 1.35
  const arrows = {
    // 그네 모드
    swingI: makeArrow(CURRENT_COLOR, CURRENT_SHAFT_R),
    swingB1: makeArrow(FIELD_COLOR),
    swingB2: makeArrow(FIELD_COLOR),
    swingB3: makeArrow(FIELD_COLOR),
    swingF: makeArrow(FORCE_COLOR, 0.036),
    // 전동기 모드 — 코일 양쪽 변에 하나씩
    motorB1: makeArrow(FIELD_COLOR),
    motorB2: makeArrow(FIELD_COLOR),
    motorIa: makeArrow(CURRENT_COLOR, CURRENT_SHAFT_R),
    motorIb: makeArrow(CURRENT_COLOR, CURRENT_SHAFT_R),
    motorFa: makeArrow(FORCE_COLOR, 0.036),
    motorFb: makeArrow(FORCE_COLOR, 0.036),
    // 바깥 회로(전지 ↔ 브러시) 도선에 흐르는 전류 — 코일 속과 달리 방향이 안 바뀐다
    circuitA: makeArrow(CURRENT_COLOR, 0.026),
    circuitB: makeArrow(CURRENT_COLOR, 0.026),
  }

  function placeArrow(arrow, origin, dir, length) {
    arrow.set(origin, dir, length)
  }

  function hideAll() {
    for (const a of Object.values(arrows)) a.hide()
  }

  /**
   * @param model - motor/js/model.js의 상태 그대로
   * @param showHelper - 보조 화살표(I·B·F·τ) 표시 여부
   */
  function update(model, showHelper) {
    const isMotor = model.mode === 'motor'
    swingScene.visible = !isMotor
    motorScene.visible = isMotor
    hideAll()

    const on = currentLevel(model) > 0
    const level = currentLevel(model)
    const pol = model.magnetPolarity

    if (!isMotor) {
      // ── 전기 그네 ──
      // 양(+) swingAngle이 앞(+z)으로 나가도록 x축 둘레 회전 부호를 맞춘다.
      swingPivot.rotation.x = -model.swingAngle

      // 위/아래 극 색. 두 극 사이의 자기장은 **N극 면에서 나와 S극 면으로 들어간다** —
      // 그래서 자기장이 위로 향하는(polarity=+1) 배치는 **아래가 N, 위가 S**다.
      const [upper, lower] = horseshoe.userData.poles
      lower.material.color.set(pol > 0 ? N_COLOR : S_COLOR)
      upper.material.color.set(pol > 0 ? S_COLOR : N_COLOR)
      const [upperLabel, lowerLabel] = horseshoe.userData.labels
      lowerLabel.setPole(pol > 0 ? 'N' : 'S')
      upperLabel.setPole(pol > 0 ? 'S' : 'N')

      if (showHelper && on) {
        const gapHalf = horseshoe.userData.gapHalf
        // 아래 가로 도선의 지금 위치(그네가 흔들리면 같이 움직인다)
        const wire = new THREE.Vector3(0, -COIL_LEN, 0).applyEuler(swingPivot.rotation).add(swingPivot.position)

        // B — 말굽자석 **두 극 사이**를 지나는 자기장. N극 면에서 나와 S극 면으로 들어가는
        // 모습이 그대로 보이도록, 틈의 **아래 극 면에서 위 극 면까지 꽉 채워** 그린다.
        //
        // 자리도 중요하다: 예전에는 틈 안쪽 깊숙이(z=0) 짧게 그려서, 코일 도선과 전류 화살표
        // 뒤에 가려 잘 보이지 않았다(2026-08-07 사용자 지적). 말굽이 트여 있는 앞쪽으로
        // 당겨 오면 두 극 사이를 지나는 것이 한눈에 보인다.
        const bFrom = SWING_GAP_Y - gapHalf // N극 면(polarity가 +면 아래가 N)
        for (const [key, sx] of [['swingB1', -1], ['swingB2', 0], ['swingB3', 1]]) {
          placeArrow(
            arrows[key],
            new THREE.Vector3(sx * 0.1, pol > 0 ? bFrom : bFrom + gapHalf * 2, SWING_B_Z),
            new THREE.Vector3(0, pol, 0),
            gapHalf * 2,
          )
        }
        // I — 아래 가로 도선을 따라 흐르는 전류. 도선과 같은 축에, 도선보다 굵고 길게 그려
        // 도선에 파묻히지 않게 한다(머리가 도선 끝 밖으로 나오도록).
        placeArrow(
          arrows.swingI,
          wire.clone().add(new THREE.Vector3(-model.direction * COIL_HALF_W, 0, 0)),
          new THREE.Vector3(model.direction, 0, 0),
          COIL_HALF_W * 2.3,
        )
        // F — 전류(x)와 자기장(y)에 모두 수직인 방향(z). 세기는 전류에 비례.
        // 이 시뮬레이터에서 가장 중요한 화살표라 넉넉히 길게 그린다.
        placeArrow(arrows.swingF, wire, new THREE.Vector3(0, 0, model.direction * pol), 0.4 + 0.7 * level)
      }
    } else {
      // ── 직류 전동기 ──
      rotor.rotation.z = model.motorAngle

      // 좌우 자석의 극 배치. 두 자석 사이 자기장은 마주 보는 **안쪽 극**이 정한다 —
      // polarity가 +1이면 왼쪽 자석의 안쪽이 N이라 자기장이 왼→오(+x)로 흐른다.
      // 자석 하나에는 언제나 N과 S가 함께 있으므로 바깥쪽 절반은 항상 반대 극이다.
      const leftInnerIsN = pol > 0
      for (const [i, innerIsN] of [[0, leftInnerIsN], [1, !leftInnerIsN]]) {
        const mag = motorMagnets[i]
        mag.halves.inner.material.color.set(innerIsN ? N_COLOR : S_COLOR)
        mag.halves.outer.material.color.set(innerIsN ? S_COLOR : N_COLOR)
        mag.labels.inner.setPole(innerIsN ? 'N' : 'S')
        mag.labels.outer.setPole(innerIsN ? 'S' : 'N')
      }

      // 정류자도 코일과 함께 돈다 — 브러시에 닿는 조각이 반 바퀴마다 바뀐다
      commutator.rotation.z = model.motorAngle

      // 전지의 +/− 와 도선 색. 전류 방향 버튼을 누르면 전지가 뒤집힌 것처럼 바뀐다.
      // 빨강 = 전류가 나오는 쪽(+), 파랑 = 전류가 들어가는 쪽(−).
      const broken = isCommutatorBreak(model)
      circuit.terminals.forEach((cap, i) => {
        const isPlus = (i === 0) === (model.direction > 0)
        cap.material.color.set(isPlus ? '#dc2626' : '#1d4ed8')
        circuit.labels[i].setPlus(isPlus)
      })
      circuit.wires.forEach((w, i) => {
        const isPlus = (i === 0) === (model.direction > 0)
        // 정류자 틈이 브러시에 온 순간에는 회로가 끊겨 있다 — 도선을 회색으로 죽여서
        // "지금은 전류가 흐르지 않는다"를 한눈에 보이게 한다.
        const live = on && !broken
        w.mesh.material.color.set(!live ? '#9ca3af' : isPlus ? '#dc2626' : '#1d4ed8')
      })

      if (showHelper && on) {
        const center = new THREE.Vector3(0, MOTOR_CENTER_Y, 0)
        // B — 두 자석 사이를 가로지르는 자기장
        for (const [key, sz] of [['motorB1', -0.32], ['motorB2', 0.32]]) {
          placeArrow(
            arrows[key],
            new THREE.Vector3(-pol * 0.55, MOTOR_CENTER_Y, sz),
            new THREE.Vector3(pol, 0, 0),
            1.1,
          )
        }

        // 코일 두 긴 변의 지금 위치 — 축(z) 둘레로 돌고 있다
        const a = model.motorAngle
        const armA = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(COIL_HALF_W)
        const sideA = center.clone().add(armA)
        const sideB = center.clone().sub(armA)

        // 코일 두 변이 거의 위아래로 겹쳐 보이는 각도에서는 화살표가 서로 포개져 읽기
        // 어려워 숨긴다. 일시정지하고 어느 순간이든 관찰할 수 있어야 하므로, 자바실험실의
        // 기준(0.3)보다 낮춰 정말 겹치는 구간에서만 감춘다.
        // 바깥 회로(전지 ↔ 브러시)의 전류 — 코일 속과 달리 **방향이 바뀌지 않는다**.
        // 정류자가 끊겨 있는 동안에는 아예 안 흐르므로 화살표도 감춘다.
        if (!broken) {
          circuit.wires.forEach((w, i) => {
            const isPlus = (i === 0) === (model.direction > 0)
            // +단자에서는 브러시 쪽으로, −단자에서는 전지 쪽으로 흐른다
            const from = isPlus ? w.from : w.to
            const to = isPlus ? w.to : w.from
            const dir = to.clone().sub(from)
            const len = Math.min(0.42, dir.length() * 0.5)
            const mid = from.clone().add(dir.clone().multiplyScalar(0.5)).addScaledVector(dir.clone().normalize(), -len / 2)
            placeArrow(arrows[i === 0 ? 'circuitA' : 'circuitB'], mid, dir, len)
          })
        }

        const facing = Math.abs(Math.cos(reducedMotorAngle(model)))
        // 전류가 끊긴 순간에는 전류도 힘도 없으므로 화살표를 그리지 않는다 — 그 "잠깐 끊김"이
        // 바로 정류자가 방향을 갈아타는 순간이다.
        if (facing > 0.15 && !broken) {
          // I — 두 변에 흐르는 전류는 서로 반대 방향(축 방향 ±z). 정류자가 반 바퀴마다 뒤집는다.
          // 코일 변과 같은 축에, 변보다 굵고 길게 그려 도선에 파묻히지 않게 한다.
          const iSign = model.direction * commutatorPhase(model)
          const iLen = COIL_LEN * 1.25
          placeArrow(arrows.motorIa, sideA.clone().add(new THREE.Vector3(0, 0, -iSign * iLen / 2)), new THREE.Vector3(0, 0, iSign), iLen)
          placeArrow(arrows.motorIb, sideB.clone().add(new THREE.Vector3(0, 0, iSign * iLen / 2)), new THREE.Vector3(0, 0, -iSign), iLen)

          // F — I×B. 두 변의 전류가 반대라 힘도 서로 반대 → 이것이 회전을 만든다.
          // 이 시뮬레이터에서 가장 중요한 화살표라 넉넉히 길게 그린다.
          const fLen = 0.36 + 0.6 * level
          const fSign = model.direction * pol * commutatorPhase(model)
          placeArrow(arrows.motorFa, sideA, new THREE.Vector3(0, fSign, 0), fLen)
          placeArrow(arrows.motorFb, sideB, new THREE.Vector3(0, -fSign, 0), fLen)
        }
      }
    }
  }

  /**
   * 모드마다 장치의 크기·높이가 달라서 좋은 시점도 다르다. 모드를 바꿀 때 그 모드에 맞는
   * 기본 시점으로 되돌린다 — 이후에는 학생이 자유롭게 돌려 볼 수 있다.
   */
  function focusMode(mode) {
    if (mode === 'motor') {
      // 전동기는 회전축(보는 사람 쪽 z축)을 비스듬히 봐야 한다 — 축에 너무 가까우면 축을
      // 따라 흐르는 전류 화살표가 앞뒤로 눌려 보이지 않고, 너무 옆이면 자석이 코일을 가린다.
      // 자석·코일뿐 아니라 앞쪽의 전지·도선까지 한 화면에 들어와야 해서 조금 물러나
      // 잡고, 바라보는 점도 앞쪽으로 당긴다.
      camera.position.set(2.3, 2.1, 3.2)
      controls.target.set(0, 0.72, 0.42)
    } else {
      // 그네는 위에 매달린 코일까지 들어와야 하니 조금 높고 멀리서. 가로(x)로 흐르는 전류와
      // 앞뒤(z)로 밀리는 힘을 둘 다 비스듬히 보려면 x와 z 어느 한쪽으로 치우치면 안 된다 —
      // 축 정면에서 보면 그 축 방향 화살표가 눌려서 안 보인다.
      camera.position.set(2.1, 1.5, 1.75)
      controls.target.set(0, 0.88, 0)
    }
    controls.update()
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

  return { update, resize, renderFrame, focusMode, camera, controls }
}
