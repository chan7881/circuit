// three.js 3D 장면 구성·갱신. main.js가 넘겨준 <canvas> 하나만 받는다 — DOM은 main.js만
// 직접 건드린다는 원칙을 유지한다. magnetic-field/js/render.js와 같은 구조.
//
// ⚠️ 결과를 말로 풀어주지 않는다 — 그네가 어느 쪽으로 흔들리는지, 전동기가 어느 방향으로
//    도는지는 학생이 화면을 보고 스스로 확인해야 한다.
//
// 장치 모양은 자바실험실의 「전자기력(전기 그네)」·「직류 전동기」 시뮬레이션을 참고해
// 실제 실험 기구 배치를 따랐다(2026-08-07 사용자 피드백). 화살표 색도 같은 규약을 쓴다:
//   전류 I = 검정 · 자기장 B = 초록 · 힘 F = 빨강 · 돌림힘 τ = 자홍
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
import { currentLevel, commutatorPhase, reducedMotorAngle, motorTorque } from './model.js'

const N_COLOR = '#e11d48'
const S_COLOR = '#2563eb'
const COPPER = '#c2803a'
const CURRENT_COLOR = 0x111827 // 전류 I — 검정
const FIELD_COLOR = 0x00b050 // 자기장 B — 초록
const FORCE_COLOR = 0xef4444 // 힘 F — 빨강
const TORQUE_COLOR = 0xd946ef // 돌림힘 τ — 자홍

// ── 공통 코일 치수 ──
const COIL_HALF_W = 0.42 // 가로 반너비(두 세로변 사이 거리의 절반)
const COIL_LEN = 0.92 // 세로변 길이(그네에서는 매단 길이, 전동기에서는 축 방향 길이)
const WIRE_R = 0.028

// ── 모드 A(그네) 배치 ──
const PIVOT_Y = 1.5
const SWING_GAP_Y = PIVOT_Y - COIL_LEN // 아래 가로 도선의 높이(= 말굽자석 틈 한가운데)

