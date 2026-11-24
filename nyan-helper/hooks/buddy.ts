// 순수 계산만 (화면·엔진 호출 없음) → buddy.test.tsx로 검증
import type { DaySum, Lang, Todo, Live, Mood, RepoState, Today, Tone } from '../types'

// ── 고양이 표정 ─────────────────────────────────────────
export const FACE: Record<Mood, string> = {
  idle: '(=^･ω･^=)',
  working: '(=^•ω•^)ﾉ⌨',
  waiting: '(=^･ｪ･^=)?',
  done: '(=^▽^=)✨',
  error: '(=;ω;=)',
}

/** 패널용 3줄 고양이 (귀는 같고 표정·발만 바뀜). 줄맞춤 위해 ASCII + ω만 */
export const CAT: Record<Mood, [string, string, string]> = {
  idle: [' /\\_/\\ ', '( -ω- )', ' > z < '],
  working: [' /\\_/\\ ', '( oωo )', ' > ~ < '],
  waiting: [' /\\_/\\ ', '( .ω. )', ' > ? < '],
  done: [' /\\_/\\ ', '( ^ω^ )', ' > * < '],
  error: [' /\\_/\\ ', '( ;ω; )', ' > _ < '],
}

// ── 말투별 한 줄 ────────────────────────────────────────
const LINES: Record<Lang, Record<Exclude<Tone, 'custom'>, Record<Mood, string>>> = {
  ko: {
    nyan: {
      idle: '쉬는 중이다냥~',
      working: '열심히 일하는 중이다냥!',
      waiting: '집사 확인 기다린다냥…',
      done: '다 했다냥! 확인해달라냥',
      error: '앗, 막혔다냥…',
    },
    gyaru: {
      idle: '대기 중~',
      working: '열일 중…💅',
      waiting: '확인 기다리는 중!',
      done: '다 했어요! 확인해줘요 ✨',
      error: '앗 막혔어요…',
    },
    plain: { idle: '대기', working: '작업 중', waiting: '승인 대기', done: '완료', error: '문제 발생' },
  },
  en: {
    nyan: {
      idle: 'Napping, nya~',
      working: 'Working hard, nya!',
      waiting: 'Waiting for you, nya…',
      done: 'All done, nya! Take a look',
      error: 'Uh oh, stuck, nya…',
    },
    gyaru: {
      idle: 'Chillin~',
      working: 'Slaying it…💅',
      waiting: 'Need your OK, bestie!',
      done: 'Done! Check it out ✨',
      error: 'Ugh, blocked…',
    },
    plain: { idle: 'Idle', working: 'Working', waiting: 'Awaiting approval', done: 'Done', error: 'Problem' },
  },
}

/** custom 문장 순서: 작업중|대기|완료|막힘|허락대기 */
const CUSTOM_ORDER: Mood[] = ['working', 'idle', 'done', 'error', 'waiting']

export function linesFor(lang: Lang, tone: Tone, custom: string): Record<Mood, string> {
  const base = LINES[lang][tone === 'custom' ? 'nyan' : tone]
  if (tone !== 'custom') return base
  const parts = custom.split('|').map(s => s.trim())
  return Object.fromEntries(
    CUSTOM_ORDER.map((m, i) => [m, parts[i] || base[m]]),
  ) as Record<Mood, string>
}

