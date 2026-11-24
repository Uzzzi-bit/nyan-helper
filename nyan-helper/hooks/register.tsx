import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DaySum, Lang, Todo, Live, Meter, Mood, RepoState, Today, Tone } from '../types'
import {
  CAT, FACE, UI, activityOf, activityText, addCall, addFile, addUsage, chartSvg, dayKey, emptyToday,
  failLabel, fmtDur, fmtReset, fmtTokens, headline, hourOf, isDirty, isProtected, isPushCommand,
  isTestCommand, levelColor, limitLabel, linesFor, parseGitStatus, parseNyanArgs, projectOf,
  rememberDay, resolveLang, resolveTone, topFiles, topProjects, turnRecap, upgradeToday,
  vsYesterday, weekDays, weekSvg,
  addTodo, completeTodo, dueLabel, dueOptions, parseFixedDue, parseTodoInput, pruneTodos, removeTodo, setDue,
  todoSections, undoTodo, upgradeTodos,
} from './buddy'

// 그리는 건 전부 로컬. 모델로 보내는 건 없음 (/nyan 결과도 isTextDisplayOnly)
// VS Code는 입력창 위 띠(AbovePrompt)를 안 그려서 → 접힌 패널이 띠 역할. 터미널·데스크톱은 띠.
const PANE = 'nyan-helper'
const COLOR = '#D97757'
const WARN = '#E0A23B'
const BAD = '#E5534B'
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit'])
const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])

const today = atom({ plugin: 'nyan-helper', key: 'today' } as const, emptyToday(''), { shape: 'today-2' })
const files = atom({ plugin: 'nyan-helper', key: 'files' } as const, {} as Record<string, number>, { shape: 'files-1' })
const repos = atom({ plugin: 'nyan-helper', key: 'repos' } as const, [] as RepoState[], { shape: 'repos-1' })
const live = atom(
  { plugin: 'nyan-helper', key: 'live' } as const,
  { mood: 'idle', project: '', activity: ['', ''], todoDone: 0, todoTotal: 0, lastFail: '', lastTurn: null } as Live,
  { shape: 'live-2' },
)
const meter = atom({ plugin: 'nyan-helper', key: 'meter' } as const, { contextPct: null, limits: [] } as Meter, { shape: 'meter-1' })
const isCompact = atom({ plugin: 'nyan-helper', key: 'isCompact' } as const, true)
const week = atom({ plugin: 'nyan-helper', key: 'week' } as const, {} as Record<string, DaySum>, { shape: 'week-1' })
/** 마감 드롭다운 상태: add = 새 할 일 마감('' = 오늘, 'none', 'custom', 날짜), editing = 직접 입력 중인 행 id */
const dueUi = atom({ plugin: 'nyan-helper', key: 'dueUi' } as const, { add: '', editing: '' }, { shape: 'dueui-1' })
/** 펼친 화면 탭: todo · now · stats (마지막 본 탭 기억) */
const tab = atom({ plugin: 'nyan-helper', key: 'tab' } as const, 'todo')
const todos = atom({ plugin: 'nyan-helper', key: 'todos' } as const, [] as Todo[], { shape: 'todos-2' })

/** session.start에서 채움 (reload 때마다 다시) */
const prefs: { lang: Lang; tone: Tone; custom: string; cwd: string; isRepo: boolean; protectedBranches: string } = {
  lang: 'ko', tone: 'nyan', custom: '', cwd: '', isRepo: false, protectedBranches: 'main,master',
}
/** 이번 답변에서 수정한 파일 수 (prompt.submit에서 0으로) */
const turn = { files: 0 }

type Measured = {
  context: { percent?: number }
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
}

async function setMeter($: EngineInterface, m: Measured) {
  await update($, meter, () => ({
    contextPct: m.context.percent ?? null,
    limits: m.rateLimits.map(r => ({ kind: r.kind, pct: r.percentUsed, ...(r.resetsAt ? { resetsAt: r.resetsAt } : {}) })),
  }))
}

