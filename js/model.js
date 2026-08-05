// 회로 데이터 구조와 배치/삭제/되돌리기. DOM을 건드리지 않는 순수 로직이라 test.html에서
// solver.js와 함께 그대로 검증할 수 있다.

import { GRID_COLS, GRID_ROWS, COMPONENT_TYPES, MAX_ITEMS_PER_EDGE } from './config.js'

export function nodeId(r, c) {
  return r * GRID_COLS + c
}

export function nodeRC(id) {
  return { r: Math.floor(id / GRID_COLS), c: id % GRID_COLS }
}

/** 격자 위 모든 간선(인접 노드 쌍)의 목록을 만든다. 렌더링·히트테스트·솔버가 공유한다. */
export function buildEdgeList() {
  const edges = []
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS - 1; c++) {
      edges.push({ key: `h_${r}_${c}`, orientation: 'h', r, c, u: nodeId(r, c), v: nodeId(r, c + 1) })
    }
  }
  for (let r = 0; r < GRID_ROWS - 1; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      edges.push({ key: `v_${r}_${c}`, orientation: 'v', r, c, u: nodeId(r, c), v: nodeId(r + 1, c) })
    }
  }
  return edges
}

export const EDGE_LIST = buildEdgeList()
export const EDGE_BY_KEY = new Map(EDGE_LIST.map((e) => [e.key, e]))

let uidCounter = 1
function nextUid() {
  return `c${uidCounter++}`
}

export function createModel() {
  return {
    // edgeKey -> 부품 인스턴스 배열(길이 0~MAX_ITEMS_PER_EDGE)
    items: new Map(),
  }
}

export function cloneModel(model) {
  const items = new Map()
  for (const [key, arr] of model.items) items.set(key, arr.map((it) => ({ ...it })))
  return { items }
}

export function serializeModel(model) {
  return JSON.stringify(Array.from(model.items.entries()))
}

export function deserializeModel(json) {
  const entries = JSON.parse(json)
  return { items: new Map(entries) }
}

/** edgeKey에 부품을 놓을 수 있는지. 꽉 찼으면(2개) 거부 — 같은 종류를 두 번 겹치는 것은
 *  허용한다(예: 저항 두 개를 겹쳐 놓아 병렬 저항을 표현하는 게 의도된 사용법이다). */
export function canPlace(model, edgeKey, type) {
  const arr = model.items.get(edgeKey) ?? []
  if (arr.length >= MAX_ITEMS_PER_EDGE) return false
  return true
}

export function placeComponent(model, edgeKey, type) {
  if (!EDGE_BY_KEY.has(edgeKey)) throw new Error(`알 수 없는 간선: ${edgeKey}`)
  if (!canPlace(model, edgeKey, type)) return model
  const def = COMPONENT_TYPES[type]
  if (!def) throw new Error(`알 수 없는 부품 종류: ${type}`)
  const arr = model.items.get(edgeKey) ?? []
  const instance = {
    uid: nextUid(),
    type,
    edgeKey,
    value: def.defaultValue,
    flipped: false,
    closed: type === 'switch' ? true : undefined,
  }
  model.items.set(edgeKey, [...arr, instance])
  return model
}

/** placeComponent 후 곧바로 값을 지정한다(예제 회로 로딩용). 배치가 거부되면 조용히 무시. */
export function placeComponentWithValue(model, edgeKey, type, patch) {
  const before = (model.items.get(edgeKey) ?? []).length
  placeComponent(model, edgeKey, type)
  const arr = model.items.get(edgeKey) ?? []
  if (arr.length === before) return model // 배치 거부됨
  const inst = arr[arr.length - 1]
  if (patch) Object.assign(inst, patch)
  return model
}

export function findComponent(model, uid) {
  for (const arr of model.items.values()) {
    const found = arr.find((it) => it.uid === uid)
    if (found) return found
  }
  return null
}

export function removeComponent(model, uid) {
  for (const [key, arr] of model.items) {
    const next = arr.filter((it) => it.uid !== uid)
    if (next.length !== arr.length) {
      if (next.length === 0) model.items.delete(key)
      else model.items.set(key, next)
      return model
    }
  }
  return model
}

export function updateComponent(model, uid, patch) {
  for (const arr of model.items.values()) {
    const idx = arr.findIndex((it) => it.uid === uid)
    if (idx !== -1) {
      arr[idx] = { ...arr[idx], ...patch }
      return model
    }
  }
  return model
}

export function clearModel(model) {
  model.items.clear()
  return model
}

export function allComponents(model) {
  const out = []
  for (const arr of model.items.values()) out.push(...arr)
  return out
}

// --- 되돌리기(undo) 스택 ---
const MAX_HISTORY = 30

export function createHistory() {
  return { stack: [], redoStack: [] }
}

export function pushHistory(history, model) {
  history.stack.push(serializeModel(model))
  if (history.stack.length > MAX_HISTORY) history.stack.shift()
  history.redoStack.length = 0
}

export function undo(history, currentModel) {
  if (history.stack.length === 0) return null
  history.redoStack.push(serializeModel(currentModel))
  const json = history.stack.pop()
  return deserializeModel(json)
}