// ── 화면 글자 ───────────────────────────────────────────
export const UI = {
  ko: {
    title: '🐾 작업냥', now: '지금', chart: '⏱ 시간대별 작업량', projects: '📂 프로젝트별 비중',
    none: '아직 기록이 없어요', did: '🔧 오늘 한 일', edits: '파일 수정', tests: '테스트',
    pushBlocked: '푸시 막힘', asks: '허락 요청', todo: '🐾 Claude 진행', expand: '펼치기', collapse: '접기',
    cmdDesc: '작업냥 패널 펼치기 (토큰 0)', opened: '🐾 작업냥 펼쳤어요',
    chartAlt: '오늘 8시부터 21시까지 시간대별 도구 실행 횟수 막대 차트',
    files: '📄 이번 대화에서 바뀐 파일', noFiles: '아직 바뀐 파일 없음',
    repos: '⚠️ 정리 안 된 저장소', cleanRepos: '전부 깨끗해요',
    changes: '수정', ahead: '푸시 안 함', tokens: '🪙 오늘 토큰',
    tokIn: '입력', tokCached: '캐시', tokOut: '출력',
    meter: '🧠 대화·한도', ctx: '대화 기억 공간', ctxHint: '거의 찼어요. 새 대화를 여는 걸 추천해요',
    resets: '리셋', failed: '실패', justNow: '방금',
    week: '📅 최근 7일', weekAlt: '최근 7일 요일별 작업 시간 막대 차트',
    memoHint: '[todo 내용 / 마감]',
    dueToday: '오늘까지', dueTomorrow: '내일까지', dueRest: '나머지', doneToday: '오늘 한 일',
    dueTodayShort: '오늘까지', dueTomorrowShort: '내일까지', next: '다음', late: '지남',
    tabTodo: '📋 할 일', tabNow: '⚡ 지금', tabStats: '📊 통계', duePick: '마감', addTodo: '＋ 할 일 내용 (Enter로 추가)', customPh: 'MM/DD (예: 12/25)', add: '추가', auto: '자동 기록',
    fixedBad: 'MM/DD 형식으로 써주세요 (예: 12/25)', dueFirst: '직접 입력 칸에 날짜를 먼저 넣어주세요',
    dueBad: '마감 형식을 못 읽었어요. 오늘·내일·모레, 11/28, 금, +3 처럼 써주세요 (앞뒤로 띄어서 " / ")',
    todoEmpty: '할 일 내용이 비어 있어요',
  },
  en: {
    title: '🐾 Work Nyan', now: 'Now', chart: '⏱ Activity by hour', projects: '📂 By project',
    none: 'No activity yet', did: '🔧 Today', edits: 'Edits', tests: 'Tests',
    pushBlocked: 'Pushes blocked', asks: 'Approvals', todo: '🐾 Claude progress', expand: 'Expand', collapse: 'Collapse',
    cmdDesc: 'Expand the Work Nyan panel (0 tokens)', opened: '🐾 Work Nyan expanded',
    chartAlt: 'Bar chart of tool calls per hour today, 8 to 21',
    files: '📄 Files changed this session', noFiles: 'No files changed yet',
    repos: '⚠️ Repos with loose ends', cleanRepos: 'All clean',
    changes: 'changed', ahead: 'unpushed', tokens: '🪙 Tokens today',
    tokIn: 'in', tokCached: 'cached', tokOut: 'out',
    meter: '🧠 Context & limits', ctx: 'Context', ctxHint: 'Almost full. Consider starting a new chat',
    resets: 'resets', failed: 'failed', justNow: 'Last turn',
    week: '📅 Last 7 days', weekAlt: 'Bar chart of active time per day, last 7 days',
    memoHint: '[todo text / due]',
    dueToday: 'Due today', dueTomorrow: 'Due tomorrow', dueRest: 'Later', doneToday: 'Done today',
    dueTodayShort: 'today', dueTomorrowShort: 'tomorrow', next: 'next', late: 'late',
    tabTodo: '📋 Todo', tabNow: '⚡ Now', tabStats: '📊 Stats', duePick: 'Due', addTodo: '＋ Todo (Enter to add)', customPh: 'MM/DD (e.g. 12/25)', add: 'add', auto: 'Auto log',
    fixedBad: 'Use MM/DD (e.g. 12/25)', dueFirst: 'Enter the date in the custom field first',
    dueBad: 'Could not read the due date. Try today, tomorrow, 11/28, +3 (with spaces around " / ")',
    todoEmpty: 'The todo text is empty',
  },
} as const

