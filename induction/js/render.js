// 캔버스 렌더링. 모델을 읽기만 하는 순수 그리기 함수들.
//
// ⚠️ 이 파일은 관찰 결과를 글자로 적지 않는다. 물체 이름과 조작 안내만 쓰고, "어느 쪽이 무슨
//    전기를 띠는지"는 전하 기호를 학생이 직접 보고 판단하게 둔다(2026-08-06 사용자 피드백).

import {
  ROD_PROTONS,
  rodElectrons,
  CHARGE_PAIRS,
  CAN_W,
  CAN_H,
  ROD_W,
  ROD_H,
  TRACK,
  SCOPE_PLATE_LEFT,
  shiftedElectrons,
  electronDrift,
  foilSpread,
  canLeft,
} from './model.js'

export const LOGICAL_WIDTH = 640
export const LOGICAL_HEIGHT = 340

const PLUS_COLOR = '#dc2626'
const MINUS_COLOR = '#2563eb'
const CHARGE_R = 7

/**
 * 캔 실험은 **위에서 내려다보는 시점**이다(2026-08-06 사용자 지시).
 * 옆에서 본 그림이면 캔이 굴러가는 것과 미끄러지는 것을 구별할 수 없고, 실제 교과서 실험도
 * 책상 위에 눕혀 놓은 캔을 위에서 보며 하는 활동이다.
 * 그래서 캔은 눕힌 원기둥을 위에서 본 모습 = **가로 폭이 지름(구르는 방향), 세로 길이가 캔의
 * 길이**인 직사각형으로 그리고, 표면 줄무늬가 굴러간 거리만큼 흘러가게 해서 회전을 보여준다.
 */
const TABLE_TOP = 96
const CAN_TOP = TABLE_TOP + 18

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

function drawPlus(ctx, x, y, r = CHARGE_R) {
  ctx.fillStyle = PLUS_COLOR
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = r * 0.3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - r * 0.5, y)
  ctx.lineTo(x + r * 0.5, y)
  ctx.moveTo(x, y - r * 0.5)
  ctx.lineTo(x, y + r * 0.5)
  ctx.stroke()
}

function drawMinus(ctx, x, y, r = CHARGE_R) {
  ctx.fillStyle = MINUS_COLOR
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = r * 0.3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - r * 0.5, y)
  ctx.lineTo(x + r * 0.5, y)
  ctx.stroke()
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

/** 위에서 본 책상과 좌우 막이 — 캔이 왜 여기까지만 굴러가는지가 그림으로 설명돼야 한다 */
function drawTable(ctx) {
  const top = TABLE_TOP
  const height = CAN_H + 36
  ctx.save()
  ctx.fillStyle = '#f5f5f4'
  ctx.fillRect(TRACK.left - 16, top, TRACK.right - TRACK.left + 32, height)
  ctx.strokeStyle = '#e7e5e4'
  ctx.lineWidth = 2
  ctx.strokeRect(TRACK.left - 16, top, TRACK.right - TRACK.left + 32, height)

  // 좌우 막이 — 캔이 실험대 밖으로 굴러 떨어지지 않게 막아 둔 것
  ctx.fillStyle = '#a8a29e'
  ctx.fillRect(TRACK.left - 16, top, 16, height)
  ctx.fillRect(TRACK.right, top, 16, height)
  ctx.restore()
}

// ── 대전체(막대) ──────────────────────────────────────────────────────

/**
 * 대전체 막대. tipX가 물체를 향한(오른쪽) 끝이다.
 *
 * 두 화면은 시점이 달라서 막대가 놓이는 방향도 다르다(2026-08-06 사용자 지시).
 *  - 캔 모드(위에서 본 시점): 막대를 책상에 **캔과 나란히** 눕혀 두고 옆으로 밀어 다가간다
 *    → 화면에서 **세로**. 실제 실험에서도 막대를 캔의 축과 나란히 대고 굴린다.
 *  - 검전기 모드(옆에서 본 시점): 막대를 손에 **가로로** 들고 금속판 높이로 가져간다
 *    → 화면에서 **가로**, 세로 위치는 금속판 한가운데.
 */
