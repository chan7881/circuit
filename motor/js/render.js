// three.js 3D 장면 구성·갱신. main.js가 넘겨준 <canvas> 하나만 받는다 — DOM은 main.js만
// 직접 건드린다는 원칙을 유지한다. magnetic-field/js/render.js와 같은 구조.
//
// ⚠️ 결과를 말로 풀어주지 않는다 — 그네가 어느 쪽으로 흔들리는지, 전동기가 어느 방향으로
//    도는지는 학생이 화면을 보고 스스로 확인해야 한다.
//
// **같은 막대(코일)를 두 가지 방식으로 매단다**: 모드 A(그네)는 위쪽 한 점(pivot)에 매달아
// 아래로 늘어뜨리고, 모드 B(전동기)는 같은 점을 지나는 회전축으로 삼아 막대 전체가 그 점을
// 중심으로 계속 돈다. 자석은 두 다리(prong)가 마주보는 말굽(⊓) 모양이고, 다리 끝의 색이
// 극(N=빨강, S=파랑)을 나타낸다 — model.js의 magnetPolarity를 바꾸면 색이 바로 바뀐다.

import * as THREE from 'three'
import { OrbitControls } from '../../vendor/three/OrbitControls.js'
import { currentLevel, commutatorPhase } from './model.js'

const N_COLOR = '#dc2626'
const S_COLOR = '#1d4ed8'
const CURRENT_COLOR = 0xf59e0b
const FIELD_COLOR = 0x16a34a
const FORCE_COLOR = 0x7c3aed

