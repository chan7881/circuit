// 캔버스 렌더링. state를 읽기만 하고 아무것도 바꾸지 않는 순수 그리기 함수들이다 — 입력 처리는
// input.js, 상태 변경은 main.js가 맡는다.

import {
  GRID_COLS,
  GRID_ROWS,
  CELL_UNIT,
  LOGICAL_MARGIN,
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  NODE_RADIUS,
  STACK_OFFSET,
  COMPONENT_COLOR,
  ZERO_CURRENT_EPS,
  bulbResistance,
  bulbRatedPower,
  BULB_OVERPOWER_RATIO,
  FLOW_MODE_CURRENT,
  FLOW_MODE_ELECTRON,
  FLOW_PARTICLE_SPACING,
  flowSpeed,
  CURRENT_FLOW_COLOR,
  ELECTRON_FLOW_COLOR,
} from './config.js'
import { EDGE_LIST, canPlace } from './model.js'

export function computeLayout(cssWidth, cssHeight) {
  const scale = Math.min(cssWidth / LOGICAL_WIDTH, cssHeight / LOGICAL_HEIGHT)
  const offsetX = (cssWidth - LOGICAL_WIDTH * scale) / 2
  const offsetY = (cssHeight - LOGICAL_HEIGHT * scale) / 2
  return { scale, offsetX, offsetY }
}

export function nodePoint(r, c) {
  return { x: LOGICAL_MARGIN + c * CELL_UNIT, y: LOGICAL_MARGIN + r * CELL_UNIT }
}

export function logicalToScreen(layout, x, y) {
  return { x: layout.offsetX + x * layout.scale, y: layout.offsetY + y * layout.scale }
}

export function screenToLogical(layout, x, y) {
  return { x: (x - layout.offsetX) / layout.scale, y: (y - layout.offsetY) / layout.scale }
}

function perpUnit(p1, p2) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  return { x: -dy / len, y: dx / len }
}

/**
 * 간선의 두 노드와 슬롯 인덱스·전체 슬롯 수를 받아, 그 슬롯의 전체 그리기 경로를 낸다.
 * 슬롯이 1개뿐이면 노드 사이를 그대로 잇는다. 2개(병렬)면 각 슬롯을 수직으로 띄워 옆으로
 * 나란히 보이게 하되, 노드에서 살짝 벌어졌다가 다시 모이는 짧은 연결선(스텁)을 양 끝에
 * 붙여서 "노드에 실제로 연결된 병렬 가지"로 보이게 한다 — 스텁 없이 몸통만 옆으로 옮기면
 * 노드 점과 부품 사이에 빈틈이 생겨 회로가 끊긴 것처럼 보인다.
 */
function edgeItemPath(p1, p2, slotIndex, slotCount) {
  if (slotCount <= 1) return { full: [p1, p2], bodyStart: p1, bodyEnd: p2, hasStubs: false }
  const perp = perpUnit(p1, p2)
  const sign = slotIndex === 0 ? -1 : 1
  const off = (STACK_OFFSET / 2) * sign
  const a = { x: p1.x + perp.x * off, y: p1.y + perp.y * off }
  const b = { x: p2.x + perp.x * off, y: p2.y + perp.y * off }
  return { full: [p1, a, b, p2], bodyStart: a, bodyEnd: b, hasStubs: true }
}

function drawStub(ctx, from, to) {
  ctx.save()
  ctx.strokeStyle = COMPONENT_COLOR.wire
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.restore()
}