function drawRod(ctx, tipX, centerY, charge, electrons, orientation) {
  const color = charge > 0 ? PLUS_COLOR : MINUS_COLOR
  const horizontal = orientation === 'horizontal'
  const w = horizontal ? ROD_H : ROD_W
  const h = horizontal ? ROD_W : ROD_H
  const x = tipX - w
  const y = centerY - h / 2
  ctx.save()

  // 손잡이(대전되지 않은 부분) — "어디를 잡고 있는지"가 보이게 한다
  ctx.fillStyle = '#78716c'
  if (horizontal) roundedRect(ctx, x - 34, centerY - 7, 36, 14, 6)
  else roundedRect(ctx, x + w / 2 - 7, y - 34, 14, 36, 6)
  ctx.fill()

  const grad = horizontal
    ? ctx.createLinearGradient(0, y, 0, y + h)
    : ctx.createLinearGradient(x, 0, x + w, 0)
  grad.addColorStop(0, '#f8fafc')
  grad.addColorStop(1, '#e2e8f0')
  ctx.fillStyle = grad
  roundedRect(ctx, x, y, w, h, 10)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()

  // 막대도 **물체와 똑같은 방식**으로 그린다 — 양성자는 늘 ROD_PROTONS개 그대로,
  // 전자만 늘거나 줄어든다. 그래야 닿았을 때 양쪽 전자를 **세어 보면 합이 그대로**인 것이
  // 눈에 보인다. 예전에는 알짜 전하만 (+)(−)로 그려서, (+)막대가 전자를 받아 오는데도
  // 화면에는 (+) 개수가 줄어드는 것으로만 보여 전하 보존을 알기 어려웠다(2026-08-07 지적).
  //
  // 자리 잡기: 막대 **긴 쪽**으로 ROD_PROTONS칸, **짧은 쪽**으로 3줄(양성자 1줄 + 전자 2줄).
  const nE = electrons
  const LONG = ROD_PROTONS
  const spotAt = (lane, idx) => {
    const tLong = (idx + 0.5) / LONG
    const tCross = (lane + 0.5) / 3
    return horizontal
      ? { cx: x + tLong * w, cy: y + tCross * h }
      : { cx: x + tCross * w, cy: y + tLong * h }
  }
  for (let i = 0; i < ROD_PROTONS; i++) {
    const p = spotAt(0, i)
    drawPlus(ctx, p.cx, p.cy, 6)
  }
  for (let k = 0; k < nE; k++) {
    const p = spotAt(1 + Math.floor(k / LONG), k % LONG)
    drawMinus(ctx, p.cx, p.cy, 6)
  }
  ctx.restore()
}

// ── 모드 1: 금속 캔 ───────────────────────────────────────────────────

/**
 * 눕혀 놓은 캔을 **위에서 본** 모습. 가로 폭이 지름(구르는 방향), 세로가 캔 길이다.
 *
 * 굴러가는 것을 보이게 하는 게 이 그림의 핵심이다 — 표면 줄무늬를 굴러간 거리만큼 흘려서
 * "미끄러지는 게 아니라 구른다"가 보이게 한다. 줄무늬 간격은 굴렁쇠처럼 원둘레를 나눈 값이라,
 * 캔이 지름만큼 가면 줄무늬도 딱 그만큼 돈다.
 */
