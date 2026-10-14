import type { ElementTable, EngineInterface, Register, RenderElement, RenderSurface, Timer } from 'claude-code'
import type { CachetaxActArgs, CachetaxActResult, CachetaxCatalogEntry, CachetaxItem, CachetaxPanel, CachetaxState } from '../types'
import { STRINGS } from './i18n'
import type { Lang, Strings } from './i18n'
import { statusIcons } from './status-icons'

const TTL_MS = 60 * 60 * 1000
const PING_AFTER_MS = 50 * 60 * 1000
const MIN_PING_MS = 60 * 1000
const AUTO_WARM_MS = 3 * 60 * 60 * 1000
const DEFAULT_WINDOW_MS = 6 * 60 * 60 * 1000
const BIG_TOKENS = 50000
const PING_PROMPT = 'Reply with the single word: warm'
const KEY_DEADLINE = 'deadline'
const KEY_EVERY = 'every'
const KEY_GUARD = 'guard'
const KEY_ALWAYS = 'always'

// $ per million tokens, [cache read, 1h cache write, output], list prices September 2026.
// Longer family names first: a model id matches the first row it contains.
const PRICES: Array<[string, number, number, number]> = [
  ['fable-5-1', 0.25, 20, 50],
  ['fable-5', 1, 20, 50],
  ['opus-5', 0.5, 10, 25],
  ['opus-4', 0.5, 10, 25],
  ['sonnet-5', 0.2, 4, 10],
  ['sonnet', 0.3, 6, 15],
  ['haiku', 0.1, 2, 5],
]

type PingRecord = { at: number; read: number; write: number; usd: number | null; warm: boolean }
type Miss = { at: number; tokens: number; usd: number | null }
type GuardMode = 'refuse' | 'warn'

export type State = {
  hasBand: boolean
  sid: string
  deadline: number
  every: number
  always: boolean
  lastRequestAt: number
  lastModel: string | null
  ctx: number
  compacted: boolean
  guard: GuardMode
  ackedAt: number
  coldWritePending: boolean
  misses: Miss[]
  pending: { cancel: () => void } | null
  last: PingRecord | null
  stopped: string | null
}

function priceOf(model: string | null): [number, number, number] | null {
  const m = (model ?? '').toLowerCase().replace(/[\s.]+/g, '-')
  for (const [family, read, write, output] of PRICES) if (m.includes(family)) return [read, write, output]
  return null
}