const HEADLINE: Record<Lang, Record<Exclude<Tone, 'custom'>, (d: string) => string>> = {
  ko: {
    nyan: d => `오늘 ${d} 같이 일했다냥 🐾`,
    gyaru: d => `오늘 ${d} 같이 일했어요 ✨`,
    plain: d => `오늘 작업 시간 ${d}`,
  },
  en: {
    nyan: d => `We worked ${d} today, nya 🐾`,
    gyaru: d => `${d} of grinding today ✨`,
    plain: d => `Active today: ${d}`,
  },
}

export function headline(lang: Lang, tone: Tone, dur: string): string {
  return HEADLINE[lang][tone === 'custom' ? 'nyan' : tone](dur)
}

const ACT: Record<Lang, Record<string, (t: string) => string>> = {
  ko: {
    edit: t => `${t} 수정 중`, read: t => `${t} 읽는 중`, cmd: () => '명령 실행 중', say: t => t,
    search: () => '코드 찾는 중', agent: () => '도우미 출동 중', web: () => '웹 찾아보는 중',
    todo: () => '할 일 정리 중', tool: t => `${t} 쓰는 중`, thinking: () => '생각 중…',
    ask: t => `${t} 허락 기다리는 중`, pushBlocked: () => '푸시 막혔어요 🛡️',
  },
  en: {
    edit: t => `editing ${t}`, read: t => `reading ${t}`, cmd: () => 'running a command', say: t => t,
    search: () => 'searching code', agent: () => 'sub-agent on it', web: () => 'browsing the web',
    todo: () => 'updating todos', tool: t => `using ${t}`, thinking: () => 'thinking…',
    ask: t => `waiting to run ${t}`, pushBlocked: () => 'push blocked 🛡️',
  },
}

export function activityText(lang: Lang, a: Live['activity']): string {
  const f = ACT[lang][a[0]]
  return f ? f(a[1]) : ''
}

// ── 설정 해석 ───────────────────────────────────────────
/** 플러그인 옵션 → Claude language 설정 → 한국어 */
export function resolveLang(option: unknown, claudeLanguage: unknown): Lang {
  if (option === 'ko' || option === 'en') return option
  const s = typeof claudeLanguage === 'string' ? claudeLanguage.trim() : ''
  if (/^(en|eng|english)\b/i.test(s)) return 'en'
  return 'ko'
}

export function resolveTone(option: unknown): Tone {
  return option === 'gyaru' || option === 'plain' || option === 'custom' ? option : 'nyan'
}