function drawCan(ctx, box, isConductor, rollDistance) {
  ctx.save()
  const { x, y, w, h } = box
  const edge = isConductor ? '#475569' : '#a16207'

  // 원기둥을 위에서 보면 가운데가 밝고 양옆(둥글게 말리는 쪽)이 어둡다
  const grad = ctx.createLinearGradient(x, 0, x + w, 0)
  if (isConductor) {
    grad.addColorStop(0, '#64748b')
    grad.addColorStop(0.18, '#cbd5e1')
    grad.addColorStop(0.42, '#f8fafc')
    grad.addColorStop(0.75, '#cbd5e1')
    grad.addColorStop(1, '#64748b')
  } else {
    grad.addColorStop(0, '#b45309')
    grad.addColorStop(0.18, '#fde68a')
    grad.addColorStop(0.42, '#fffbeb')
    grad.addColorStop(0.75, '#fde68a')
    grad.addColorStop(1, '#b45309')
  }

  ctx.fillStyle = grad
  roundedRect(ctx, x, y, w, h, 8)
  ctx.fill()

  // 표면 줄무늬 — 굴러간 거리만큼 흘러간다
  ctx.save()
  roundedRect(ctx, x, y, w, h, 8)
  ctx.clip()
  const circumference = Math.PI * w // 지름 w인 원의 둘레
  const stripeGap = circumference / 10
  const offset = ((rollDistance % stripeGap) + stripeGap) % stripeGap
  ctx.strokeStyle = isConductor ? 'rgba(71,85,105,0.30)' : 'rgba(161,98,7,0.30)'
  ctx.lineWidth = 2
  for (let sx = x - stripeGap + offset; sx < x + w; sx += stripeGap) {
    ctx.beginPath()
    ctx.moveTo(sx, y + 6)
    ctx.lineTo(sx, y + h - 6)
    ctx.stroke()
  }
  ctx.restore()

  // 양 끝(캔의 뚜껑·바닥) — 위에서 보면 테두리 띠로 보인다
  ctx.fillStyle = isConductor ? 'rgba(100,116,139,0.55)' : 'rgba(180,83,9,0.45)'
  ctx.fillRect(x, y, w, 9)
  ctx.fillRect(x, y + h - 9, w, 9)

  ctx.strokeStyle = edge
  ctx.lineWidth = 2.5
  roundedRect(ctx, x, y, w, h, 8)
  ctx.stroke()
  ctx.restore()
}

/**
 * 물체 안의 전하를 그린다.
 *
 * ⚠️ **움직이는 것은 언제나 전자(−)뿐이다.** 양성자(+)는 원자핵에 있어 절대 옮겨 다니지 않는다.
 *    예전에는 (+)막대에 닿아 대전되면 캔에 **(+) 기호를 더 그렸는데**, 그러면 "양전하가
 *    옮겨왔다"로 읽혀 정확히 반대되는 오개념을 심는다(2026-08-07 사용자 지적).
 *    그래서 이제 양성자 개수는 **언제나 CHARGE_PAIRS로 고정**하고, **전자 개수만 늘리거나
 *    줄인다**:
 *      · (−)막대에 닿음 → 전자가 넘어와 전자가 늘어난다     (알짜 −)
 *      · (+)막대에 닿음 → 전자가 빠져나가 전자가 줄어든다   (알짜 +, 짝 잃은 양성자가 남는다)
 *    짝을 잃고 홀로 남은 (+)가 보이는 것이 "왜 (+)를 띠는가"에 대한 올바른 그림이다.
 */