const LEG_X = 0.42
const LEG_BOTTOM_Y = 0.3
const YOKE_Y = 1.25
const PIVOT = new THREE.Vector3(0, YOKE_Y, 0)
const ROD_FULL = 0.75 // 그네(모드 A) 막대 길이(피벗에서 끝까지)
const ROTOR_HALF = 0.5 // 전동기(모드 B) 막대 한쪽 절반 길이(피벗이 한가운데)

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#eef2f7')

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(2.7, 1.9, 3.7)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 1.6
  controls.maxDistance = 9
  controls.maxPolarAngle = Math.PI / 2 - 0.03
  controls.target.set(0, 0.75, 0)
  controls.update()

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cf, 1.0))
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(4, 6, 3)
  scene.add(sun)

  // ── 실험대 ──
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9 }),
  )
  table.position.y = -0.06
  scene.add(table)
  const grid = new THREE.GridHelper(6.4, 16, '#cbd5e1', '#dbe3ec')
  grid.position.y = 0.001
  scene.add(grid)

  // ── 말굽자석 ──
  const yokeMat = new THREE.MeshStandardMaterial({ color: '#94a3b8' })
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(LEG_X * 2 + 0.16, 0.16, 0.16), yokeMat)
  yoke.position.set(0, YOKE_Y, 0)
  scene.add(yoke)

  function makeLeg(x) {
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, YOKE_Y - LEG_BOTTOM_Y - 0.18, 0.14),
      yokeMat,
    )
    body.position.set(x, (YOKE_Y + LEG_BOTTOM_Y + 0.18) / 2, 0)
    group.add(body)
    const capMat = new THREE.MeshStandardMaterial({ color: N_COLOR })
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), capMat)
    cap.position.set(x, LEG_BOTTOM_Y + 0.08, 0)
    group.add(cap)
    scene.add(group)
    return { cap, capMat }
  }
  const legLeft = makeLeg(-LEG_X)
  const legRight = makeLeg(LEG_X)

  const pivotMarker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshStandardMaterial({ color: '#475569' }))
  pivotMarker.position.copy(PIVOT)
  scene.add(pivotMarker)

  // ── 막대(코일) ── 모드 A(그네)용, 모드 B(전동기)용 두 가지 지오메트리를 준비해두고 토글한다
  const rodMat = new THREE.MeshStandardMaterial({ color: '#b45309' })
  const tipMat = new THREE.MeshStandardMaterial({ color: '#facc15' })

  const rodGroup = new THREE.Group()
  rodGroup.position.copy(PIVOT)
  scene.add(rodGroup)

  const swingRod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, ROD_FULL, 16), rodMat)
  swingRod.position.set(0, -ROD_FULL / 2, 0)
  rodGroup.add(swingRod)
  const swingTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), tipMat)
  swingTip.position.set(0, -ROD_FULL, 0)
  rodGroup.add(swingTip)

  const motorRod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, ROTOR_HALF * 2, 16), rodMat)
  rodGroup.add(motorRod)
  const motorTipA = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), tipMat)
  motorTipA.position.set(0, ROTOR_HALF, 0)
  rodGroup.add(motorTipA)
  const motorTipB = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), tipMat)
  motorTipB.position.set(0, -ROTOR_HALF, 0)
  rodGroup.add(motorTipB)

  // ── 오른손 법칙 보조 화살표(전류 I·자기장 B·힘 F) — 토글로 켜고 끈다 ──
  function makeArrowSet() {
    return {
      current: new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.3, CURRENT_COLOR, 0.09, 0.06),
      field: new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.3, FIELD_COLOR, 0.09, 0.06),
      force: new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.3, FORCE_COLOR, 0.09, 0.06),
    }
  }
  const arrowsA = makeArrowSet()
  const arrowsB = makeArrowSet()
  for (const set of [arrowsA, arrowsB]) for (const arrow of Object.values(set)) scene.add(arrow)

  function rodAxis(theta) {
    return new THREE.Vector3(0, Math.cos(theta), Math.sin(theta))
  }

  function placeArrowSet(set, midpoint, axis, currentSign, magnetPolarity, length) {
    const currentVec = axis.clone().multiplyScalar(currentSign)
    const fieldVec = new THREE.Vector3(magnetPolarity, 0, 0)
    const forceVec = new THREE.Vector3().crossVectors(currentVec, fieldVec)
    if (forceVec.lengthSq() < 1e-9) forceVec.set(0, 0, 1) // 전류·자기장이 나란해 힘이 0일 때도 화살표가 사라지지 않게
    set.current.position.copy(midpoint)
    set.current.setDirection(currentVec.clone().normalize())
    set.current.setLength(length, length * 0.3, length * 0.2)
    set.field.position.copy(midpoint)
    set.field.setDirection(fieldVec.clone().normalize())
    set.field.setLength(length, length * 0.3, length * 0.2)
    set.force.position.copy(midpoint)
    set.force.setDirection(forceVec.normalize())
    set.force.setLength(length, length * 0.3, length * 0.2)
  }

  function setArrowSetVisible(set, visible) {
    for (const arrow of Object.values(set)) arrow.visible = visible
  }

  /**
   * @param model - motor/js/model.js의 상태 그대로
   * @param showHelper - 오른손 법칙 보조 화살표 표시 여부
   */
  function update(model, showHelper) {
    const isMotor = model.mode === 'motor'
    swingRod.visible = !isMotor
    swingTip.visible = !isMotor
    motorRod.visible = isMotor
    motorTipA.visible = isMotor
    motorTipB.visible = isMotor

    const theta = isMotor ? model.motorAngle : model.swingAngle
    rodGroup.rotation.x = theta

    legLeft.capMat.color.set(model.magnetPolarity > 0 ? N_COLOR : S_COLOR)
    legRight.capMat.color.set(model.magnetPolarity > 0 ? S_COLOR : N_COLOR)

    const on = currentLevel(model) > 0
    const arrowLen = 0.18 + 0.22 * currentLevel(model)
    const axis = rodAxis(theta)

    if (isMotor) {
      const phase = commutatorPhase(model)
      const midA = PIVOT.clone().addScaledVector(axis, -ROTOR_HALF / 2)
      const midB = PIVOT.clone().addScaledVector(axis, ROTOR_HALF / 2)
      placeArrowSet(arrowsA, midA, axis, model.direction * phase, model.magnetPolarity, arrowLen)
      placeArrowSet(arrowsB, midB, axis, model.direction * phase * -1, model.magnetPolarity, arrowLen)
      setArrowSetVisible(arrowsA, showHelper && on)
      setArrowSetVisible(arrowsB, showHelper && on)
    } else {
      const mid = PIVOT.clone().addScaledVector(axis, -ROD_FULL / 2)
      placeArrowSet(arrowsA, mid, axis, model.direction, model.magnetPolarity, arrowLen)
      setArrowSetVisible(arrowsA, showHelper && on)
      setArrowSetVisible(arrowsB, false)
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