export function draw(ctx, cssWidth, cssHeight, model, state) {
  const layout = computeLayout(cssWidth, cssHeight)
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  ctx.save()
  ctx.translate(layout.offsetX, layout.offsetY)
  ctx.scale(layout.scale, layout.scale)

  drawNodeDots(ctx)

  for (const edge of EDGE_LIST) {
    const items = model.items.get(edge.key) ?? []
    const p1 = nodePoint(edge.r, edge.c)
    const p2 = edge.orientation === 'h' ? nodePoint(edge.r, edge.c + 1) : nodePoint(edge.r + 1, edge.c)

    const placeable = state.placingType ? canPlace(model, edge.key, state.placingType) : false
    if (placeable) drawPlaceableHighlight(ctx, p1, p2)

    if (items.length === 0) {
      drawEmptyGuide(ctx, p1, p2)
      continue
    }

    items.forEach((item, idx) => {
      const path = edgeItemPath(p1, p2, idx, items.length)
      if (path.hasStubs) {
        const [nodeA, a, b, nodeB] = path.full
        drawStub(ctx, nodeA, a)
        drawStub(ctx, b, nodeB)
      }
      const current = state.current?.get(item.uid) ?? 0
      const selected = state.selectedUid === item.uid
      const flowVisible = state.flowVisible !== false
      const flowMode = state.flowMode === FLOW_MODE_ELECTRON ? FLOW_MODE_ELECTRON : FLOW_MODE_CURRENT
      drawComponent(ctx, item, path.bodyStart, path.bodyEnd, current, selected, state.flowPhase ?? 0, path.full, {
        visible: flowVisible,
        mode: flowMode,
      })
    })
  }

  ctx.restore()
}