async function bump($: EngineInterface, f: (t: Today, hour: number) => Today) {
  const now = await $.clock.now()
  const key = dayKey(now)
  let saved = emptyToday(key)
  await update($, today, t => (saved = f(t.date === key ? upgradeToday(t, key) : emptyToday(key), hourOf(now))))
  await $.store.set('today', saved)
  let hist: Record<string, DaySum> = {}
  await update($, week, w => (hist = rememberDay(w, saved)))
  await $.store.set('week', hist)
}

async function setLive($: EngineInterface, patch: Partial<Live>) {
  await update($, live, l => ({ ...l, ...patch }))
}

async function record(
  $: EngineInterface, tool: string, isSub: boolean, input: Record<string, unknown>,
  project: string | null, ran: { deny?: unknown; isError?: boolean },
) {
  const cmd = typeof input.command === 'string' ? input.command : ''
  const denied = 'deny' in ran && !!ran.deny
  const failed = denied || ran.isError === true

  await bump($, (t, hour) => {
    let n = addCall(t, hour, project)
    if (EDIT_TOOLS.has(tool) && !failed) n = { ...n, edits: n.edits + 1 }
    if (cmd && isTestCommand(cmd)) n = { ...n, tests: n.tests + 1, testsFailed: n.testsFailed + (failed ? 1 : 0) }
    if (denied && isPushCommand(cmd)) n = { ...n, pushBlocked: n.pushBlocked + 1 }
    return n
  })

  if (EDIT_TOOLS.has(tool) && !failed) {
    const path = String(input.file_path ?? input.notebook_path ?? '')
    await update($, files, f => addFile(f, path))
    turn.files += 1
  }
  // 셸 명령: 실패하면 한 줄 남기고, 다음 성공 때 지움 (막힌 건 실패로 안 침)
  if (!isSub && SHELL_TOOLS.has(tool) && !denied) {
    await setLive($, { lastFail: ran.isError === true ? failLabel(input, project) : '' })
  }
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    const todos = input.todos as { status: string }[]
    await setLive($, { todoTotal: todos.length, todoDone: todos.filter(x => x.status === 'completed').length })
  }
  if (!isSub && denied && isPushCommand(cmd)) {
    await setLive($, { mood: 'error', activity: ['pushBlocked', ''] })
  }
}

/** cwd가 저장소면 그것만, 아니면 바로 아래 저장소들 ('_'·'.' 폴더 제외) */
async function refreshRepos($: EngineInterface) {
  const { cwd, isRepo } = prefs
  if (!cwd) return
  const dirs = isRepo
    ? [cwd]
    : (await $.fs.list(cwd))
        .filter(d => d.kind === 'dir' && !/^[._]/.test(d.name))
        .map(d => `${cwd}/${d.name}`)
  const found: RepoState[] = []
  for (const dir of dirs) {
    if (!isRepo && !(await $.fs.exists(`${dir}/.git`))) continue
    const r = await $.process
      .run(['git', '-C', dir, 'status', '--porcelain=v1', '-b'], { timeoutMs: 10000 })
      .catch(() => null)
    if (!r || r.exitCode !== 0) continue
    found.push(parseGitStatus(dir.split(/[\\/]/).pop() ?? dir, r.stdout))
  }
  await update($, repos, () => found)
}

let todoSeq = 0

/** 할 일 바꾸고 저장 (끝낸 지 7일 넘은 건 정리). 버튼 처리에서도 불리니 시계는 Date.now() */
async function editTodos($: EngineInterface, f: (t: Todo[], todayKey: string) => Todo[]) {
  const key = dayKey(Date.now())
  let saved: Todo[] = []
  await update($, todos, t => (saved = pruneTodos(f(t, key), key)))
  await $.store.set('todos', saved)
}