function drawCanCharges(ctx, box, model, showCharges) {
  if (!showCharges) return

  // 전자 수 = 원래 개수 − 알짜 전하. (알짜 +3이면 전자가 3개 빠져나간 것)
  const nElectrons = Math.max(0, CHARGE_PAIRS - model.contactCharge)
  const shifted = Math.min(shiftedElectrons(model), nElectrons)
  const drift = electronDrift(model) // +1이면 먼(오른) 쪽, −1이면 가까운(왼) 쪽
  const rows = 2
  const cols = Math.ceil(CHARGE_PAIRS / rows)
  const padX = 22
  const cellW = (box.w - padX * 2) / cols
  const cellH = (box.h - 40) / (rows + 1)

  const homeSpot = (i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    return { x: box.x + padX + cellW * (c + 0.5), y: box.y + 26 + cellH * (r + 1) }
  }

  // 양성자는 개수도 자리도 변하지 않는다
  for (let i = 0; i < CHARGE_PAIRS; i++) {
    const h = homeSpot(i)
    drawPlus(ctx, h.x, h.y - 10)
  }

  // 유도로 몰려간 전자가 놓일 자리 — 겹쳐 쌓이면 몇 개인지 셀 수가 없으므로, 몰린 쪽
  // 가장자리에 개수에 맞춰 위아래로 고르게 편다.
  const pileX = drift > 0 ? box.x + box.w - 20 : box.x + 20
  const pileTop = box.y + 24
  const pileSpan = box.h - 48
  const pileSpots = Array.from({ length: shifted }, (_, k) =>
    shifted === 1 ? pileTop + pileSpan / 2 : pileTop + (pileSpan * k) / (shifted - 1),
  )

  for (let k = 0; k < nElectrons; k++) {
    if (k < shifted) {
      drawMinus(ctx, pileX, pileSpots[k])
      continue
    }
    const rest = k - shifted
    if (rest < CHARGE_PAIRS) {
      const h = homeSpot(rest)
      drawMinus(ctx, h.x, h.y + 10) // 아직 안 움직인 전자
    } else {
      // 접촉으로 넘어와 원래 자리보다 많아진 전자 — 아래쪽에 따로 늘어놓는다
      const extra = rest - CHARGE_PAIRS
      drawMinus(ctx, box.x + box.w / 2 + (extra - 1) * 22, box.y + box.h - 26)
    }
  }
}

export function canBox(model) {
  return { x: canLeft(model), y: CAN_TOP, w: CAN_W, h: CAN_H }
}

