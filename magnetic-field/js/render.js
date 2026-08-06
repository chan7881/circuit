// 캔버스 렌더링. 모델을 읽기만 하는 순수 그리기 함수들.
//
// ⚠️ 이 파일은 관찰 결과를 글자로 적지 않는다 — 안내 문구·부품 이름까지만 쓴다. 특히 코일의
//    양 끝에 N/S를 표시하지 않는다: 그걸 학생이 나침반으로 직접 알아내는 것이 이 시뮬레이터의
//    핵심이라, 답을 먼저 보여주면 탐구가 사라진다(2026-08-06 사용자 피드백과 같은 원칙).

import { coilFieldAt, wireFieldAt, needleAngle, currentLevel } from './model.js'

export const LOGICAL_WIDTH = 680
export const LOGICAL_HEIGHT = 380

const CENTER = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 + 14 }
const WIRE_COLOR = '#334155'
const CURRENT_COLOR = '#f59e0b'
const NEEDLE_N_COLOR = '#dc2626'
const NEEDLE_S_COLOR = '#1d4ed8'

export function computeLayout(cssWidth, cssHeight) {
  const scale = Math.min(cssWidth / LOGICAL_WIDTH, cssHeight / LOGICAL_HEIGHT)
  return {
    scale,
    offsetX: (cssWidth - LOGICAL_WIDTH * scale) / 2,
    offsetY: (cssHeight - LOGICAL_HEIGHT * scale) / 2,
  }
}

export function screenToLogical(layout, x, y) {
  return { x: (x - layout.offsetX) / layout.scale, y: (y - layout.offsetY) / layout.scale }
}

function begin(ctx, cssWidth, cssHeight) {
  const layout = computeLayout(cssWidth, cssHeight)
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  ctx.save()
  ctx.translate(layout.offsetX, layout.offsetY)
  ctx.scale(layout.scale, layout.scale)
  return layout
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ── 코일 ──────────────────────────────────────────────────────────────

const COIL_HALF_LEN = 62
const COIL_RADIUS = 26
const COIL_LOOPS = 5

function drawCoil(ctx, model) {
  const { x: cx, y: cy } = CENTER
  ctx.save()

  // 심지(코어) — 도선이 감긴 속을 짐작하게 하는 얇은 막대
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(cx - COIL_HALF_LEN, cy)
  ctx.lineTo(cx + COIL_HALF_LEN, cy)
  ctx.stroke()

  // 고리들 — 옆에서 본 원기둥 코일은 세로 타원(고리)이 여러 개 늘어선 모습이다
  const gap = (COIL_HALF_LEN * 2) / (COIL_LOOPS - 1)
  for (let i = 0; i < COIL_LOOPS; i++) {
    const lx = cx - COIL_HALF_LEN + gap * i
    ctx.beginPath()
    ctx.ellipse(lx, cy, 9, COIL_RADIUS, 0, 0, Math.PI * 2)
    ctx.strokeStyle = '#92400e'
    ctx.lineWidth = 4
    ctx.stroke()

    // 전류 방향 화살표 — 고리 앞면 위쪽에 짧은 화살촉으로 표시한다.
    // direction이 이 코일의 실제 전류 방향이므로(학생이 직접 정하는 값), 여기엔 결과가 아니라
    // 조건을 그대로 보여주는 것뿐이라 답을 알려주는 게 아니다.
    if (currentLevel(model) > 0) {
      const dir = model.direction
      const ax = lx
      const ay = cy - COIL_RADIUS
      ctx.strokeStyle = CURRENT_COLOR
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ax - 7 * dir, ay)
      ctx.lineTo(ax + 7 * dir, ay)
      ctx.moveTo(ax + 7 * dir, ay)
      ctx.lineTo(ax + 2 * dir, ay - 4)
      ctx.moveTo(ax + 7 * dir, ay)
      ctx.lineTo(ax + 2 * dir, ay + 4)
      ctx.stroke()
    }
  }
  ctx.restore()
}

// ── 직선 도선 ─────────────────────────────────────────────────────────
//
// 도선이 화면을 뚫고 지나간다고 본다 — 단면을 원으로 그리고, 전류가 화면 쪽으로 나오면
// 점(과녁 표시), 화면 안쪽으로 들어가면 가위표(×)로 그리는 물리 교과서 관례를 따른다.

function drawWireCrossSection(ctx, model) {
  const { x: cx, y: cy } = CENTER
  const r = 15
  ctx.save()
  ctx.fillStyle = '#e2e8f0'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = WIRE_COLOR
  ctx.lineWidth = 3
  ctx.stroke()

  if (currentLevel(model) > 0) {
    ctx.strokeStyle = CURRENT_COLOR
    ctx.fillStyle = CURRENT_COLOR
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    if (model.direction > 0) {
      // 화면 밖으로 나오는 전류 — 점
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // 화면 안으로 들어가는 전류 — ×
      ctx.beginPath()
      ctx.moveTo(cx - 6, cy - 6)
      ctx.lineTo(cx + 6, cy + 6)
      ctx.moveTo(cx + 6, cy - 6)
      ctx.lineTo(cx - 6, cy + 6)
      ctx.stroke()
    }
  }
  ctx.restore()
}

// ── 자기력선 ──────────────────────────────────────────────────────────