/** '내용 / 마감' 한 줄을 읽어 추가 (글에 마감이 없으면 fallbackDue). 결과 안내 문구를 돌려줌 */
async function addTodoNow($: EngineInterface, raw: string, fallbackDue?: string): Promise<string> {
  const L = UI[prefs.lang]
  const r = parseTodoInput(raw, dayKey(Date.now()))
  if (!r.ok) return r.reason === 'due' ? L.dueBad : L.todoEmpty
  const due = r.due ?? fallbackDue
  const id = `${Date.now().toString(36)}${(todoSeq++).toString(36)}`
  await editTodos($, t => addTodo(t, r.text, due, id))
  return `📋 + ${r.text} (${dueLabel(due, dayKey(Date.now()), prefs.lang)})`
}

function toast($: EngineInterface, text: string) {
  // 토스트는 실패해도 그냥 넘어감 (알림 못 띄운다고 할 일 처리가 멈추면 안 됨)
  return quiet(Promise.resolve().then(() => $.ui.toast(text)))
}

/** 패널 입력창: 드롭다운에서 고른 마감으로 추가, 추가하면 드롭다운은 다시 오늘 */
async function submitTodo($: EngineInterface, raw: string) {
  const pick = (await read($, dueUi)).add
  if (pick === 'custom') return void (await toast($, UI[prefs.lang].dueFirst))
  const due = pick === '' ? dayKey(Date.now()) : pick === 'none' ? undefined : pick
  const msg = await addTodoNow($, raw, due)
  if (!msg.startsWith('📋')) return void (await toast($, msg))
  await update($, dueUi, u => ({ ...u, add: '' }))
}

async function pickAddDue($: EngineInterface, v: string) {
  await update($, dueUi, u => ({ ...u, add: v === dayKey(Date.now()) ? '' : v }))
}

async function customAddDue($: EngineInterface, text: string) {
  const due = parseFixedDue(text, dayKey(Date.now()))
  if (!due) return void (await toast($, UI[prefs.lang].fixedBad))
  await update($, dueUi, u => ({ ...u, add: due }))
}

/** 행 드롭다운: '직접 입력'이면 그 행에 날짜 칸을 엶 */
async function pickRowDue($: EngineInterface, id: string, v: string) {
  if (v === 'custom') return void (await update($, dueUi, u => ({ ...u, editing: id })))
  await editTodos($, t => setDue(t, id, v === 'none' ? undefined : v))
  await update($, dueUi, u => ({ ...u, editing: '' }))
}

async function customRowDue($: EngineInterface, id: string, text: string) {
  const due = parseFixedDue(text, dayKey(Date.now()))
  if (!due) return void (await toast($, UI[prefs.lang].fixedBad))
  await pickRowDue($, id, due)
}

/** 기록 실패가 도구 실행을 막지 않게: 오류는 삼킴 */
function quiet(p: Promise<unknown>): Promise<unknown> {
  return p.catch(() => undefined)
}

function pathsIn(input: Record<string, unknown>): string[] {
  return ['file_path', 'path', 'notebook_path', 'command']
    .map(k => input[k])
    .filter((v): v is string => typeof v === 'string')
}