export function drawCanMode(ctx, cssWidth, cssHeight, model, state) {
  begin(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('대전체를 끌어서 물체에 가까이 가져가 보세요', LOGICAL_WIDTH / 2, 14)
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('(위에서 내려다본 모습)', LOGICAL_WIDTH / 2, 34)

  drawTable(ctx)

  const box = canBox(model)
  drawCan(ctx, box, true, model.can.x)

  ctx.save()
  ctx.fillStyle = '#475569'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('금속 캔', box.x + box.w / 2, CAN_TOP + CAN_H + 24)
  ctx.restore()

  drawCanCharges(ctx, box, model, state.showCharges)
  drawRod(ctx, model.rodTipX, CAN_TOP + CAN_H / 2, model.rodCharge, rodElectrons(model), 'vertical')

  ctx.restore()
}

// ── 모드 2: 검전기 ────────────────────────────────────────────────────
//
// 예전에는 검전기가 작고, 유도로 **치우친 전하만** 그려서 중성 상태가 텅 비어 보였다.
// 그러면 "원래 +와 −가 같은 수로 골고루 있다가 자리만 바뀐다"는 핵심이 안 보인다.
// 이제 검전기를 화면 대부분을 쓰도록 키우고, 금속판·기둥·금속박 세 구역에 전하 쌍을
// 처음부터 골고루 깔아둔 뒤 전자만 옮겨 다니게 그린다(2026-08-06 피드백, JavaLab 검전기 참고).

const SCOPE_X = SCOPE_PLATE_LEFT + 75 // 금속판 중심
const SCOPE_PLATE_W = 150
const SCOPE_PLATE_Y = 66
const SCOPE_PLATE_H = 20
const SCOPE_STEM_TOP = SCOPE_PLATE_Y + SCOPE_PLATE_H
const SCOPE_STEM_LEN = 96
const SCOPE_FOIL_TOP = SCOPE_STEM_TOP + SCOPE_STEM_LEN
const SCOPE_FOIL_LEN = 92

/** 전하를 놓을 세 구역. index 0이 대전체와 가장 가까운 쪽(금속판)이다. */
function scopeZones(spread) {
  const angle = (8 + spread * 40) * (Math.PI / 180)
  return {
    plate: { x: SCOPE_X, y: SCOPE_PLATE_Y + SCOPE_PLATE_H / 2 },
    stem: { x: SCOPE_X, y: SCOPE_STEM_TOP + SCOPE_STEM_LEN / 2 },
    foil: { x: SCOPE_X, y: SCOPE_FOIL_TOP, angle },
  }
}

/** 금속박 위의 점 — t는 0(뿌리)~1(끝), dir는 좌우 */
function foilPoint(angle, t, dir) {
  return {
    x: SCOPE_X + Math.sin(angle) * SCOPE_FOIL_LEN * t * dir,
    y: SCOPE_FOIL_TOP + Math.cos(angle) * SCOPE_FOIL_LEN * t,
  }
}

function drawScopeCharges(ctx, model, showCharges, spread) {
  if (!showCharges) return
  const zones = scopeZones(spread)
  const shifted = shiftedElectrons(model)
  const drift = electronDrift(model) // +1: 금속박(먼 쪽)으로, −1: 금속판(가까운 쪽)으로

  // 전하 쌍을 세 구역에 나눠 깔아둔다. 중성 상태에서 +와 −가 **같은 수로 골고루** 있는 것이
  // 보여야 하므로, 전자도 처음에는 자기 양성자 바로 옆에 그린다.
  // 검전기는 금속 한 덩어리라, 중성일 때 전하가 **금속판·기둥·금속박에 고루** 퍼져 있어야
  // 한다. 예전에는 자리를 "앞의 둘은 금속판, 그다음 둘은 기둥, 나머지는 금속박"으로 나눠
  // 놓았는데, 전하 개수를 4개로 줄이면서 금속박 차례가 아예 오지 않아 전부 위쪽에만 뭉쳐
  // 보였다(2026-08-07 사용자 지적). 이제 네 구역을 **번갈아** 돌며 놓는다.
  const homes = []
  for (let i = 0; i < CHARGE_PAIRS; i++) {
    const zone = i % 4
    const rep = Math.floor(i / 4)
    if (zone === 0) {
      homes.push({ x: zones.plate.x + (rep - 0.5) * 46, y: zones.plate.y })
    } else if (zone === 1) {
      homes.push({ x: zones.stem.x, y: zones.stem.y + (rep - 0.5) * 30 })
    } else {
      // 금속박이 닫혀 있으면 두 장이 거의 겹치므로 좌우로 최소 간격을 보장한다.
      const dir = zone === 2 ? -1 : 1
      const t = 0.45 + rep * 0.24
      const p = foilPoint(zones.foil.angle, t, dir)
      homes.push({ x: SCOPE_X + dir * Math.max(26, Math.abs(p.x - SCOPE_X)), y: p.y })
    }
  }

  /**
   * 금속박으로 몰려간 전자가 놓일 자리를 **끝에서부터** 하나씩 내준다.
   * 전하는 뾰족한 끝에 몰리므로 금속박 **끝까지** 가야 직관적이다 — 예전에는 가장 먼 자리가
   * 0.7밖에 안 돼 "가운데까지만 온다"처럼 보였다(2026-08-07 사용자 지적).
   * 좌우 잎에 번갈아 붙여 두 잎이 같은 만큼 무거워 보이게 한다.
   */
  let foilUsed = 0
  const nextFoilSpot = () => {
    const k = foilUsed++
    const dir = k % 2 === 0 ? -1 : 1
    const t = Math.max(0.32, 0.95 - Math.floor(k / 2) * 0.22)
    return foilPoint(zones.foil.angle, t, dir)
  }
  /** 금속판 쪽으로 끌려온 전자가 놓일 자리 — 판 위에 가로로 늘어놓는다. */
  const nearSpots = Array.from({ length: CHARGE_PAIRS }, (_, k) => ({
    x: zones.plate.x + (k - (CHARGE_PAIRS - 1) / 2) * 23,
    y: zones.plate.y,
  }))

  // 양성자(원자핵)는 개수도 자리도 변하지 않는다
  for (let i = 0; i < CHARGE_PAIRS; i++) {
    drawPlus(ctx, homes[i].x - 9, homes[i].y)
  }

  // ⚠️ 캔과 같은 원칙 — **움직이는 것은 전자뿐이다.** 대전된 검전기를 (+) 기호를 더 그려서
  //    나타내면 "양전하가 옮겨왔다"는 오개념이 된다(2026-08-07 사용자 지적).
  //    전자 개수만 늘리거나 줄이고, 짝을 잃은 양성자가 남는 것으로 (+)를 나타낸다.
  const nElectrons = Math.max(0, CHARGE_PAIRS - model.preCharge)
  const nShifted = Math.min(shifted, nElectrons)

  // 금속박으로 가는 전자(유도로 밀려난 것 + 접촉으로 넘어온 것)는 **한 곳에서 자리를 받아**
  // 끝에서부터 차곡차곡 쌓인다. 따로따로 자리를 잡으면 서로 겹치거나 한쪽 잎에만 몰린다.
  for (let k = 0; k < nElectrons; k++) {
    if (k < nShifted) {
      // 유도로 옮겨간 전자 — (−)막대면 금속박 끝으로, (+)막대면 금속판으로
      const spot = drift > 0 ? nextFoilSpot() : nearSpots[k]
      drawMinus(ctx, spot.x, spot.y)
      continue
    }
    const rest = k - nShifted
    if (rest < CHARGE_PAIRS) {
      drawMinus(ctx, homes[rest].x + 9, homes[rest].y) // 아직 제자리에 있는 전자
    } else {
      const p = nextFoilSpot() // 접촉으로 넘어와 원래보다 많아진 전자
      drawMinus(ctx, p.x, p.y)
    }
  }
}

export function drawScopeMode(ctx, cssWidth, cssHeight, model, state) {
  begin(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('대전체를 끌어서 검전기 금속판에 가까이 가져가 보세요', LOGICAL_WIDTH / 2, 14)

  const spread = foilSpread(model)
  const angle = (8 + spread * 40) * (Math.PI / 180)

  ctx.save()

  // 유리병 — 금속박이 바람에 흔들리지 않게 감싸는 부분. 반투명으로 안이 비쳐 보이게.
  const jarX = SCOPE_X - 105
  const jarY = SCOPE_STEM_TOP + 34
  const jarW = 210
  const jarH = 190
  ctx.fillStyle = 'rgba(186, 230, 253, 0.20)'
  roundedRect(ctx, jarX, jarY, jarW, jarH, 14)
  ctx.fill()
  ctx.strokeStyle = '#7dd3fc'
  ctx.lineWidth = 2.5
  ctx.stroke()
  // 병 목(마개)
  ctx.fillStyle = '#d6d3d1'
  roundedRect(ctx, SCOPE_X - 40, jarY - 16, 80, 20, 5)
  ctx.fill()
  ctx.strokeStyle = '#a8a29e'
  ctx.lineWidth = 2
  ctx.stroke()

  // 금속 기둥
  ctx.fillStyle = '#cbd5e1'
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2
  ctx.fillRect(SCOPE_X - 6, SCOPE_STEM_TOP, 12, SCOPE_STEM_LEN)
  ctx.strokeRect(SCOPE_X - 6, SCOPE_STEM_TOP, 12, SCOPE_STEM_LEN)

  // 금속판 — 대전체가 다가오는 면
  const plateGrad = ctx.createLinearGradient(0, SCOPE_PLATE_Y, 0, SCOPE_PLATE_Y + SCOPE_PLATE_H)
  plateGrad.addColorStop(0, '#f1f5f9')
  plateGrad.addColorStop(1, '#cbd5e1')
  ctx.fillStyle = plateGrad
  roundedRect(ctx, SCOPE_X - SCOPE_PLATE_W / 2, SCOPE_PLATE_Y, SCOPE_PLATE_W, SCOPE_PLATE_H, 7)
  ctx.fill()
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // 금속박 두 장 — 벌어진 각도가 이 화면의 결과값이다
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  for (const dir of [-1, 1]) {
    const end = foilPoint(angle, 1, dir)
    ctx.beginPath()
    ctx.moveTo(SCOPE_X, SCOPE_FOIL_TOP)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }
  ctx.restore()

  drawScopeCharges(ctx, model, state.showCharges, spread)
  drawRod(ctx, model.rodTipX, SCOPE_PLATE_Y + SCOPE_PLATE_H / 2, model.rodCharge, rodElectrons(model), 'horizontal')

  ctx.restore()
}