function drawNodeDots(ctx) {
  ctx.fillStyle = '#cbd5e1'
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const { x, y } = nodePoint(r, c)
      ctx.beginPath()
      ctx.arc(x, y, NODE_RADIUS * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawEmptyGuide(ctx, p1, p2) {
  ctx.save()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 3
  ctx.setLineDash([2, 10])
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()
  ctx.restore()
}

function drawPlaceableHighlight(ctx, p1, p2) {
  ctx.save()
  ctx.strokeStyle = '#93c5fd'
  ctx.lineWidth = 22
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.45
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()
  ctx.restore()
}

function strokePolyline(ctx, points) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
}

const SWITCH_GAP_RATIO = 0.22
const BULB_RADIUS = 16
const METER_RADIUS = 15
// 전지 기호의 두 극판(짧고 굵은 −극, 길고 얇은 +극) 사이의 축 방향 간격 — 실제 전지 기호처럼
// 두 극판 사이에는 도선을 그리지 않아 "여기가 전지(화학전지)"라는 걸 보여준다.
const BATTERY_PLATE_GAP = 5

function resistorBodyLen(len) {
  return Math.min(48, len * 0.6)
}

/** 리드선(도선)이 어디서 멈추고 부품 기호가 어디서 시작하는지, 중심에서 잰 절반 길이.
 *  실제 회로도처럼 기호가 있는 구간에는 리드선을 겹쳐 그리지 않는다 — 겹쳐 그리면
 *  저항 지그재그가 직선에 묻히고, 스위치는 열림/닫힘 상태의 "끊김"이 안 보이게 된다. */
function symbolHalfExtent(item, len) {
  switch (item.type) {
    case 'battery':
      return BATTERY_PLATE_GAP
    case 'resistor':
      return resistorBodyLen(len) / 2
    case 'bulb':
      return BULB_RADIUS
    case 'switch':
      return len * SWITCH_GAP_RATIO
    case 'ammeter':
    case 'voltmeter':
      return METER_RADIUS
    default:
      return 0 // 도선: 기호가 없으니 리드선이 끝까지 이어진다
  }
}

function drawComponent(ctx, item, p1, p2, current, selected, flowPhase, fullPath, flowSettings) {
  const color = COMPONENT_COLOR[item.type] ?? '#334155'
  const path = fullPath ?? [p1, p2]
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1
  const half = symbolHalfExtent(item, len)
  ctx.save()

  // 선택 표시·전류 흐름 애니메이션은 노드-노드 전체 경로(병렬 연결 시 스텁 포함)를 따라
  // 그려서, 부품이 실제로 양쪽 노드에 연결되어 있다는 게 시각적으로 이어져 보이게 한다.
  if (selected) {
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.5
    strokePolyline(ctx, path)
    ctx.globalAlpha = 1
  }

  // 리드선은 노드에서 기호 경계까지만 긋는다(기호가 있는 가운데 구간은 비워 둔다 — 그 안은
  // 각 기호 자신의 그리기 함수가 책임진다).
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  const leadStart = mid(p1, p2, 0.5 - half / len)
  const leadEnd = mid(p1, p2, 0.5 + half / len)
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(leadStart.x, leadStart.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(leadEnd.x, leadEnd.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()

  switch (item.type) {
    case 'wire':
      break // 리드선 자체가 도선의 전부
    case 'battery':
      drawBattery(ctx, item, p1, p2, color)
      break
    case 'resistor':
      drawResistor(ctx, p1, p2, color, `${item.value}Ω`)
      break
    case 'bulb':
      drawBulb(ctx, item, p1, p2, color, current)
      break
    case 'switch':
      drawSwitch(ctx, p1, p2, color, item.closed)
      break
    case 'ammeter':
      drawMeter(ctx, p1, p2, color, 'A', current, 'A')
      break
    case 'voltmeter':
      drawMeter(ctx, p1, p2, color, 'V', current * 1_000_000, 'V')
      break
  }

  // ⚠️ 흐름 표시는 기호 **위에** 그려진다. 기호 구간까지 입자를 찍으면 전구의 지름선이나
  //    전지 극판이 입자에 가려 끊겨 보인다(2026-08-26에 전구에서 발견). 리드선을 기호
  //    경계에서 끊는 것과 같은 이유로, 입자도 기호 구간에서는 건너뛴다.
  if (flowSettings.visible && Math.abs(current) > ZERO_CURRENT_EPS) {
    drawFlowParticles(ctx, path, current, flowPhase, flowSettings.mode, half + 3)
  }

  ctx.restore()
}

function mid(p1, p2, t = 0.5) {
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t }
}

function drawBattery(ctx, item, p1, p2, color) {
  const perp = perpUnit(p1, p2)
  const c = mid(p1, p2)
  const dx = (p2.x - p1.x) / Math.hypot(p2.x - p1.x, p2.y - p1.y || 1)
  const dy = (p2.y - p1.y) / Math.hypot(p2.x - p1.x, p2.y - p1.y || 1)
  const gap = BATTERY_PLATE_GAP
  // flipped=false → p2(v) 쪽이 +(긴 막대), flipped=true → p1(u) 쪽이 +
  const plusAtP2 = !item.flipped
  const longSide = plusAtP2 ? 1 : -1 // +1: p2 방향에 긴 막대
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 4
  // 짧고 굵은 막대(−)
  const shortLen = 14
  const shortCenter = { x: c.x - dx * gap * -longSide, y: c.y - dy * gap * -longSide }
  ctx.beginPath()
  ctx.moveTo(shortCenter.x - perp.x * shortLen, shortCenter.y - perp.y * shortLen)
  ctx.lineTo(shortCenter.x + perp.x * shortLen, shortCenter.y + perp.y * shortLen)
  ctx.lineWidth = 7
  ctx.stroke()
  // 길고 얇은 막대(+)
  const longLen = 22
  const longCenter = { x: c.x + dx * gap * -longSide, y: c.y + dy * gap * -longSide }
  ctx.beginPath()
  ctx.moveTo(longCenter.x - perp.x * longLen, longCenter.y - perp.y * longLen)
  ctx.lineTo(longCenter.x + perp.x * longLen, longCenter.y + perp.y * longLen)
  ctx.lineWidth = 3
  ctx.stroke()

  drawLabel(ctx, `${item.value}V`, c, perp, 30)
}

function drawResistor(ctx, p1, p2, color, label) {
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const ux = (p2.x - p1.x) / len
  const uy = (p2.y - p1.y) / len
  const perp = perpUnit(p1, p2)
  const bodyLen = resistorBodyLen(len)
  const start = mid(p1, p2, 0.5 - bodyLen / 2 / len)
  const amp = 10
  // 지그재그는 축 위(0)에서 시작해 위·아래로 세 번 흔들리다 다시 축 위(0)에서 끝난다 —
  // 양옆 리드선과 어긋남 없이 이어지려면 시작·끝 점이 반드시 축 위에 있어야 한다.
  const offsets = [0, 1, -1, 1, -1, 1, -1, 0]
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.beginPath()
  offsets.forEach((side, i) => {
    const t = i / (offsets.length - 1)
    const along = { x: start.x + ux * bodyLen * t, y: start.y + uy * bodyLen * t }
    const x = along.x + perp.x * amp * side
    const y = along.y + perp.y * amp * side
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  drawLabel(ctx, label, mid(p1, p2), perp, 26)
}

function drawBulb(ctx, item, p1, p2, color, current) {
  const c = mid(p1, p2)
  const ratedV = item.value
  const power = current * current * bulbResistance(ratedV)
  const ratio = power / bulbRatedPower(ratedV)          // 정격 대비 몇 배인가
  const brightness = Math.max(0, Math.min(1, ratio))
  const over = ratio > 1                                 // 과전류
  const danger = ratio > BULB_OVERPOWER_RATIO            // 끊어질 만큼
  // 정격을 넘겨도 «더 밝아진다»고 그리지 않는다 — 그건 밝기가 아니라 위험이다.
  // 다만 얼마나 넘었는지는 빛 번짐 크기로 계속 보이게 해서
  // «정격 위로는 화면이 아무 변화가 없다»가 되지 않게 한다.
  const overShoot = Math.max(0, Math.min(2, ratio - 1))
  const r = BULB_RADIUS
  if (brightness > 0.02) {
    const glowR = r + 18 * brightness + 16 * overShoot
    const grad = ctx.createRadialGradient(c.x, c.y, r * 0.4, c.x, c.y, glowR)
    grad.addColorStop(0, `rgba(250, 204, 21, ${0.55 * brightness + 0.15})`)
    grad.addColorStop(1, 'rgba(250, 204, 21, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(c.x, c.y, glowR, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = brightness > 0.02 ? `rgba(254, 240, 138, ${0.4 + 0.6 * brightness})` : '#f8fafc'
  // ⚠️ 과전류는 색 하나로만 알리지 않는다 — 색 + 굵기 + 글자 세 겹으로 알린다
  //    (빔프로젝터·색약에서 색만으로는 정보가 사라진다).
  ctx.strokeStyle = danger ? '#b91c1c' : over ? '#c2410c' : color
  ctx.lineWidth = over ? 5 : 3
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 전구 기호 — 원 + 도선 방향의 선, 그리고 가운데에 **필라멘트 반원**.
  //
  // ⚠️ 두 번 틀렸다.
  //    ① 처음에는 «원 안의 X» 로 그렸다 — 교과서 기호가 아니다.
  //    ② 다음에는 «원 + 지름선» 으로 고쳤는데, 이것도 아니었다. 교과서 사진이
  //       작아서 가운데 필라멘트를 못 보고 단순한 직선으로 읽었다(2026-08-27).
  //    실제 기호는 도선이 원을 가로지르되 **가운데가 반원으로 볼록** 하다.
  //    그 반원이 «전구 안에 필라멘트가 있다» 는 뜻이다.
  //
  // 볼록한 쪽은 화면 위쪽이 아니라 **도선에 수직인 방향**이다 — 부품을 세워 놓아도
  // 기호가 같은 모양으로 보여야 하므로 화면 축이 아니라 도선 축을 기준으로 삼는다.
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const th = Math.atan2(uy, ux)          // 도선이 향하는 각
  const fil = r * 0.42                   // 필라멘트 반원의 반지름

  ctx.beginPath()
  // 왼쪽 끝 → 반원 시작
  ctx.moveTo(c.x - ux * r, c.y - uy * r)
  ctx.lineTo(c.x - ux * fil, c.y - uy * fil)
  // 반원 — 각을 늘리는 방향으로 돌면 도선의 «수직 방향» 으로 볼록해진다
  ctx.arc(c.x, c.y, fil, th + Math.PI, th + Math.PI * 2)
  // 반원 끝 → 오른쪽 끝
  ctx.lineTo(c.x + ux * r, c.y + uy * r)
  ctx.stroke()

  // 규격을 늘 보여 준다 — 어떤 전구인지 모르면 밝기 차이를 해석할 수 없다.
  // ⚠️ 과전류 문구를 길게 썼더니(«과전류! 끊어질 위험») 규격 라벨과 글자가 겹쳤다.
  //    세로로 놓인 전구는 두 라벨이 좌우로 붙어서 특히 심했다. **짧게 둔다** —
  //    얼마나 위험한지는 테두리 색·굵기가 이미 말하고 있다.
  //    ⚠️ 세로로 놓인 전구는 두 라벨이 **좌우로** 붙어서 원을 덮기 쉽다.
  //       라벨 상자의 절반 폭이 원 반지름(16)을 넘지 않게 거리를 잡아야 한다.
  //       «과전류!» 는 네 글자라 상자가 넓어서 규격 라벨보다 더 밀어낸다.
  const perp = perpUnit(p1, p2)
  drawLabel(ctx, `${ratedV}V`, c, perp, 32)
  if (over) drawLabel(ctx, '과전류!', c, perp, -46, 12, true)
}

function drawSwitch(ctx, p1, p2, color, closed) {
  const c = mid(p1, p2)
  const perp = perpUnit(p1, p2)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  // 접점 두 개
  const gap1 = mid(p1, p2, 0.5 - SWITCH_GAP_RATIO)
  const gap2 = mid(p1, p2, 0.5 + SWITCH_GAP_RATIO)
  ctx.beginPath()
  ctx.arc(gap1.x, gap1.y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(gap2.x, gap2.y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  if (closed) {
    ctx.moveTo(gap1.x, gap1.y)
    ctx.lineTo(gap2.x, gap2.y)
  } else {
    ctx.moveTo(gap1.x, gap1.y)
    ctx.lineTo(gap2.x - perp.x * 18, gap2.y - perp.y * 18)
  }
  ctx.stroke()
  drawLabel(ctx, closed ? '닫힘' : '열림', c, perp, 26, undefined, true)
}

function drawMeter(ctx, p1, p2, color, letter, reading, unit) {
  const c = mid(p1, p2)
  const r = METER_RADIUS
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.font = 'bold 18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, c.x, c.y + 1)
  const perp = perpUnit(p1, p2)
  // 계기판은 크기(절댓값)만 보여준다 — 방향은 전류 애니메이션이 화살처럼 흐르는 방향으로 알려준다.
  // 부호까지 보여주면 중학생에게는 "음수 전류"가 오히려 혼란스럽다.
  const magnitude = Math.abs(reading)
  const rounded = magnitude < 0.001 ? '0' : magnitude.toFixed(magnitude >= 10 ? 1 : 2)
  drawLabel(ctx, `${rounded}${unit}`, c, perp, 28)
}

function drawLabel(ctx, text, center, perp, offset, fontSize = 15, small = false) {
  ctx.save()
  ctx.font = `${small ? 'bold ' : ''}${fontSize}px system-ui, sans-serif`
  ctx.fillStyle = '#334155'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const x = center.x + perp.x * offset
  const y = center.y + perp.y * offset
  // 가독성을 위한 흰 배경
  const w = ctx.measureText(text).width + 8
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillRect(x - w / 2, y - fontSize / 2 - 2, w, fontSize + 4)
  ctx.fillStyle = '#334155'
  ctx.fillText(text, x, y)
  ctx.restore()
}

function pathLength(path) {
  let total = 0
  for (let i = 0; i < path.length - 1; i++) total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y)
  return total
}

/** path를 따라 path[0](=d0)에서 잰 거리 d 지점의 좌표와, 그 지점에서 path[0]→끝 방향을 향하는
 *  접선 각도를 낸다. 병렬 스텁을 포함한 꺾인 경로(polyline)를 하나의 연속된 선으로 다룬다. */
function pointAndAngleAtDistance(path, d) {
  let remaining = Math.max(0, d)
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const segLen = Math.hypot(b.x - a.x, b.y - a.y)
    if (remaining <= segLen || i === path.length - 2) {
      const t = segLen > 0 ? Math.min(1, remaining / segLen) : 0
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) }
    }
    remaining -= segLen
  }
  const last = path[path.length - 1]
  return { x: last.x, y: last.y, angle: 0 }
}

/** 전류 방향 표시: 진행 방향을 가리키는 작은 화살표(전통적인 회로도 관례 — 화살표가 전류 방향). */
// 전류를 «흐르는 알갱이» 로 그린다 — /water-analogy/ 의 물 입자와 같은 방식이다.
// ⚠️ 예전에는 화살표였다. 바꾼 이유가 둘이다(2026-08-29, 사용자 요청).
//   ① 물 비유 시뮬레이터와 **같은 그림**이어야 «물의 흐름 ↔ 전류» 대응이 눈에 들어온다.
//   ② 화살표는 빨라지면 방향이 뭉개져 오히려 못 읽는다. 알갱이는 빨라져도 흐름으로 읽힌다.
// 방향은 **움직임 자체**가 알려 준다(전류/전자 토글을 누르면 반대로 흐른다).
function drawFlowDot(ctx, x, y, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 4.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** 전자 표시: 방향이 없는 둥근 점 + "−" 표시(음전하 관례) — 화살표가 아닌 것은, 전자 자체는
 *  화살표 모양의 실체가 아니라 그냥 음전하 알갱이라는 걸 시각적으로 구분하기 위함. */
function drawElectronMark(ctx, x, y, color) {
  const r = 5
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x - r * 0.55, y)
  ctx.lineTo(x + r * 0.55, y)
  ctx.stroke()
  ctx.restore()
}

/**
 * 전류·전자 흐름을 이동하는 작은 표시들로 그린다(예전의 "점선이 흐르는" 표현을 대체).
 * mode='current'면 화살표가 전류 방향(+→−)으로, mode='electron'이면 점(−)이 전자의 실제
 * 이동 방향(−→+, 전류와 반대)으로 움직인다 — 둘은 항상 서로 반대 방향이다.
 */
function drawFlowParticles(ctx, path, current, flowPhase, mode, skipHalf = 0) {
  const totalLen = pathLength(path)
  if (totalLen < 2) return
  // 기호는 경로 한가운데에 있다(병렬 스텁은 좌우 대칭이라 중앙이 그대로 기호 중심이다).
  const centerD = totalLen / 2
  const isElectron = mode === FLOW_MODE_ELECTRON
  const conventionalForward = current > 0
  const forward = isElectron ? !conventionalForward : conventionalForward
  const speed = flowSpeed(current)
  const spacing = FLOW_PARTICLE_SPACING
  const color = isElectron ? ELECTRON_FLOW_COLOR : CURRENT_FLOW_COLOR
  const travel = flowPhase * speed * (forward ? 1 : -1)

  const count = Math.ceil(totalLen / spacing) + 1
  for (let i = 0; i < count; i++) {
    let d = (i * spacing + travel) % totalLen
    if (d < 0) d += totalLen
    if (skipHalf > 0 && Math.abs(d - centerD) < skipHalf) continue
    // 알갱이는 방향을 그림으로 나타내지 않으므로 각도가 필요 없다 — 흐르는 것으로 보인다.
    const { x, y } = pointAndAngleAtDistance(path, d)
    if (isElectron) drawElectronMark(ctx, x, y, color)
    else drawFlowDot(ctx, x, y, color)
  }
}