/** 코일(쌍극자) 자기력선 하나를 시작점에서 field 방향을 따라가며 추적한다 */
function traceCoilFieldLine(model, start, maxSteps = 240, stepSize = 4) {
  const pts = [start]
  let p = start
  for (let i = 0; i < maxSteps; i++) {
    const f = coilFieldAt(model, p)
    const mag = Math.hypot(f.x, f.y)
    if (mag < 1e-6) break
    p = { x: p.x + (f.x / mag) * stepSize, y: p.y + (f.y / mag) * stepSize }
    pts.push(p)
    // 반대쪽 극 가까이 왔거나 화면 밖으로 나가면 멈춘다
    if (Math.hypot(p.x, p.y) > 320) break
  }
  return pts
}

function drawCoilFieldLines(ctx, model) {
  if (currentLevel(model) <= 0) return
  const { x: cx, y: cy } = CENTER
  // 전류 방향이 +1이면 북극(자기력선이 나가는 쪽)이 +x 끝이다
  const northX = model.direction > 0 ? COIL_HALF_LEN + 6 : -(COIL_HALF_LEN + 6)
  const angles = [18, 42, 68, 100, 132, 158]
  ctx.save()
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)'
  ctx.lineWidth = 1.6
  for (const deg of angles) {
    const rad = (deg * Math.PI) / 180
    const start = { x: northX + Math.cos(rad) * 6 * Math.sign(northX || 1), y: Math.sin(rad) * 6 }
    const pts = traceCoilFieldLine(model, start)
    ctx.beginPath()
    ctx.moveTo(cx + pts[0].x, cy + pts[0].y)
    for (const pt of pts.slice(1)) ctx.lineTo(cx + pt.x, cy + pt.y)
    ctx.stroke()
    // 대칭인 아래쪽 절반도 같이 그린다
    ctx.beginPath()
    ctx.moveTo(cx + pts[0].x, cy - pts[0].y)
    for (const pt of pts.slice(1)) ctx.lineTo(cx + pt.x, cy - pt.y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawWireFieldLines(ctx, model) {
  if (currentLevel(model) <= 0) return
  const { x: cx, y: cy } = CENTER
  ctx.save()
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)'
  ctx.lineWidth = 1.6
  for (const r of [40, 70, 100, 130, 160]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    // 회전 방향을 알려주는 작은 화살촉 하나(오른쪽 지점에)
    const dir = model.direction
    const ax = cx + r
    const ay = cy
    const tangentUp = dir > 0 ? -1 : 1
    ctx.beginPath()
    ctx.moveTo(ax, ay + tangentUp * 7)
    ctx.lineTo(ax - 4, ay + tangentUp * 1)
    ctx.moveTo(ax, ay + tangentUp * 7)
    ctx.lineTo(ax + 4, ay + tangentUp * 1)
    ctx.stroke()
  }
  ctx.restore()
}

// ── 나침반 ────────────────────────────────────────────────────────────

function drawCompass(ctx, screenX, screenY, angle) {
  const r = 17
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(screenX, screenY, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.translate(screenX, screenY)
  ctx.rotate(angle)
  // 바늘 — 앞쪽 절반(N을 찾는 쪽, 빨강)과 뒤쪽 절반(파랑)
  ctx.fillStyle = NEEDLE_N_COLOR
  ctx.beginPath()
  ctx.moveTo(r - 2, 0)
  ctx.lineTo(0, -3.2)
  ctx.lineTo(0, 3.2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = NEEDLE_S_COLOR
  ctx.beginPath()
  ctx.moveTo(-(r - 2), 0)
  ctx.lineTo(0, -3.2)
  ctx.lineTo(0, 3.2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#475569'
  ctx.beginPath()
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── 전체 그리기 ───────────────────────────────────────────────────────

/**
 * @param needleAngles - 위치마다 실제로 그릴 각도(라디안) 배열. 물리적으로 옳은 목표 각도를
 *   그대로 쓰지 않는 이유: main.js가 여기로 넘기기 전에 이전 각도에서 서서히 회전시켜(보간)
 *   "바늘이 실제로 도는" 움직임을 만든다. render.js는 그 결과만 그린다(순수 함수 원칙 유지).
 */
export function draw(ctx, cssWidth, cssHeight, model, positions, needleAngles, state) {
  begin(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('전류 방향과 세기를 바꾸며 나침반의 반응을 살펴보세요', LOGICAL_WIDTH / 2, 12)
  if (model.mode === 'wire') {
    // 이건 결론이 아니라 그림을 읽는 방법(도선이 화면을 뚫고 지나간다는 관례) 안내라 괜찮다.
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('(도선이 화면과 수직으로 지나갑니다 · ● 나옴 / × 들어감)', LOGICAL_WIDTH / 2, 32)
  }

  if (state.showFieldLines) {
    if (model.mode === 'wire') drawWireFieldLines(ctx, model)
    else drawCoilFieldLines(ctx, model)
  }

  if (model.mode === 'wire') drawWireCrossSection(ctx, model)
  else drawCoil(ctx, model)

  positions.forEach((p, i) => {
    drawCompass(ctx, CENTER.x + p.x, CENTER.y + p.y, needleAngles[i])
  })

  ctx.restore()
}

export { CENTER }