// ── 날짜·시간 (로컬 시간대) ─────────────────────────────
export function dayKey(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function hourOf(ms: number): number {
  return new Date(ms).getHours()
}

export function fmtDur(lang: Lang, ms: number): string {
  const min = Math.round(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (lang === 'en') return h ? `${h}h ${m}m` : `${m}m`
  return h ? `${h}시간 ${m}분` : `${m}분`
}

// ── 프로젝트 판별 ───────────────────────────────────────
const norm = (p: string) =>
  p.replace(/\\/g, '/').replace(/^\/([a-z])\//i, '$1:/').replace(/\/+$/, '').toLowerCase()

export const baseName = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''

/**
 * cwd가 git 저장소면 → cwd 폴더 이름.
 * 아니면(여러 저장소를 담은 작업 폴더) → 경로에서 cwd 바로 아래 폴더 이름.
 * '_'로 시작하는 보관 폴더(_archive 등)는 한 단계 더 들어가고, '.' 폴더는 무시.
 */
export function projectOf(texts: string[], cwd: string, cwdIsRepo: boolean): string | null {
  if (!cwd) return null
  if (cwdIsRepo) return baseName(cwd)
  const root = norm(cwd) + '/'
  for (const raw of texts) {
    const s = raw.replace(/\\/g, '/').replace(/(^|[\s"'=])\/([a-z])\//gi, '$1$2:/')
    const i = s.toLowerCase().indexOf(root)
    if (i < 0) continue
    const rest = s.slice(i + root.length).split(/["'\r\n]/)[0]
    const segs = rest.split('/')
    // 마지막 칸은 확장자가 없을 때만 폴더로 봄 (cd "…/billing" 같은 경우)
    const last = segs.length - 1
    const usable = /\.[A-Za-z0-9]+\s*$/.test(segs[last]) ? last : last + 1
    for (let k = 0; k < usable; k++) {
      const seg = segs[k].trim()
      if (!seg || seg.startsWith('.')) break
      if (seg.startsWith('_')) continue
      return seg
    }
  }
  return null
}

export function isTestCommand(cmd: string): boolean {
  return /\b(npm (run )?test|pnpm test|yarn test|pytest|node --test|vitest|jest|go test|cargo test)\b|\.test\.ps1/.test(cmd)
}

export function isPushCommand(cmd: string): boolean {
  return /\bgit\s+(?:-C\s+(?:"[^"]*"|'[^']*'|\S+)\s+)*push\b/.test(cmd)
}

export function activityOf(tool: string, input: Record<string, unknown>): Live['activity'] {
  switch (tool) {
    case 'Edit': case 'Write': case 'NotebookEdit':
      return ['edit', baseName(String(input.file_path ?? input.notebook_path ?? ''))]
    case 'Read':
      return ['read', baseName(String(input.file_path ?? ''))]
    case 'Bash': case 'PowerShell':
      return typeof input.description === 'string' && input.description
        ? ['say', input.description.slice(0, 40)]
        : ['cmd', '']
    case 'Grep': case 'Glob': return ['search', '']
    case 'Agent': return ['agent', '']
    case 'WebSearch': case 'WebFetch': return ['web', '']
    case 'TodoWrite': return ['todo', '']
    default: return ['tool', tool.split('__').pop() ?? tool]
  }
}

// ── 통계 (새 객체로 돌려줌) ─────────────────────────────
export function emptyToday(date: string): Today {
  return {
    date, activeMs: 0, edits: 0, tests: 0, testsFailed: 0, pushBlocked: 0, asks: 0,
    hourly: new Array(24).fill(0), projects: {},
    tokensIn: 0, tokensCached: 0, tokensOut: 0,
  }
}

/** 예전 버전이 저장한 값에 새 칸 채우기 */
export function upgradeToday(saved: Partial<Today>, date: string): Today {
  return { ...emptyToday(date), ...saved, date }
}

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export function addUsage(t: Today, u: Usage | undefined): Today {
  if (!u) return t
  return {
    ...t,
    tokensIn: t.tokensIn + (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    tokensCached: t.tokensCached + (u.cache_read_input_tokens ?? 0),
    tokensOut: t.tokensOut + (u.output_tokens ?? 0),
  }
}

export function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`
  return String(n)
}

// ── 바뀐 파일 ───────────────────────────────────────────
export function addFile(files: Record<string, number>, path: string): Record<string, number> {
  return path ? { ...files, [path]: (files[path] ?? 0) + 1 } : files
}

/** 많이 고친 순, 표시는 cwd 기준 상대경로 */
export function topFiles(files: Record<string, number>, cwd: string, n: number): { label: string; count: number }[] {
  const root = norm(cwd) + '/'
  return Object.entries(files)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([p, count]) => {
      const np = p.replace(/\\/g, '/')
      const rel = cwd && np.toLowerCase().startsWith(root) ? np.slice(root.length) : baseName(p)
      return { label: rel, count }
    })
}

// ── git 상태 ────────────────────────────────────────────
/** `git status --porcelain=v1 -b` 출력 → 브랜치·수정 수·푸시 안 한 커밋 수 */
export function parseGitStatus(name: string, stdout: string): RepoState {
  const lines = stdout.split(/\r?\n/).filter(Boolean)
  const head = lines[0]?.startsWith('## ') ? lines.shift()!.slice(3) : ''
  const branch = head.split('...')[0].replace(/^No commits yet on /, '').trim()
  const ahead = Number(/\bahead (\d+)/.exec(head)?.[1] ?? 0)
  return { name, branch, changes: lines.length, ahead }
}

export const isDirty = (r: RepoState) => r.changes > 0 || r.ahead > 0

/** 쉼표로 구분한 운영 브랜치 목록에 들어 있나 */
export function isProtected(branch: string, list: string): boolean {
  return !!branch && list.split(',').map(s => s.trim()).filter(Boolean).includes(branch)
}

// ── 기억 공간·한도·방금 작업 ────────────────────────────
/** 80%↑ 주황, 90%↑ 빨강, 그 아래는 undefined(기본색) */
export function levelColor(pct: number): string | undefined {
  return pct >= 90 ? '#E5534B' : pct >= 80 ? '#E0A23B' : undefined
}

export function limitLabel(kind: string, lang: Lang): string {
  const names: Record<string, [string, string]> = {
    five_hour: ['5시간', '5h'], seven_day: ['7일', '7d'], spend_limit: ['지출', 'spend'],
  }
  return names[kind]?.[lang === 'ko' ? 0 : 1] ?? kind
}

/** 리셋 시각: 오늘이면 18:00, 다른 날이면 11/27 (로컬 시간) */
export function fmtReset(iso: string | undefined, nowMs: number): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return dayKey(d.getTime()) === dayKey(nowMs)
    ? `${p(d.getHours())}:${p(d.getMinutes())}`
    : `${d.getMonth() + 1}/${d.getDate()}`
}

/** 초 단위까지: 14초 / 2분 14초 */
export function fmtSpan(lang: Lang, ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  if (lang === 'en') return m ? `${m}m ${s % 60}s` : `${s}s`
  return m ? `${m}분 ${s % 60}초` : `${s}초`
}

export function turnRecap(lang: Lang, t: NonNullable<Live['lastTurn']>): string {
  const files = lang === 'ko' ? `파일 ${t.files}개` : `${t.files} files`
  return `${UI[lang].justNow}: ${fmtSpan(lang, t.ms)} · ${files} · ${UI[lang].tokOut} ${fmtTokens(t.out)}`
}

/** 실패 줄에 쓸 짧은 설명: 설명이 있으면 설명, 없으면 명령 앞부분 */
export function failLabel(input: Record<string, unknown>, project: string | null): string {
  const desc = typeof input.description === 'string' && input.description ? input.description : ''
  const cmd = typeof input.command === 'string' ? input.command.split(/\r?\n/)[0] : ''
  const text = (desc || cmd).slice(0, 50)
  return project ? `${text} (${project})` : text
}

export function addCall(t: Today, hour: number, project: string | null): Today {
  const hourly = t.hourly.map((n, h) => (h === hour ? n + 1 : n))
  const projects = project ? { ...t.projects, [project]: (t.projects[project] ?? 0) + 1 } : t.projects
  return { ...t, hourly, projects }
}

export function topProjects(t: Today, n: number): { name: string; share: number }[] {
  const total = Object.values(t.projects).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return Object.entries(t.projects)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, c]) => ({ name, share: c / total }))
}

/** 08~21시 막대 차트 SVG */
export function chartSvg(hourly: number[]): string {
  const from = 8, to = 21, bw = 18, gap = 4, h = 70, top = 6
  const max = Math.max(1, ...hourly.slice(from, to + 1))
  const parts: string[] = []
  for (let hr = from; hr <= to; hr++) {
    const x = (hr - from) * (bw + gap)
    const bh = Math.round((hourly[hr] / max) * h)
    parts.push(`<rect x="${x}" y="${top + h - bh}" width="${bw}" height="${bh}" rx="3" fill="#D97757"/>`)
    if (hr % 2 === 0) {
      parts.push(`<text x="${x + bw / 2}" y="${top + h + 14}" font-size="10" text-anchor="middle" fill="#9a8f86" font-family="sans-serif">${hr}</text>`)
    }
  }
  const w = (to - from + 1) * (bw + gap)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${top + h + 18}" width="${w}" height="${top + h + 18}">${parts.join('')}</svg>`
}

// ── /nyan 명령 ──────────────────────────────────────────
export type NyanArgs = { kind: 'open' } | { kind: 'todo'; text: string }

/** '' → 펼치기, 'todo 글'·'memo 글' → 할 일 추가 (글 = '내용 / 마감') */
export function parseNyanArgs(args: string): NyanArgs {
  const m = /^(todo|memo)\s+([\s\S]+)$/i.exec(args.trim())
  return m ? { kind: 'todo', text: m[2].trim() } : { kind: 'open' }
}

// ── 할 일 목록 (마감 기준, 섹션은 그릴 때 계산) ─────────
const TODO_MAX = 80
const KO_WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function validDay(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dayKey(dt.getTime()) : null
}

/** 오늘·내일·모레 · 11/28 · 11-28 · 2026-11-28 · 금(요일) · +3 → 'YYYY-MM-DD', 못 읽으면 null */
export function parseDue(raw: string, todayKey: string): string | null {
  const s = raw.trim()
  const rel: Record<string, number> = { 오늘: 0, 내일: 1, 모레: 2, today: 0, tomorrow: 1 }
  if (s.toLowerCase() in rel) return shiftDay(todayKey, rel[s.toLowerCase()])
  const plus = /^\+(\d{1,3})$/.exec(s)
  if (plus) return shiftDay(todayKey, Number(plus[1]))
  const full = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (full) return validDay(Number(full[1]), Number(full[2]), Number(full[3]))
  const md = /^(\d{1,2})[/-](\d{1,2})$/.exec(s)
  if (md) {
    const thisYear = validDay(Number(todayKey.slice(0, 4)), Number(md[1]), Number(md[2]))
    if (!thisYear || thisYear >= todayKey) return thisYear
    return validDay(Number(todayKey.slice(0, 4)) + 1, Number(md[1]), Number(md[2]))
  }
  const wd = /^([일월화수목금토])(요일)?$/.exec(s)
  if (wd) {
    const [y, m, d] = todayKey.split('-').map(Number)
    const diff = (KO_WEEKDAY.indexOf(wd[1]) - new Date(y, m - 1, d).getDay() + 7) % 7
    return shiftDay(todayKey, diff)
  }
  return null
}

export type TodoInput = { ok: true; text: string; due?: string } | { ok: false; reason: 'empty' | 'due' }

/** '내용 / 마감' (앞뒤 띄어쓴 마지막 / 가 구분자). 마감 없으면 그냥 내용 */
export function parseTodoInput(raw: string, todayKey: string): TodoInput {
  const m = /^([\s\S]*?)\s+\/\s+(\S[\s\S]*)$/.exec(` ${raw.trim()}`)
  const text = (m ? m[1] : raw).trim().slice(0, TODO_MAX)
  if (!text) return { ok: false, reason: 'empty' }
  if (!m) return { ok: true, text }
  const due = parseDue(m[2], todayKey)
  return due ? { ok: true, text, due } : { ok: false, reason: 'due' }
}

export function addTodo(todos: Todo[], text: string, due: string | undefined, id: string): Todo[] {
  const t = text.trim().slice(0, TODO_MAX)
  return t ? [...todos, due ? { id, text: t, due } : { id, text: t }] : todos
}

function patchTodo(todos: Todo[], id: string, f: (t: Todo) => Todo): Todo[] {
  return todos.map(t => (t.id === id ? f(t) : t))
}

export const completeTodo = (todos: Todo[], id: string, todayKey: string) => patchTodo(todos, id, t => ({ ...t, doneOn: todayKey }))
export const undoTodo = (todos: Todo[], id: string) => patchTodo(todos, id, ({ doneOn: _, ...t }) => t)
export const setDue = (todos: Todo[], id: string, due: string | undefined) =>
  patchTodo(todos, id, ({ due: _, ...t }) => (due ? { ...t, due } : t))
export const removeTodo = (todos: Todo[], id: string) => todos.filter(t => t.id !== id)

function daysBetween(from: string, to: string): number {
  const ms = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
  return Math.round((ms(to) - ms(from)) / 864e5)
}

/** 마감순(마감 없음은 맨 끝, 같으면 먼저 쓴 것 먼저)으로 오늘까지(지난 것 포함) · 내일까지 · 나머지 · 오늘 끝낸 것 */
export function todoSections(todos: Todo[], todayKey: string) {
  const tomorrow = shiftDay(todayKey, 1)
  const open = todos
    .filter(t => !t.doneOn)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.due ?? '9999').localeCompare(b.t.due ?? '9999') || a.i - b.i)
    .map(x => x.t)
  return {
    dueToday: open.filter(t => t.due && t.due <= todayKey),
    dueTomorrow: open.filter(t => t.due === tomorrow),
    rest: open.filter(t => !t.due || t.due > tomorrow),
    doneToday: todos.filter(t => t.doneOn === todayKey),
  }
}

/** '⚠️ 2일 지남' · '오늘' · '내일' · '11/28 (D-4)' · '마감 없음' */
export function dueLabel(due: string | undefined, todayKey: string, lang: Lang): string {
  const ko = lang === 'ko'
  if (!due) return ko ? '마감 없음' : 'no due'
  const n = daysBetween(todayKey, due)
  if (n < 0) return ko ? `⚠️ ${-n}일 지남` : `⚠️ ${-n}d late`
  if (n === 0) return ko ? '오늘' : 'today'
  if (n === 1) return ko ? '내일' : 'tomorrow'
  return `${Number(due.slice(5, 7))}/${Number(due.slice(8))} (D-${n})`
}

const DUE_SPAN = 14

function mdLabel(key: string, lang: Lang): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${m}/${d} (${WEEKDAY[lang][new Date(y, m - 1, d).getDay()]})`
}

/** 마감 드롭다운: 오늘~2주 뒤 + 마감 없음 + 직접 입력. 지금 마감이 목록 밖이면 맨 위에 붙임 */
export function dueOptions(todayKey: string, lang: Lang, current?: string): { value: string; label: string }[] {
  const ko = lang === 'ko'
  const days = Array.from({ length: DUE_SPAN + 1 }, (_, i) => {
    const key = shiftDay(todayKey, i)
    const pre = i === 0 ? (ko ? '오늘 ' : 'Today ') : i === 1 ? (ko ? '내일 ' : 'Tmrw ') : ''
    return { value: key, label: pre + mdLabel(key, lang) }
  })
  const extra = current && /^\d{4}-/.test(current) && !days.some(d => d.value === current)
    ? [{ value: current, label: mdLabel(current, lang) + (current < todayKey ? ' ⚠️' : '') }]
    : []
  return [
    ...extra, ...days,
    { value: 'none', label: ko ? '마감 없음' : 'No due' },
    { value: 'custom', label: ko ? '직접 입력…' : 'Pick date…' },
  ]
}

/** 직접 입력은 MM/DD 형식만 (지난 날짜는 내년) */
export function parseFixedDue(raw: string, todayKey: string): string | null {
  const s = raw.trim()
  return /^\d{1,2}\/\d{1,2}$/.test(s) ? parseDue(s, todayKey) : null
}

/** 저장값 읽기: v1의 day → due, 모양 틀린 건 버림 */
export function upgradeTodos(raw: unknown): Todo[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(x => {
    if (!x || typeof x !== 'object') return []
    const o = x as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.text !== 'string') return []
    const due = typeof o.due === 'string' ? o.due : typeof o.day === 'string' ? o.day : undefined
    return [{ id: o.id, text: o.text, ...(due ? { due } : {}), ...(typeof o.doneOn === 'string' ? { doneOn: o.doneOn } : {}) }]
  })
}

/** 끝낸 지 7일 넘은 것만 정리 (안 끝난 건 그대로) */
export function pruneTodos(todos: Todo[], todayKey: string): Todo[] {
  const cut = shiftDay(todayKey, -KEEP_DAYS)
  return todos.filter(t => !t.doneOn || t.doneOn >= cut)
}

// ── 최근 7일 ────────────────────────────────────────────
const KEEP_DAYS = 7

/** 오늘 요약을 넣고 최근 7일만 남김 (날짜 문자열은 정렬하면 시간순) */
export function rememberDay(hist: Record<string, DaySum>, t: Today): Record<string, DaySum> {
  const next = { ...hist, [t.date]: { activeMs: t.activeMs, edits: t.edits, tests: t.tests } }
  return Object.fromEntries(Object.keys(next).sort().slice(-KEEP_DAYS).map(k => [k, next[k]]))
}

function shiftDay(key: string, by: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + by).getTime())
}

/** 오늘 포함 7칸 (기록 없는 날은 0) */
export function weekDays(hist: Record<string, DaySum>, todayKey: string): ({ date: string } & DaySum)[] {
  return Array.from({ length: KEEP_DAYS }, (_, i) => {
    const date = shiftDay(todayKey, i - KEEP_DAYS + 1)
    return { date, ...(hist[date] ?? { activeMs: 0, edits: 0, tests: 0 }) }
  })
}

const WEEKDAY: Record<Lang, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
}

/** 요일별 작업 시간 막대 (마지막 칸 = 오늘, 진하게) */
export function weekSvg(days: ({ date: string } & DaySum)[], lang: Lang): string {
  const bw = 30, gap = 10, h = 60, top = 14
  const max = Math.max(1, ...days.map(d => d.activeMs))
  const parts = days.map((d, i) => {
    const x = i * (bw + gap)
    const bh = Math.round((d.activeMs / max) * h)
    const [y, m, dd] = d.date.split('-').map(Number)
    const wd = WEEKDAY[lang][new Date(y, m - 1, dd).getDay()]
    const hrs = d.activeMs ? `${Math.round(d.activeMs / 360e3) / 10}h` : ''
    const opacity = i === days.length - 1 ? 1 : 0.55
    return `<rect x="${x}" y="${top + h - bh}" width="${bw}" height="${bh}" rx="3" fill="#D97757" fill-opacity="${opacity}"/>`
      + `<text x="${x + bw / 2}" y="${top + h - bh - 3}" font-size="9" text-anchor="middle" fill="#9a8f86" font-family="sans-serif">${hrs}</text>`
      + `<text x="${x + bw / 2}" y="${top + h + 14}" font-size="10" text-anchor="middle" fill="#9a8f86" font-family="sans-serif">${wd}</text>`
  })
  const w = days.length * (bw + gap)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${top + h + 18}" width="${w}" height="${top + h + 18}">${parts.join('')}</svg>`
}

/** '어제보다 +40분' / '-30m vs yesterday', 어제 기록 없으면 '' */
export function vsYesterday(lang: Lang, hist: Record<string, DaySum>, todayKey: string, todayMs: number): string {
  const y = hist[shiftDay(todayKey, -1)]
  if (!y) return ''
  const diff = todayMs - y.activeMs
  const sign = diff >= 0 ? '+' : '-'
  const d = `${sign}${fmtDur(lang, Math.abs(diff))}`
  return lang === 'en' ? `${d} vs yesterday` : `어제보다 ${d}`
}