// ── 모드 B(전동기) 배치 ──
const MOTOR_CENTER_Y = 0.95
const MOTOR_MAGNET_X = 0.57

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
  const motorMagnets = []
  for (const sx of [-1, 1]) {
    const mag = new THREE.Mesh(
      // 자석은 코일이 도는 원(반지름 COIL_HALF_W)보다 낮게 만든다 — 안 그러면 자석이
      // 코일을 가려서 무엇이 도는지 안 보인다.
      new THREE.BoxGeometry(0.14, 0.44, 0.66),
      new THREE.MeshStandardMaterial({ color: N_COLOR }),
    )
    mag.position.set(sx * MOTOR_MAGNET_X, MOTOR_CENTER_Y, 0)
    motorScene.add(mag)
    motorMagnets.push(mag)
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
  const COMM_Z = 0.72
  const commutator = new THREE.Group()
  commutator.position.set(0, MOTOR_CENTER_Y, COMM_Z)
  motorScene.add(commutator)
  for (const [i, color] of [[0, '#dc2626'], [1, '#111827']]) {
    const half = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.14, 20, 1, false, i * Math.PI + 0.08, Math.PI - 0.16),
      new THREE.MeshStandardMaterial({ color }),
    )
    half.rotation.x = Math.PI / 2
    commutator.add(half)
  }
  for (const sy of [1, -1]) {
    const brush = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.09), new THREE.MeshStandardMaterial({ color: '#475569' }))
    brush.position.set(0, sy * 0.16, COMM_Z)
    motorScene.add(brush)
  }

  // 전지 — 빨강(+)·검정(−) 단자. 브러시까지 도선으로 이어 회로가 닫힌 것을 보인다.
  const BATT_Y = 0.12
  const BATT_Z = 1.32
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.28), new THREE.MeshStandardMaterial({ color: '#f8fafc' }))
    body.position.set(0, BATT_Y, BATT_Z)
    motorScene.add(body)
    for (const [sx, color, brushY] of [[-1, '#dc2626', 0.16], [1, '#111827', -0.16]]) {
      const term = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10),
        new THREE.MeshStandardMaterial({ color }),
      )
      term.position.set(sx * 0.24, BATT_Y + 0.15, BATT_Z)
      motorScene.add(term)
      // 단자 → 브러시 도선
      const from = new THREE.Vector3(sx * 0.24, BATT_Y + 0.19, BATT_Z)
      const to = new THREE.Vector3(0, MOTOR_CENTER_Y + brushY, COMM_Z)
      const mid = from.clone().add(to).multiplyScalar(0.5)
      const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, from.distanceTo(to), 8),
        new THREE.MeshStandardMaterial({ color }),
      )
      wire.position.copy(mid)
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
      motorScene.add(wire)
    }
  }

  // ── 보조 화살표(I·B·F·τ) ─────────────────────────────────────────
  function makeArrow(color) {
    const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.3, color, 0.1, 0.07)
    scene.add(a)
    return a
  }
  const arrows = {
    // 그네 모드
    swingI: makeArrow(CURRENT_COLOR),
    swingB1: makeArrow(FIELD_COLOR),
    swingB2: makeArrow(FIELD_COLOR),
    swingF: makeArrow(FORCE_COLOR),
    // 전동기 모드 — 코일 양쪽 변에 하나씩
    motorB1: makeArrow(FIELD_COLOR),
    motorB2: makeArrow(FIELD_COLOR),
    motorIa: makeArrow(CURRENT_COLOR),
    motorIb: makeArrow(CURRENT_COLOR),
    motorFa: makeArrow(FORCE_COLOR),
    motorFb: makeArrow(FORCE_COLOR),
    motorTa: makeArrow(TORQUE_COLOR),
    motorTb: makeArrow(TORQUE_COLOR),
  }

  function placeArrow(arrow, origin, dir, length) {
    if (length <= 1e-4 || dir.lengthSq() < 1e-9) {
      arrow.visible = false
      return
    }
    arrow.visible = true
    arrow.position.copy(origin)
    arrow.setDirection(dir.clone().normalize())
    arrow.setLength(length, Math.min(0.12, length * 0.35), Math.min(0.08, length * 0.22))
  }

  function hideAll() {
    for (const a of Object.values(arrows)) a.visible = false
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

      if (showHelper && on) {
        const gapHalf = horseshoe.userData.gapHalf
        // 아래 가로 도선의 지금 위치(그네가 흔들리면 같이 움직인다)
        const wire = new THREE.Vector3(0, -COIL_LEN, 0).applyEuler(swingPivot.rotation).add(swingPivot.position)

        // B — 틈 사이를 지나는 연직 자기장(polarity가 방향을 정한다). 도선 양옆에 두 개.
        for (const [key, sx] of [['swingB1', -1], ['swingB2', 1]]) {
          const from = new THREE.Vector3(sx * 0.09, SWING_GAP_Y - gapHalf * 0.9, 0)
          placeArrow(arrows[key], from, new THREE.Vector3(0, pol, 0), gapHalf * 1.8)
        }
        // I — 아래 가로 도선을 따라 흐르는 전류
        placeArrow(
          arrows.swingI,
          wire.clone().add(new THREE.Vector3(-model.direction * COIL_HALF_W * 0.8, 0, 0)),
          new THREE.Vector3(model.direction, 0, 0),
          COIL_HALF_W * 1.5,
        )
        // F — 전류(x)와 자기장(y)에 모두 수직인 방향(z). 세기는 전류에 비례.
        placeArrow(arrows.swingF, wire, new THREE.Vector3(0, 0, model.direction * pol), 0.2 + 0.35 * level)
      }
    } else {
      // ── 직류 전동기 ──
      rotor.rotation.z = model.motorAngle

      // 좌우 자석 색 — polarity가 +1이면 왼쪽이 N(자기장이 왼→오, 즉 +x)
      motorMagnets[0].material.color.set(pol > 0 ? N_COLOR : S_COLOR)
      motorMagnets[1].material.color.set(pol > 0 ? S_COLOR : N_COLOR)

      // 정류자도 코일과 함께 돈다 — 브러시에 닿는 조각이 반 바퀴마다 바뀐다
      commutator.rotation.z = model.motorAngle

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

        // 코일 면이 자기장과 거의 수직인 죽은점 부근에서는 화살표가 겹쳐 읽기 어려워 숨긴다
        // (자바실험실도 같은 이유로 |cos θ| < 0.3에서 감춘다)
        const facing = Math.abs(Math.cos(reducedMotorAngle(model)))
        if (facing > 0.3) {
          // I — 두 변에 흐르는 전류는 서로 반대 방향(축 방향 ±z). 정류자가 반 바퀴마다 뒤집는다.
          const iSign = model.direction * commutatorPhase(model)
          placeArrow(arrows.motorIa, sideA.clone().add(new THREE.Vector3(0, 0, -iSign * 0.3)), new THREE.Vector3(0, 0, iSign), 0.6)
          placeArrow(arrows.motorIb, sideB.clone().add(new THREE.Vector3(0, 0, iSign * 0.3)), new THREE.Vector3(0, 0, -iSign), 0.6)

          // F — I×B. 두 변의 전류가 반대라 힘도 서로 반대 → 이것이 회전을 만든다.
          const fLen = 0.18 + 0.3 * level
          const fSign = model.direction * pol * commutatorPhase(model)
          placeArrow(arrows.motorFa, sideA, new THREE.Vector3(0, fSign, 0), fLen)
          placeArrow(arrows.motorFb, sideB, new THREE.Vector3(0, -fSign, 0), fLen)

          // τ — 돌림힘. 코일 면이 자기장과 나란할수록 커진다(τ ∝ cos θ).
          const tLen = 0.1 + 0.4 * Math.abs(motorTorque(model))
          const tangential = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0)
          const tSign = Math.sign(motorTorque(model)) || 1
          placeArrow(arrows.motorTa, sideA, tangential.clone().multiplyScalar(tSign), tLen)
          placeArrow(arrows.motorTb, sideB, tangential.clone().multiplyScalar(-tSign), tLen)
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
      // 전동기는 회전축(보는 사람 쪽 z축)에 가깝게, 살짝 위에서 내려다봐야 코일이 도는 게
      // 잘 보인다 — 옆으로 많이 치우치면 자석이 코일을 가린다.
      camera.position.set(1.05, 1.55, 2.5)
      controls.target.set(0, 0.95, 0)
    } else {
      // 그네는 위에 매달린 코일까지 들어와야 하니 조금 높고 멀리서.
      camera.position.set(1.5, 1.4, 2.15)
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