export function parseDuration(text: string): number | null {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?$/.exec(text.trim())
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 * 1000
}

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`
}

function fmtUsd(usd: number | null): string {
  return usd == null ? 'n/a' : '$' + (usd >= 100 ? usd.toFixed(0) : usd.toFixed(2))
}

function fmtTok(n: number): string {
  return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)
}

function coldUsd(s: State): number | null {
  const price = priceOf(s.lastModel)
  return price ? s.ctx * price[1] / 1e6 : null
}

function warmUsd(s: State): number | null {
  const price = priceOf(s.lastModel)
  return price ? s.ctx * price[0] / 1e6 : null
}

/** Everything a fork bills: the cache read, any cache write, uncached input at the base rate (half the 1h write rate), and the output. */
function pingUsd(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }, price: [number, number, number]): number {
  return (u.cache_read_input_tokens * price[0] + u.cache_creation_input_tokens * price[1] + u.input_tokens * price[1] / 2 + u.output_tokens * price[2]) / 1e6
}

/** The read-only upper bound: pings at the cache-read rate that cost as much as one cold write of the same context. */
function breakEvenPings(s: State): number | null {
  const price = priceOf(s.lastModel)
  if (!price || s.ctx <= 0) return null
  return Math.floor(price[1] / price[0])
}

function isCold(s: State, now: number): boolean {
  return s.lastRequestAt > 0 && !s.compacted && now - s.lastRequestAt >= TTL_MS
}

function guardText(s: State, now: number): string {
  const price = priceOf(s.lastModel)
  const rate = price ? `$${price[1]}/MTok` : 'the cache-write rate'
  const warm = warmUsd(s)
  return `the prompt cache went cold ${fmtDuration(now - s.lastRequestAt - TTL_MS)} ago. Sending this re-writes ` +
    `up to ${s.ctx.toLocaleString('en-US')} tokens at ${rate} = ${fmtUsd(coldUsd(s))}` +
    (warm == null ? '' : ` (a warm turn would have cost ${fmtUsd(warm)})`) + '.'
}

export type ResumeFields = {
  source: string
  model?: string
  context_tokens?: number
  seconds_since_last_response?: number
  prompt_cache_likely_expired?: boolean
  estimated_cache_write_usd?: number
}

/** /clear starts a new conversation in the same process; nothing priced before it still exists. */
export function resetForClear(s: State) {
  s.ctx = 0
  s.lastRequestAt = 0
  s.compacted = false
  s.ackedAt = 0
  s.coldWritePending = false
  s.misses = []
  disarm(s)
}

/** Applies a resumed session's fields to the state; returns the line to log, if any. */
export function seedFromResume(s: State, e: ResumeFields, now: number): string | null {
  if (e.source !== 'resume' && e.source !== 'fork') return null
  if (typeof e.context_tokens === 'number' && e.context_tokens > 0) s.ctx = e.context_tokens
  if (typeof e.seconds_since_last_response === 'number') s.lastRequestAt = now - e.seconds_since_last_response * 1000
  if (typeof e.model === 'string') s.lastModel = e.model
  s.compacted = false
  if (e.prompt_cache_likely_expired !== true || s.ctx < BIG_TOKENS) return null
  const usd = typeof e.estimated_cache_write_usd === 'number' ? fmtUsd(e.estimated_cache_write_usd) : fmtUsd(coldUsd(s))
  return `resuming cold. The first message re-writes ${s.ctx.toLocaleString('en-US')} tokens, about ${usd}. /clear and paste a summary if you only need the conclusions.`
}

function statusText(s: State, now: number): string | undefined {
  if (s.stopped) return `keepwarm stopped: ${s.stopped}`
  if (!s.deadline) return undefined
  const pingText = s.last ? ` · last ping read ${fmtTok(s.last.read)} ${fmtUsd(s.last.usd)}` : ''
  const nextText = !s.lastRequestAt ? ' · waiting for the first turn'
    : s.compacted ? ' · waiting for the first turn after compaction'
    : isCold(s, now) ? ` · cold now, first ping ${fmtDuration(s.every)} after the next turn`
    : ` · ping in ${fmtDuration(s.lastRequestAt + s.every - now)}`
  return `keepwarm ${fmtDuration(s.deadline - now)} left${nextText}${pingText}`
}

function updateStatus($: EngineInterface, s: State, now: number) {
  if (s.hasBand) $.ui.invalidate('ui.render')
  else $.ui.status(statusText(s, now))
}

function disarm(s: State) {
  if (s.pending) s.pending.cancel()
  s.pending = null
}

// The window and its ping period belong to the session that armed them, so a
// second session, or one resumed from another transcript, never inherits them
// and cannot turn them off. The always switch and the guard mode are the user's,
// shared by every session through the store (syncSettings).
function deadlineKey(s: State): string {
  return `${KEY_DEADLINE}:${s.sid}`
}

function everyKey(s: State): string {
  return `${KEY_EVERY}:${s.sid}`
}

/** Clears this session's own dead window and the bare keys a store written before 2.1.1 still holds. Other sessions' keys are never touched: a read followed by a delete cannot be made atomic against their renewal. */
async function prune($: EngineInterface, s: State, now: number) {
  for (const key of [KEY_DEADLINE, deadlineKey(s)]) {
    const deadline = await $.store.get(key)
    if (deadline === undefined) continue
    if (typeof deadline === 'number' && deadline > now) continue
    await $.store.delete(key)
    await $.store.delete(KEY_EVERY + key.slice(KEY_DEADLINE.length))
  }
}

async function stop($: EngineInterface, s: State, why: string | null, forgetAlways = false) {
  s.deadline = 0
  s.every = PING_AFTER_MS
  s.stopped = why
  disarm(s)
  await $.store.delete(deadlineKey(s))
  await $.store.delete(everyKey(s))
  if (forgetAlways) {
    s.always = false
    await $.store.delete(KEY_ALWAYS)
  }
  updateStatus($, s, await $.clock.now())
}

async function arm($: EngineInterface, s: State) {
  disarm(s)
  if (!s.deadline) return
  const now = await $.clock.now()
  if (now >= s.deadline) return stop($, s, null)
  // A cold window still needs expiry cleanup, but must not send a model request.
  if (s.lastRequestAt && !s.compacted && !isCold(s, now)) {
    const untilCold = s.lastRequestAt + TTL_MS - now
    const delay = Math.min(s.deadline - now, untilCold, Math.max(1000, s.lastRequestAt + s.every - now))
    s.pending = $.clock.after(delay, () => { void ping($, s) })
  } else {
    s.pending = $.clock.after(s.deadline - now, () => { void arm($, s) })
  }
  updateStatus($, s, now)
}

async function ping($: EngineInterface, s: State) {
  s.pending = null
  if (!s.deadline) return
  const now = await $.clock.now()
  if (now >= s.deadline) return arm($, s)
  // A turn in the meantime re-armed the timer; this callback is stale.
  if (isCold(s, now)) return arm($, s)
  if (now - s.lastRequestAt < s.every - 1000) return
  let reply
  try {
    reply = await $.model.fork({ prompt: PING_PROMPT })
  } catch (err) {
    return stop($, s, `the ping failed, ${err instanceof Error ? err.message : String(err)}`)
  }
  if (reply === null) return stop($, s, 'the engine did not send the ping, either the snapshot was cold or the API call failed')
  if (reply.isAnswered === false) {
    const reason = reply.reason === 'nothing-to-fork' ? 'no conversation to warm yet'
      : reply.reason === 'api-error' ? `the API call failed${reply.status === null ? '' : ` (${reply.status})`}`
      : reply.reason === 'aborted' ? 'the ping was interrupted'
      : 'the ping returned no text'
    return stop($, s, reason)
  }
  const u = reply.usage
  const price = priceOf(s.lastModel)
  // A warm ping reads the prefix and writes only its own message; a write of a tenth of the read or more means the prefix broke.
  const warm = u.cache_read_input_tokens > 0 && u.cache_creation_input_tokens < 0.1 * u.cache_read_input_tokens
  const usd = price ? pingUsd(u, price) : null
  s.last = { at: now, read: u.cache_read_input_tokens, write: u.cache_creation_input_tokens, usd, warm }
  if (!warm) return stop($, s, `the ping read ${fmtTok(u.cache_read_input_tokens)} and wrote ${fmtTok(u.cache_creation_input_tokens)} tokens (${fmtUsd(usd)}), the cache was already gone`)
  s.lastRequestAt = now
  await arm($, s)
}

/** What arming a window answers; on a cold cache it says when the first ping can come. */
function armedText(s: State, now: number, windowMs: number, t: Strings): string {
  return isCold(s, now) ? t.messages.armedCold(fmtDuration(windowMs), fmtDuration(s.every)) : t.messages.armed(fmtDuration(windowMs), fmtDuration(s.every))
}

async function startWindow($: EngineInterface, s: State, windowMs: number, every: number) {
  const now = await $.clock.now()
  s.every = every
  if (every === PING_AFTER_MS) await $.store.delete(everyKey(s))
  else await $.store.set(everyKey(s), every)
  s.deadline = now + windowMs
  s.stopped = null
  await $.store.set(deadlineKey(s), s.deadline)
  await arm($, s)
}

// The windows the tab offers with one press; any other is typed.
const WINDOWS = ['1h', '3h', '6h', '12h', '24h']

const REFRESH_MS = 15 * 1000

// How often the user's settings are read back from the store, so a change made in another
// session reaches this one.
const SYNC_MS = 3 * 1000

/** Reads the user's settings (the guard and the every-session switch) back from the store, the only place they live; true when either changed since the last read. The keep-warm window is this session's own and is not touched. */
export async function syncSettings($: EngineInterface, s: State): Promise<boolean> {
  const guard: GuardMode = (await $.store.get(KEY_GUARD)) === 'warn' ? 'warn' : 'refuse'
  const always = (await $.store.get(KEY_ALWAYS)) === true
  if (guard === s.guard && always === s.always) return false
  s.guard = guard
  s.always = always
  return true
}

/** Where the cache stands, for another mod's countdown (`$.cachetax.state`). */
export function stateOf(s: State, now: number): CachetaxState {
  const known = s.lastRequestAt > 0 && !s.compacted
  const cold = known && isCold(s, now)

  return {
    phase: s.stopped ? 'stopped' : !known ? 'unknown' : cold ? 'cold' : 'warm',
    coldAt: known && !cold ? s.lastRequestAt + TTL_MS : null,
    warmUntil: s.deadline > now ? s.deadline : null,
  }
}

function keepWarmValue(s: State, now: number, t: Strings): string {
  if (s.deadline) {
    const next = !s.lastRequestAt ? t.values.nextFirstTurn
      : s.compacted ? t.values.nextAfterCompaction
      : isCold(s, now) ? t.values.nextCold(fmtDuration(s.every))
      : t.values.nextPing(fmtDuration(s.lastRequestAt + s.every - now))
    const last = s.last ? t.values.lastPing(fmtTok(s.last.read), fmtUsd(s.last.usd)) : ''
    return t.values.keepWarmOn(fmtDuration(s.deadline - now), next + last, s.always)
  }
  if (s.stopped) return t.values.stopped(s.stopped, s.always)
  return s.always ? t.values.offAlways(fmtDuration(DEFAULT_WINDOW_MS)) : t.values.off
}

/** cache-tax's tab in the /mods pane: where the cache stands, the keep-warm window and the guard. */
export function panelOf(s: State, now: number, lang: Lang): CachetaxPanel {
  const t = STRINGS[lang]
  const known = s.lastRequestAt > 0 && !s.compacted
  const cold = known && isCold(s, now)
  const cache = s.compacted ? t.summary.compacted
    : !s.lastRequestAt ? t.summary.none
    : cold ? t.summary.cold(fmtDuration(now - s.lastRequestAt - TTL_MS))
    : t.summary.warm(fmtDuration(s.lastRequestAt + TTL_MS - now))
  const warm = s.deadline ? t.summary.keepWarm(fmtDuration(s.deadline - now)) : s.stopped ? t.summary.stopped(s.stopped) : t.summary.keepWarmOff
  const pings = breakEvenPings(s)
  const paid = s.misses.reduce((a, m) => a + (m.usd ?? 0), 0)
  const status: CachetaxItem[] = [
    { kind: 'info', label: t.labels.cache, tone: cold ? 'err' : known ? 'ok' : 'muted',
      value: s.compacted ? t.values.compacted : !s.lastRequestAt ? t.values.none
        : cold ? t.values.cold(fmtDuration(now - s.lastRequestAt))
        : t.values.warm(fmtDuration(s.lastRequestAt + TTL_MS - now)) },
    { kind: 'info', label: t.labels.keepWarm, value: keepWarmValue(s, now, t), tone: s.deadline ? 'ok' : s.stopped ? 'err' : 'muted' },
    { kind: 'info', label: t.labels.model, value: s.lastModel ?? t.values.modelUnseen },
    { kind: 'info', label: t.labels.context, value: t.values.tokens(s.ctx.toLocaleString('en-US')) },
    { kind: 'info', label: t.labels.coldWrite, value: t.values.coldWrite(fmtUsd(coldUsd(s)), fmtUsd(warmUsd(s))) },
    ...(pings == null ? [] : [{ kind: 'info', label: t.labels.breakEven, value: t.values.breakEven(pings, fmtDuration(pings * s.every), fmtDuration(s.every)) } as const]),
    { kind: 'info', label: t.labels.guard, value: s.guard === 'refuse' ? t.values.guardRefuse : t.values.guardWarn },
    { kind: 'info', label: t.labels.session, value: t.values.session(s.misses.length, fmtUsd(paid)), tone: s.misses.length > 0 ? 'warn' : 'muted' },
  ]
  const keepWarm: CachetaxItem[] = [
    { kind: 'choice', id: 'window', label: t.warm.window, help: t.warm.windowHelp, value: '', options: WINDOWS.map(w => ({ value: w, label: w })) },
    { kind: 'input', id: 'custom', label: t.warm.custom, help: t.warm.customHelp, placeholder: '90m', submitLabel: t.warm.start },
    { kind: 'toggle', id: 'always', label: t.warm.always, help: t.warm.alwaysHelp(fmtDuration(DEFAULT_WINDOW_MS)), value: s.always },
    ...(s.deadline || s.always ? [{ kind: 'action', id: 'off', label: t.warm.off, help: t.warm.offHelp } as const] : []),
    { kind: 'text', text: t.warm.cost, tone: 'muted' },
  ]
  const guard: CachetaxItem[] = [
    { kind: 'choice', id: 'guard', label: t.guard.label, help: t.guard.help, value: s.guard, options: [{ value: 'refuse', label: t.guard.refuse }, { value: 'warn', label: t.guard.warn }] },
  ]
  return {
    title: t.title,
    summary: `${cache} · ${warm}`,
    tone: s.stopped ? 'err' : cold ? 'warn' : known ? 'ok' : 'muted',
    sections: [
      { id: 'status', title: t.sections.status, items: status },
      { id: 'warm', title: t.sections.warm, items: keepWarm },
      { id: 'guard', title: t.sections.guard, items: guard },
    ],
    refreshMs: REFRESH_MS,
  }
}

/** A press in the tab. `window` and `custom` take a window such as 6h or 90m, and `custom` also `<window> every <period>`, a testing knob that lasts only for that window. */
async function actOn($: EngineInterface, s: State, args: CachetaxActArgs, lang: Lang): Promise<CachetaxActResult> {
  const t = STRINGS[lang]
  const now = await $.clock.now()
  switch (args.id) {
    case 'window':
    case 'custom': {
      const words = String(args.value ?? '').trim().split(/\s+/).filter(Boolean)
      const window = parseDuration(words[0] ?? '')
      if (window == null) return { message: t.messages.badDuration }
      let every = PING_AFTER_MS
      if (words[1] === 'every') {
        const period = parseDuration(words[2] ?? '')
        if (period == null || period < MIN_PING_MS) return { message: t.messages.badEvery }
        every = period
      }
      await startWindow($, s, window, every)
      return { message: armedText(s, now, window, t) }
    }
    case 'always': {
      if (args.value === 'off') {
        s.always = false
        await $.store.delete(KEY_ALWAYS)
        updateStatus($, s, now)
        return { message: t.messages.alwaysOff }
      }
      s.always = true
      await $.store.set(KEY_ALWAYS, true)
      await startWindow($, s, DEFAULT_WINDOW_MS, PING_AFTER_MS)
      return { message: t.messages.alwaysOn(fmtDuration(DEFAULT_WINDOW_MS)) + (isCold(s, now) ? t.messages.coldNote(fmtDuration(s.every)) : '') }
    }
    case 'off': {
      const wasAlways = s.always
      await stop($, s, null, true)
      return { message: wasAlways ? t.messages.offAlways : t.messages.off }
    }
    case 'guard': {
      if (args.value !== 'warn' && args.value !== 'refuse') return {}
      s.guard = args.value
      await $.store.set(KEY_GUARD, s.guard)
      return { message: s.guard === 'refuse' ? t.messages.guardRefuse : t.messages.guardWarn }
    }
    default:
      return {}
  }
}

/** True when skins' usage band already shows the time until the cache goes cold; false without skins. */
async function skinsShowsCache($: EngineInterface): Promise<boolean> {
  try {
    return (await $.skins.band()) === true
  } catch {
    return false
  }
}

type BandState = 'warm' | 'cold' | 'stopped' | 'unknown'

/** The row above the prompt: the cube in the state's colour, `cache-tax · <state> · <text>`. */
export function bandRow(ui: ElementTable, surface: RenderSurface, state: BandState, text: string, light: boolean, noColor: boolean): RenderElement {
  const { Box, Text } = ui
  const color = noColor ? undefined : state === 'warm' ? 'success' : state === 'cold' ? (light ? '#c15f3c' : '#d97757') : undefined
  const asset = statusIcons[light ? 'light' : 'dark'][state === 'warm' || state === 'cold' ? state : 'neutral']
  const icon = noColor ? Text({ bold: true, children: ['[>]'] })
    : surface === 'terminal' && 'Image' in ui ? ui.Image({ source: { png: asset.png }, columns: 3, rows: 1, alt: '[>]' })
    : surface === 'desktop' && 'Svg' in ui ? ui.Svg({ source: asset.svg, width: 18, height: 18, alt: 'Cache Tax' })
    : Text({ color, bold: true, children: ['[>]'] })
  return Box({ flexDirection: 'row', alignItems: 'center', children: [
    Box({ flexShrink: 0, children: [icon] }),
    Text({ children: [
      ' cache-tax · ',
      Text({ color, bold: true, children: [state] }),
      ` · ${text}`,
    ] }),
  ] })
}

/** Every component cache-tax draws, named, for the Components tab of /mods. */
export function catalogOf(ui: ElementTable, surface: RenderSurface, lang: Lang): CachetaxCatalogEntry[] {
  const { Text } = ui
  const pt = lang === 'pt'
  const entry = (id: string, en: string, ptName: string, helpEn: string, helpPt: string, tree: RenderElement): CachetaxCatalogEntry =>
    ({ id, name: pt ? ptName : en, help: pt ? helpPt : helpEn, tree })
  const warm = 'keepwarm 5h12m left · ping in 38m · last ping read 157k $0.05'
  return [
    entry('band-warm', 'Band row: warm', 'Linha da faixa: aquecido', 'Above the prompt while keep warm runs and the cache is warm', 'Acima do prompt com o aquecimento ligado e o cache aquecido', bandRow(ui, surface, 'warm', warm, false, false)),
    entry('band-cold', 'Band row: cold', 'Linha da faixa: frio', 'The cache went cold: the first ping waits for the next turn', 'O cache esfriou: o primeiro ping espera o próximo turno', bandRow(ui, surface, 'cold', 'keepwarm 4h59m left · cold now, first ping 50m after the next turn', false, false)),
    entry('band-unknown', 'Band row: before the first turn', 'Linha da faixa: antes do primeiro turno', 'Grey cube: nothing cached yet, or reset by compaction', 'Cubo cinza: nada em cache ainda, ou zerado pela compactação', bandRow(ui, surface, 'unknown', 'keepwarm 6h00m left · waiting for the first turn', false, false)),
    entry('band-stopped', 'Band row: stopped', 'Linha da faixa: parado', 'The loop stopped, with its reason', 'O ciclo parou, com o motivo', bandRow(ui, surface, 'stopped', 'keepwarm stopped: the ping read 0 and wrote 157k tokens ($3.14), the cache was already gone', false, false)),
    entry('band-light', 'Band row: light theme', 'Linha da faixa: tema claro', "The cube's light-theme colours", 'As cores do cubo no tema claro', bandRow(ui, surface, 'cold', 'keepwarm 2h10m left · cold now, first ping 50m after the next turn', true, false)),
    entry('band-no-color', 'Band row: NO_COLOR', 'Linha da faixa: NO_COLOR', 'With NO_COLOR set: a bold [>] and no colour', 'Com NO_COLOR: um [>] em negrito e sem cor', bandRow(ui, surface, 'warm', warm, false, true)),
    entry('status-line', 'Status line text', 'Texto da linha de status', 'On a surface without the band, the same words in the status line', 'Numa superfície sem a faixa, as mesmas palavras na linha de status', Text({ dimColor: true, children: [warm] })),
    entry('guard-refusal', 'Cold send held once', 'Envio a frio segurado', 'The guard dropping a cold send once, with its price (guard: stop once)', 'A proteção segurando um envio a frio uma vez, com o preço (proteção: segurar uma vez)',
      Text({ color: 'warning', children: ['cache-tax: the prompt cache went cold 2h00m ago. Sending this re-writes up to 200,502 tokens at $20/MTok = $4.01 (a warm turn would have cost $0.05). Send it again to pay it, and keepwarm will then hold the cache for 3h00m. Or /clear and start from a note.'] })),
    entry('guard-warning', 'Cold send warned', 'Envio a frio avisado', 'The same price, logged while the send goes through (guard: warn only)', 'O mesmo preço, registrado enquanto o envio passa (proteção: só avisar)',
      Text({ dimColor: true, children: ['the prompt cache went cold 2h00m ago. Sending this re-writes up to 200,502 tokens at $20/MTok = $4.01 (a warm turn would have cost $0.05). Sending anyway; keepwarm will hold the cache for 3h00m once it lands.'] })),
    entry('cold-write-paid', 'Cold write paid', 'Escrita a frio paga', 'Logged after a cold write, as keep warm arms itself for three hours', 'Registrado depois de uma escrita a frio, quando o aquecimento liga sozinho por três horas',
      Text({ dimColor: true, children: ['cold write of 157k tokens paid ($3.14). Keeping the cache warm for 3h00m so it is not paid again today; turn it off in /mods to stop.'] })),
    entry('resume-cold', 'Resuming cold', 'Retomando a frio', 'Logged when a resumed session starts with a cold cache', 'Registrado quando uma sessão retomada começa com o cache frio',
      Text({ dimColor: true, children: ['resuming cold. The first message re-writes 200,502 tokens, about $4.01. /clear and paste a summary if you only need the conclusions.'] })),
  ]
}

export function freshState(): State {
  return {
    hasBand: false, sid: '', deadline: 0, every: PING_AFTER_MS, always: false, lastRequestAt: 0, lastModel: null, ctx: 0, compacted: false,
    guard: 'refuse', ackedAt: 0, coldWritePending: false, misses: [], pending: null, last: null, stopped: null,
  }
}

export const register: Register = on => {
  const s = freshState()
  // The slow clock that picks up settings changed in another session.
  let sync: Timer | null = null
  let light = false
  let noColor = false
  // The language the /mods pane last asked for, for what a press answers.
  let lang: Lang = 'en'

  // Adds `$.cachetax`: its tab in the /mods pane and where the cache stands.
  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    return {
      ...built,
      cachetax: {
        panel: async () => ({ title: '', sections: [] }),
        act: async () => ({}),
        state: async () => ({ phase: 'unknown' as const, coldAt: null, warmUntil: null }),
        catalog: async () => [],
      },
    }
  })

  on('cachetax.panel', async ($, e) => {
    lang = e.lang === 'pt' ? 'pt' : 'en'
    await syncSettings($, s)
    return { value: panelOf(s, await $.clock.now(), lang) }
  })

  on('cachetax.act', async ($, e) => ({ value: await actOn($, s, e, lang) }))

  on('cachetax.state', async $ => ({ value: stateOf(s, await $.clock.now()) }))

  on('cachetax.catalog', async ($, e) => ({ value: catalogOf($.ui.resolve({ surface: e.surface, component: 'AbovePrompt' }), e.surface, e.lang === 'pt' ? 'pt' : 'en') }))

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny === undefined) {
      light = typeof result.value === 'string' && result.value.startsWith('light')
      if (s.hasBand) $.ui.invalidate('ui.render')
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e)
    if (!s.hasBand || e.props.hasSurvey) return rest
    // skins draws the countdown in its own band; its line here would say it twice.
    if (await skinsShowsCache($)) return rest
    const now = await $.clock.now()
    const text = statusText(s, now)
    if (!text || (s.deadline && now >= s.deadline)) return rest
    const state = s.stopped ? 'stopped' : !s.lastRequestAt || s.compacted ? 'unknown' : isCold(s, now) ? 'cold' : 'warm'
    const { Box } = $.ui.resolve(e)
    return Box({ flexDirection: 'column', children: [rest, bandRow($.ui.resolve(e), e.surface, state, text, light, noColor)] })
  })

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    s.hasBand = e.surface === 'terminal' || e.surface === 'desktop'
    if (s.hasBand) {
      const theme = (await $.config.list()).find(row => row.key === 'theme')?.value
      light = typeof theme === 'string' && theme.startsWith('light')
      noColor = Boolean(await $.env.get('NO_COLOR'))
      $.ui.status(undefined)
    }
    s.sid = await $.session.id()
    const now = await $.clock.now()
    await prune($, s, now)
    const saved = await $.store.get(deadlineKey(s))
    const savedEvery = await $.store.get(everyKey(s))
    s.deadline = typeof saved === 'number' && saved > now ? saved : 0
    s.every = typeof savedEvery === 'number' && savedEvery >= MIN_PING_MS ? savedEvery : PING_AFTER_MS
    await syncSettings($, s)
    sync ??= $.clock.every(SYNC_MS, () => { void syncSettings($, s) })
    // Always means a fresh default window every session, whatever the last one left behind.
    if (s.always) await startWindow($, s, DEFAULT_WINDOW_MS, PING_AFTER_MS)
    const usage = await $.session.usage()
    if (usage.context.tokens) s.ctx = usage.context.tokens
    // The hook form of cache-tax ships a /cache-tax:status skill; both installed means two guards.
    const commands = await $.command.list()
    if (commands.some(c => c.name === 'cache-tax:status')) {
      $.ui.log('the hook form (cache-tax@claude-code-hooks) is also installed, so a cold send is warned about or refused twice. Uninstall it, or set the guard to warn only in /mods.')
    }
    updateStatus($, s, now)
    return r
  })

  // Resume fields seed the guard before any turn of the resumed session has run.
  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    if (e.source === 'clear') {
      await stop($, s, null)
      s.stopped = null
      resetForClear(s)
      s.sid = await $.session.id()
      updateStatus($, s, await $.clock.now())
      return r
    }
    const line = seedFromResume(s, e, await $.clock.now())
    // The resume payload may omit the model; without it the guard cannot price the cold write.
    if (!s.lastModel) s.lastModel = await $.session.model()
    if (line) $.ui.log(line)
    // The seeded clock decides whether a restored or always window pings before the first turn: never when it is cold.
    await arm($, s)
    return r
  })

  // The message that pays. Only its first character is read.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'plugin') return next(e)
    if (typeof e.text !== 'string' || e.text.trimStart().startsWith('/')) return next(e)
    const now = await $.clock.now()
    if (!isCold(s, now) || s.ctx < BIG_TOKENS) return next(e)
    // The guard is the user's setting: the one set in any session holds here.
    await syncSettings($, s)
    if (s.guard === 'warn') {
      $.ui.log(`${guardText(s, now)} Sending anyway; keepwarm will hold the cache for ${fmtDuration(AUTO_WARM_MS)} once it lands.`)
      s.coldWritePending = true
      return next(e)
    }
    if (s.ackedAt === s.lastRequestAt) {
      s.ackedAt = 0
      s.coldWritePending = true
      return next(e)
    }
    s.ackedAt = s.lastRequestAt
    return { drop: `cache-tax: ${guardText(s, now)} Send it again to pay it, and keepwarm will then hold the cache for ${fmtDuration(AUTO_WARM_MS)}. Or /clear and start from a note.` }
  })

  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) s.lastRequestAt = await $.clock.now()
    yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) return r
    const now = await $.clock.now()
    // A sleeping host may deliver this turn before the expired window's timer.
    if (s.deadline && now >= s.deadline) await stop($, s, null)
    // turn.step stamps the exact request time; when no step of this turn did, the turn's end is the floor.
    if (now - s.lastRequestAt > e.durationMs) s.lastRequestAt = now
    s.compacted = false
    s.ackedAt = 0
    const u = e.usage
    if (u) {
      if (u.model) s.lastModel = u.model
      const prev = s.ctx
      // A turn's usage is its responses summed, so a ten-step turn reports ten
      // reads of the context. The live window is the engine's figure; the sum
      // is only the fallback for a host that reports no tokens.
      const write = u.cache_creation_input_tokens
      const live = (await $.session.usage()).context.tokens
      s.ctx = live && live > 0 ? live : u.input_tokens + u.cache_read_input_tokens + write
      const full = prev > 20000 && write >= 0.5 * prev
      if (full || s.coldWritePending) {
        const price = priceOf(s.lastModel)
        const usd = price ? write * price[1] / 1e6 : null
        s.misses.push({ at: now, tokens: write, usd })
        if (s.deadline < now + AUTO_WARM_MS) {
          await startWindow($, s, AUTO_WARM_MS, s.every)
          $.ui.log(`cold write of ${fmtTok(write)} tokens paid (${fmtUsd(usd)}). Keeping the cache warm for ${fmtDuration(AUTO_WARM_MS)} so it is not paid again today; turn it off in /mods to stop.`)
        }
      }
    }
    s.coldWritePending = false
    await arm($, s)
    return r
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId) {
      s.compacted = true
      s.ctx = 0
      s.ackedAt = 0
      disarm(s)
      await arm($, s)
    }
    return r
  })
}