export const register: Register = (on, options) => {
  const opt = (options ?? {}) as Record<string, unknown>

  on('session.start', async ($, e, next) => {
    const claudeLang = await $.settings.read({ key: 'language' }).catch(() => undefined)
    prefs.lang = resolveLang(opt.language, claudeLang)
    prefs.tone = resolveTone(opt.tone)
    prefs.custom = typeof opt.customLines === 'string' ? opt.customLines : ''
    if (typeof opt.protectedBranches === 'string') prefs.protectedBranches = opt.protectedBranches
    void quiet($.session.usage().then(u => setMeter($, u)))
    prefs.cwd = e.cwd
    prefs.isRepo = await $.fs.exists(`${e.cwd}/.git`).catch(() => false)

    const saved = (await $.store.get('today')) as Partial<Today> | undefined
    const key = dayKey(await $.clock.now())
    if (saved && saved.date === key) await update($, today, () => upgradeToday(saved, key))
    const savedWeek = await $.store.get('week')
    if (savedWeek && typeof savedWeek === 'object') await update($, week, () => savedWeek as Record<string, DaySum>)
    const savedTodos = await $.store.get('todos')
    await update($, todos, () => upgradeTodos(savedTodos))
    // 예전 📌 메모 → 오늘 마감 할 일로 한 번 옮김
    const savedMemo = await $.store.get('memo')
    if (typeof savedMemo === 'string' && savedMemo) {
      await editTodos($, (t, k) => addTodo(t, savedMemo, k, `memo${Date.now().toString(36)}`))
      await $.store.set('memo', '')
    }
    void quiet(refreshRepos($))

    await $.command.register({ name: 'nyan', description: UI[prefs.lang].cmdDesc, argumentHint: UI[prefs.lang].memoHint })
    const surfaces = await $.session.surfaces()
    if (surfaces.includes('vscode')) void $.ui.open({ id: PANE, title: UI[prefs.lang].title })
    return next(e)
  })

  on('command.run', { command: 'nyan' }, async ($, e) => {
    const cmd = parseNyanArgs(e.args)
    if (cmd.kind === 'todo') return { text: await addTodoNow($, cmd.text), isTextDisplayOnly: true }
    await update($, isCompact, () => false)
    await $.ui.open({ id: PANE, title: UI[prefs.lang].title })
    return { text: UI[prefs.lang].opened, isTextDisplayOnly: true }
  })

  on('prompt.submit', async ($, e, next) => {
    turn.files = 0
    await quiet(setLive($, { mood: 'working', activity: ['thinking', ''] }))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    await quiet(setMeter($, e))
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const r = await next(e)
    if (r.decision === 'ask' && e.tool_use_id && !e.agentId) {
      await quiet(setLive($, { mood: 'waiting', activity: ['ask', e.tool] }))
      await quiet(bump($, t => ({ ...t, asks: t.asks + 1 })))
    }
    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const project = projectOf(pathsIn(input), prefs.cwd, prefs.isRepo)
    if (!e.agentId) {
      await quiet(setLive($, { mood: 'working', activity: activityOf(e.tool, input), ...(project ? { project } : {}) }))
    }
    const ran = await next(e)
    await quiet(record($, e.tool, !!e.agentId, input, project, ran))
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      await quiet(bump($, t => addUsage({ ...t, activeMs: t.activeMs + e.durationMs }, e.usage)))
      void quiet(refreshRepos($))
      const mood: Mood = e.reason === 'error' ? 'error' : e.isAborted ? 'idle' : 'done'
      const lastTurn = { ms: e.durationMs, files: turn.files, out: e.usage?.output_tokens ?? 0 }
      await quiet(setLive($, mood === 'done' ? { mood, activity: ['', ''], lastTurn } : { mood, lastTurn }))
    }
    return next(e)
  })

  // 터미널·데스크톱: 입력창 위 띠
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface === 'vscode' || e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const l = await read($, live)
    const t = await read($, today)
    const lines = linesFor(prefs.lang, prefs.tone, prefs.custom)
    const where = [l.project, activityText(prefs.lang, l.activity)].filter(Boolean).join(' · ')
    const ctx = (await read($, meter)).contextPct

    return (
      <Box flexDirection="row" gap={1}>
        <Text color={COLOR}>{FACE[l.mood]}</Text>
        <Text>{lines[l.mood]}</Text>
        {where ? <Text dimColor>{where}</Text> : null}
        <Text dimColor>📝{t.edits} 🧪{t.tests} 🛡️{t.pushBlocked} ⏱{fmtDur(prefs.lang, t.activeMs)}</Text>
        {ctx !== null ? <Text color={levelColor(ctx)} dimColor={!levelColor(ctx)}>🧠{ctx}%</Text> : null}
      </Box>
    )
  })

  // 패널: 접힘 = 띠 역할(3줄 + 경고), 펼침 = 머리줄 + 탭(할 일 · 지금 · 통계)
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Svg, Progress, Button, Input, Select } = $.ui.resolve(e)
    const L = UI[prefs.lang]
    const l = await read($, live)
    const t = await read($, today)
    const compact = await read($, isCompact)
    const lines = linesFor(prefs.lang, prefs.tone, prefs.custom)
    const where = [l.project, activityText(prefs.lang, l.activity)].filter(Boolean).join(' · ')
    const dur = fmtDur(prefs.lang, t.activeMs)
    const allRepos = await read($, repos)
    const dirty = allRepos.filter(isDirty)
    const repoText = (r: RepoState) =>
      [r.changes ? `${L.changes} ${r.changes}` : '', r.ahead ? `${L.ahead} ${r.ahead}` : ''].filter(Boolean).join(' · ')
    const branch = allRepos.find(r => r.name === l.project)?.branch ?? ''
    const branchEl = !branch ? null : isProtected(branch, prefs.protectedBranches)
      ? <Text color={WARN}>🌿 {branch} ⚠️</Text>
      : <Text dimColor>🌿 {branch}</Text>
    const m = await read($, meter)
    const now = Date.now()
    const todayKey = dayKey(now)
    const topLimit = m.limits.reduce((a, b) => Math.max(a, b.pct), -1)
    const meterEls = [
      m.contextPct !== null
        ? <Text tabular color={levelColor(m.contextPct)} dimColor={!levelColor(m.contextPct)}>🧠 {m.contextPct}%</Text>
        : null,
      topLimit >= 0
        ? <Text tabular color={levelColor(topLimit)} dimColor={!levelColor(topLimit)}>⏳ {Math.round(topLimit)}%</Text>
        : null,
    ]
    const failEl = l.lastFail ? <Text color={BAD}>❌ {L.failed}: {l.lastFail}</Text> : null
    const sec = todoSections(await read($, todos), todayKey)
    // 정체성: 3줄 고양이 + 주황 테두리 말풍선
    const mascot = (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Box key="cat" flexDirection="column">
          {CAT[l.mood].map(row => <Text mono weight="bold" color={COLOR}>{row}</Text>)}
        </Box>
        <Box key="bubble" borderStyle="round" borderColor={COLOR} paddingX={1}>
          <Text size="heading" weight="semibold">{lines[l.mood]}</Text>
        </Box>
      </Box>
    )

    if (compact) {
      const lateN = sec.dueToday.filter(x => (x.due ?? '') < todayKey).length
      const nextUp = sec.dueToday[0] ?? sec.dueTomorrow[0] ?? sec.rest[0]
      return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          {mascot}
          <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            {where ? <Text dimColor>{where}</Text> : null}
            {branchEl}
            <Button key="expand" label={L.expand} onPress={() => update($, isCompact, () => false)} />
          </Box>
          {nextUp ? (
            <Text weight="semibold" color={COLOR}>
              📋 {L.dueTodayShort} {sec.dueToday.length}
              {lateN ? <Text color={BAD}> (⚠️{L.late} {lateN})</Text> : null}
              {` · ${L.dueTomorrowShort} ${sec.dueTomorrow.length} · ${L.next}: ${nextUp.text}`}
            </Text>
          ) : null}
          <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Text dimColor tabular>
              📝 {t.edits} · 🧪 {t.tests}{t.testsFailed ? ` (❌${t.testsFailed})` : ''} · ⏱ {dur}
            </Text>
            {meterEls}
          </Box>
          {failEl}
          {dirty.length > 0 ? (
            <Text color={WARN}>⚠️ {dirty.slice(0, 2).map(r => `${r.name}: ${repoText(r)}`).join(' / ')}{dirty.length > 2 ? ` +${dirty.length - 2}` : ''}</Text>
          ) : null}
        </Box>
      )
    }

    const current = await read($, tab)
    const tabBtn = (id: string, label: string) => (
      <Button key={`tab-${id}`} label={current === id ? `● ${label}` : label} dimColor={current !== id} onPress={() => update($, tab, () => id)} />
    )
    let body
    if (current === 'now') {
      const changed = topFiles(await read($, files), prefs.cwd, 8)
      body = (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column">
            <Text>{L.now}: {where || lines[l.mood]}</Text>
            {branchEl}
            {l.lastTurn ? <Text dimColor>🔁 {turnRecap(prefs.lang, l.lastTurn)}</Text> : null}
            {failEl}
          </Box>
          {l.todoTotal > 0 ? (
            <Progress label={L.todo} value={l.todoDone} max={l.todoTotal} valueText={`${l.todoDone}/${l.todoTotal}`} color={COLOR} />
          ) : null}
          {m.contextPct !== null || m.limits.length > 0 ? (
            <Box flexDirection="column">
              <Text weight="semibold">{L.meter}</Text>
              {m.contextPct !== null ? (
                <Progress label={L.ctx} value={m.contextPct} max={100} valueText={`${m.contextPct}%`} color={levelColor(m.contextPct) ?? COLOR} />
              ) : null}
              {m.contextPct !== null && m.contextPct >= 90 ? <Text color={BAD}>{L.ctxHint}</Text> : null}
              {m.limits.map(x => {
                const reset = fmtReset(x.resetsAt, now)
                const text = `${Math.round(x.pct)}%${reset ? ` (${L.resets} ${reset})` : ''}`
                return <Progress label={`⏳ ${limitLabel(x.kind, prefs.lang)}`} value={Math.min(x.pct, 100)} max={100} valueText={text} color={levelColor(x.pct) ?? COLOR} />
              })}
            </Box>
          ) : null}
          <Box flexDirection="column">
            <Text weight="semibold">{L.files}</Text>
            {changed.length === 0 ? <Text dimColor>{L.noFiles}</Text> : null}
            {changed.map(f => <Text dimColor>{f.label} <Text color={COLOR}>+{f.count}</Text></Text>)}
          </Box>
          <Box flexDirection="column">
            <Text weight="semibold">{L.repos}</Text>
            {dirty.length === 0 ? <Text dimColor>{L.cleanRepos} ✨</Text> : null}
            {dirty.map(r => <Text><Text weight="semibold">{r.name}</Text> <Text dimColor>({r.branch})</Text> {repoText(r)}</Text>)}
          </Box>
        </Box>
      )
    } else if (current === 'stats') {
      const top = topProjects(t, 4)
      const hist = await read($, week)
      const vs = vsYesterday(prefs.lang, hist, todayKey, t.activeMs)
      body = (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column">
            <Text weight="semibold">{headline(prefs.lang, prefs.tone, dur)}</Text>
            <Text tabular dimColor>
              📝 {L.edits} {t.edits} · 🧪 {L.tests} {t.tests} (✅{t.tests - t.testsFailed} ❌{t.testsFailed}) · 🛡️ {L.pushBlocked} {t.pushBlocked} · 🙋 {L.asks} {t.asks}
            </Text>
          </Box>
          <Box flexDirection="column">
            <Text weight="semibold">{L.chart}</Text>
            <Svg source={chartSvg(t.hourly)} alt={L.chartAlt} />
          </Box>
          <Box flexDirection="column">
            <Text weight="semibold">{L.week}{vs ? <Text dimColor>  {vs}</Text> : null}</Text>
            <Svg source={weekSvg(weekDays(hist, todayKey), prefs.lang)} alt={L.weekAlt} />
          </Box>
          <Box flexDirection="column">
            <Text weight="semibold">{L.projects}</Text>
            {top.length === 0 ? <Text dimColor>{L.none}</Text> : null}
            {top.map(p => (
              <Progress label={p.name} value={p.share} max={1} valueText={`${Math.round(p.share * 100)}%`} color={COLOR} />
            ))}
          </Box>
          <Box flexDirection="column">
            <Text weight="semibold">{L.tokens}</Text>
            <Text tabular dimColor>
              {L.tokIn} {fmtTokens(t.tokensIn)} · {L.tokCached} {fmtTokens(t.tokensCached)} · {L.tokOut} {fmtTokens(t.tokensOut)}
            </Text>
          </Box>
        </Box>
      )
    } else {
      const ui = await read($, dueUi)
      const addValue = ui.add === '' ? todayKey : ui.add
      const top = topProjects(t, 4)
      const autoDone = [top.map(p => p.name).join(' · '), t.activeMs ? dur : ''].filter(Boolean).join(' · ')
      const edit = (key: string, label: string, f: (x: Todo[], k: string) => Todo[], dim = false) =>
        <Button key={key} label={label} plain dimColor={dim} onPress={() => editTodos($, f)} />
      body = (
        <Box flexDirection="column" gap={1}>
          {[
            { icon: '🔥', title: L.dueToday, items: sec.dueToday },
            { icon: '🌙', title: L.dueTomorrow, items: sec.dueTomorrow },
            { icon: '📋', title: L.dueRest, items: sec.rest },
          ].map(g => g.items.length === 0 ? null : (
            <Box key={`sec-${g.icon}`} flexDirection="column">
              <Text weight="semibold">{g.icon} {g.title} ({g.items.length})</Text>
              {g.items.map(x => {
                // 날짜는 드롭다운이 보여주니, 글자는 마감 지난 경고만
                const late = !!x.due && x.due < todayKey
                return (
                  <Box key={`todo-${x.id}`} flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
                    {edit(`check-${x.id}`, '☐', (arr, k) => completeTodo(arr, x.id, k))}
                    <Text>{x.text}</Text>
                    {late ? <Text color={BAD}>{dueLabel(x.due, todayKey, prefs.lang)}</Text> : null}
                    <Select key={`due-${x.id}`} options={dueOptions(todayKey, prefs.lang, x.due)} value={ui.editing === x.id ? 'custom' : x.due ?? 'none'} onSelect={v => pickRowDue($, x.id, v)} />
                    {ui.editing === x.id ? (
                      <Input key={`due-custom-${x.id}`} placeholder={L.customPh} submitLabel={L.add} onSubmit={v => customRowDue($, x.id, v)} />
                    ) : null}
                    {edit(`del-${x.id}`, '✕', arr => removeTodo(arr, x.id), true)}
                  </Box>
                )
              })}
            </Box>
          ))}
          <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Input key="todo-add" placeholder={L.addTodo} submitLabel={L.add} onSubmit={v => submitTodo($, v)} />
            <Select key="todo-due" options={dueOptions(todayKey, prefs.lang, ui.add === 'custom' ? undefined : addValue)} value={addValue} onSelect={v => pickAddDue($, v)} />
            {ui.add === 'custom' ? (
              <Input key="todo-due-custom" placeholder={L.customPh} submitLabel={L.add} onSubmit={v => customAddDue($, v)} />
            ) : null}
          </Box>
          <Box flexDirection="column">
            <Text weight="semibold">✅ {L.doneToday} ({sec.doneToday.length})</Text>
            {sec.doneToday.map(x => (
              <Box key={`todo-${x.id}`} flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
                {edit(`uncheck-${x.id}`, '☑', a => undoTodo(a, x.id))}
                <Text dimColor>{x.text}</Text>
              </Box>
            ))}
            {autoDone ? <Text dimColor>🐾 {L.auto}: {autoDone}</Text> : null}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1} paddingX={2} paddingY={1}>
        {mascot}
        <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
          {meterEls}
          <Button key="collapse" label={L.collapse} onPress={() => update($, isCompact, () => true)} />
        </Box>
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          {tabBtn('todo', L.tabTodo)}
          {tabBtn('now', L.tabNow)}
          {tabBtn('stats', L.tabStats)}
        </Box>
        {body}
      </Box>
    )
  })
}
