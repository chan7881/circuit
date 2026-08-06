// 전구 비교 화면의 캔버스 렌더링. 모델을 읽기만 하는 순수 그리기 함수다.
//
// 왜 이 화면만 캔버스인가: 우리 집 화면은 카드가 여럿인 목록이라 HTML로 그리는 편이
// 글자 크기·줄바꿈이 기기마다 알아서 맞아 읽기 좋다. 반면 이 화면은 "넣은 에너지가 빛과
// 열로 갈라진다"를 **띠의 굵기**로 보여야 해서 그림이 본체다 — 그래서 캔버스로 그린다.

import { BULBS, lightShare, heatShare } from './model.js'

export const LOGICAL_WIDTH = 680
export const LOGICAL_HEIGHT = 340

const LIGHT_COLOR = '#facc15'
const HEAT_COLOR = '#ef4444'
const IN_COLOR = '#2563eb'

export function computeLayout(cssWidth, cssHeight) {
  const scale = Math.min(cssWidth / LOGICAL_WIDTH, cssHeight / LOGICAL_HEIGHT)
  return {
    scale,
    offsetX: (cssWidth - LOGICAL_WIDTH * scale) / 2,
    offsetY: (cssHeight - LOGICAL_HEIGHT * scale) / 2,
  }
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

/** 전구 그림. 빛으로 바뀌는 몫이 클수록 밝게 빛난다. */
function drawBulb(ctx, cx, cy, share) {
  const r = 26
  ctx.save()
  const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.6)
  glow.addColorStop(0, `rgba(250, 204, 21, ${0.25 + share * 1.4})`)
  glow.addColorStop(1, 'rgba(250, 204, 21, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = `rgba(253, 224, 71, ${0.3 + share * 1.4})`
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 3
  ctx.stroke()

  // 소켓
  ctx.fillStyle = '#94a3b8'
  roundedRect(ctx, cx - 11, cy + r - 3, 22, 16, 3)
  ctx.fill()
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2
  ctx.stroke()

  // 필라멘트
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(cx - 11, cy + 5)
  ctx.lineTo(cx - 5, cy - 7)
  ctx.lineTo(cx + 1, cy + 5)
  ctx.lineTo(cx + 7, cy - 7)
  ctx.lineTo(cx + 11, cy + 3)
  ctx.stroke()
  ctx.restore()
}

/**
 * 한 전구의 에너지 흐름 그림.
 *
 * 왼쪽에서 들어온 전기 에너지 띠가 전구에서 **빛 띠와 열 띠로 갈라진다**. 띠의 굵기가
 * 그 몫이라, 두 전구를 나란히 놓으면 어느 쪽이 빛을 더 많이 만드는지 굵기만 보고 알 수 있다.
 * 들어온 띠의 굵기는 둘이 똑같다 — 같은 전기 에너지를 넣었다는 뜻이다.
 */
function drawBulbFlow(ctx, box, bulb, showNumbers) {
  const light = lightShare(bulb.id)
  const heat = heatShare(bulb.id)
  const bandTotal = 62 // 들어오는 띠의 굵기 = 넣은 에너지의 양(두 전구가 같다)
  const cx = box.x + box.w * 0.42
  const cy = box.y + box.h * 0.5

  ctx.save()

  // 들어오는 전기 에너지
  ctx.fillStyle = IN_COLOR
  ctx.fillRect(box.x, cy - bandTotal / 2, cx - box.x - 30, bandTotal)

  // 갈라져 나가는 빛(위)과 열(아래)
  const outX = cx + 30
  // 띠 오른쪽에 이름표 자리를 비워 둔다 — 띠 위에 글자를 얹으면 빨강 위 빨강, 노랑 위 노랑이
  // 되어 안 읽힌다(2026-08-06 확인).
  const LABEL_ROOM = 78
  const outW = box.x + box.w - outX - LABEL_ROOM
  const lightH = Math.max(3, bandTotal * light)
  const heatH = Math.max(3, bandTotal * heat)

  ctx.fillStyle = LIGHT_COLOR
  ctx.beginPath()
  ctx.moveTo(outX, cy - bandTotal / 2)
  ctx.lineTo(outX + outW, cy - bandTotal / 2 - 20)
  ctx.lineTo(outX + outW, cy - bandTotal / 2 - 20 + lightH)
  ctx.lineTo(outX, cy - bandTotal / 2 + lightH)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = HEAT_COLOR
  ctx.beginPath()
  ctx.moveTo(outX, cy + bandTotal / 2 - heatH)
  ctx.lineTo(outX + outW, cy + bandTotal / 2 + 20 - heatH)
  ctx.lineTo(outX + outW, cy + bandTotal / 2 + 20)
  ctx.lineTo(outX, cy + bandTotal / 2)
  ctx.closePath()
  ctx.fill()

  drawBulb(ctx, cx, cy, light)

  // 이름
  ctx.fillStyle = '#334155'
  ctx.font = 'bold 15px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(bulb.name, box.x + box.w / 2, box.y - 6)

  // 띠 이름 — '빛'·'열'은 사물의 이름이라 늘 보여준다. 몇 %인지는 토글로 감춘다:
  // 그 수치를 바로 보여주면 "어느 쪽이 효율이 좋은가"라는 판단을 학생 대신 해버린다.
  ctx.font = 'bold 12px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#a16207'
  ctx.fillText(showNumbers ? `빛 ${Math.round(light * 100)}%` : '빛', outX + outW + 8, cy - bandTotal / 2 - 20 + lightH / 2)
  ctx.fillStyle = '#b91c1c'
  ctx.fillText(showNumbers ? `열 ${Math.round(heat * 100)}%` : '열', outX + outW + 8, cy + bandTotal / 2 + 20 - heatH / 2)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#1d4ed8'
  ctx.fillText('전기 에너지', box.x + 4, cy - bandTotal / 2 - 14)

  ctx.restore()
}

export function drawCompare(ctx, cssWidth, cssHeight, state) {
  begin(ctx, cssWidth, cssHeight)

  ctx.fillStyle = '#64748b'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('두 전구에 같은 양의 전기 에너지를 넣었습니다', LOGICAL_WIDTH / 2, 12)

  // 두 전구를 위아래로 놓되, 갈라져 나가는 띠와 이름표까지 논리 높이(340) 안에 들어와야 한다.
  // 처음엔 상자를 크게 잡았다가 아래쪽 전구가 화면 밖으로 잘렸다.
  const boxH = 100
  BULBS.forEach((bulb, i) => {
    drawBulbFlow(
      ctx,
      { x: 60, y: 64 + i * 136, w: LOGICAL_WIDTH - 120, h: boxH },
      bulb,
      state.showNumbers,
    )
  })

  ctx.restore()
}
