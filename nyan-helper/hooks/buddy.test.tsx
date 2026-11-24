import { expect, test } from 'claude-code/testing'

import {
  CAT, activityOf, activityText, addCall, addFile, addUsage, chartSvg, dayKey, emptyToday, failLabel,
  fmtDur, fmtReset, fmtSpan, fmtTokens, headline, hourOf, isDirty, isProtected, isPushCommand,
  isTestCommand, levelColor, limitLabel, linesFor, parseGitStatus, parseNyanArgs, projectOf,
  rememberDay, resolveLang, resolveTone, topFiles, topProjects, turnRecap, upgradeToday,
  vsYesterday, weekDays, weekSvg,
  addTodo, completeTodo, dueLabel, dueOptions, parseDue, parseFixedDue, parseTodoInput, pruneTodos, removeTodo, setDue,
  todoSections, undoTodo, upgradeTodos,
} from './buddy'

test('settings: language and tone resolution', async () => {
  expect(resolveLang('en', 'korean')).toBe('en') // 플러그인 옵션이 우선
  expect(resolveLang('auto', 'English')).toBe('en') // Claude 설정
  expect(resolveLang('auto', 'japanese')).toBe('ko') // 모르는 언어 → 기본 한국어
  expect(resolveLang(undefined, undefined)).toBe('ko')
  expect(resolveTone(undefined)).toBe('nyan')
  expect(resolveTone('plain')).toBe('plain')

  expect(linesFor('ko', 'nyan', '').working).toBe('열심히 일하는 중이다냥!')
  expect(linesFor('en', 'plain', '').done).toBe('Done')
  const custom = linesFor('ko', 'custom', '달린다|쉰다|끝!|헉')
  expect(custom.working).toBe('달린다')
  expect(custom.error).toBe('헉')
  expect(custom.waiting).toBe('집사 확인 기다린다냥…') // 빈 칸은 냥체로
  expect(headline('ko', 'nyan', '3분')).toBe('오늘 3분 같이 일했다냥 🐾')
})

test('project detection: workspace of repos vs single repo', async () => {
  const ws = 'C:\\Users\\me\\work'
  expect(projectOf(['C:\\Users\\me\\work\\shop-api\\src\\a.ts'], ws, false)).toBe('shop-api')
  expect(projectOf(['cd "/c/Users/me/work/billing" && npm test'], ws, false)).toBe('billing')
  expect(projectOf(['C:/Users/me/work/_archive/old-app/README.md'], ws, false)).toBe('old-app')
  expect(projectOf(['C:/Users/me/work/.claude/settings.json'], ws, false)).toBe(null)
  expect(projectOf(['C:/Users/me/work/notes.md'], ws, false)).toBe(null) // 파일은 프로젝트 아님
  expect(projectOf(['anything'], 'C:\\Users\\me\\shop-api', true)).toBe('shop-api')
})

test('pure: time, commands, activity, counters, chart', async () => {
  const ms = new Date(2026, 10, 24, 0, 30).getTime()
  expect(dayKey(ms)).toBe('2026-11-24')
  expect(hourOf(ms)).toBe(0)
  expect(fmtDur('ko', 3 * 3600e3 + 12 * 60e3)).toBe('3시간 12분')
  expect(fmtDur('en', 5 * 60e3)).toBe('5m')

  expect(isTestCommand('cd server && npm test')).toBe(true)
  expect(isTestCommand('python -m pytest -q')).toBe(true)
  expect(isTestCommand('git status')).toBe(false)
  expect(isPushCommand('git -C "a b" push origin main')).toBe(true)
  expect(isPushCommand('git commit -m "fix push"')).toBe(false)

  expect(activityText('ko', activityOf('Edit', { file_path: 'C:\\a\\job.ts' }))).toBe('job.ts 수정 중')
  expect(activityText('en', activityOf('Edit', { file_path: '/a/job.ts' }))).toBe('editing job.ts')
  expect(activityText('ko', activityOf('Bash', { command: 'ls', description: 'List files' }))).toBe('List files')

  const t0 = emptyToday('2026-11-24')
  const t2 = addCall(addCall(addCall(t0, 10, 'a'), 10, 'b'), 11, 'a')
  expect(t0.hourly[10]).toBe(0) // 원본 안 바뀜
  expect(t2.hourly[10]).toBe(2)
  expect(topProjects(t2, 1)).toEqual([{ name: 'a', share: 2 / 3 }])
  expect(chartSvg(t2.hourly).includes('<rect')).toBe(true)
})

test('files, git status, tokens', async () => {
  const f = addFile(addFile(addFile({}, 'C:\\w\\api\\a.ts'), 'C:\\w\\api\\a.ts'), 'C:\\w\\web\\b.tsx')
  expect(topFiles(f, 'C:\\w', 5)).toEqual([{ label: 'api/a.ts', count: 2 }, { label: 'web/b.tsx', count: 1 }])

  const s = parseGitStatus('api', '## main...origin/main [ahead 2]\n M src/a.ts\n?? new.txt\n')
  expect(s).toEqual({ name: 'api', branch: 'main', changes: 2, ahead: 2 })
  expect(isDirty(parseGitStatus('x', '## main...origin/main\n'))).toBe(false)

  const t = addUsage(emptyToday('d'), { input_tokens: 100, cache_creation_input_tokens: 50, cache_read_input_tokens: 2000, output_tokens: 30 })
  expect([t.tokensIn, t.tokensCached, t.tokensOut]).toEqual([150, 2000, 30])
  expect(fmtTokens(1_234_567)).toBe('1.2M')
  expect(fmtTokens(85_400)).toBe('85K')
  expect(upgradeToday({ date: 'old', edits: 4 }, 'd')).toMatchObject({ date: 'd', edits: 4, tokensIn: 0 })
})

test('meter, limits, recap, branch, fail label', async () => {
  expect(levelColor(62)).toBeUndefined()
  expect(levelColor(80)).toBe('#E0A23B')
  expect(levelColor(93)).toBe('#E5534B')
  expect(limitLabel('five_hour', 'ko')).toBe('5시간')
  expect(limitLabel('seven_day', 'en')).toBe('7d')
  expect(limitLabel('other', 'ko')).toBe('other')

  const now = new Date(2026, 10, 24, 14, 0).getTime()
  expect(fmtReset(new Date(2026, 10, 24, 18, 5).toISOString(), now)).toBe('18:05')
  expect(fmtReset(new Date(2026, 10, 27, 9, 0).toISOString(), now)).toBe('11/27')
  expect(fmtReset(undefined, now)).toBe('')
  expect(fmtReset('garbage', now)).toBe('')

  expect(fmtSpan('ko', 134_000)).toBe('2분 14초')
  expect(fmtSpan('en', 9_000)).toBe('9s')
  expect(turnRecap('ko', { ms: 134_000, files: 3, out: 4200 })).toBe('방금: 2분 14초 · 파일 3개 · 출력 4K')

  expect(isProtected('main', 'main,master')).toBe(true)
  expect(isProtected('feat/x', 'main, master')).toBe(false)
  expect(isProtected('', 'main')).toBe(false)

  expect(failLabel({ command: 'pytest -q', description: 'Run tests' }, 'api')).toBe('Run tests (api)')
  expect(failLabel({ command: 'npm test\nsecond line' }, null)).toBe('npm test')
})

test('nyan command args', async () => {
  expect(parseNyanArgs('')).toEqual({ kind: 'open' })
  expect(parseNyanArgs('todo  PR 리뷰 / 금 ')).toEqual({ kind: 'todo', text: 'PR 리뷰 / 금' })
  expect(parseNyanArgs('memo x')).toEqual({ kind: 'todo', text: 'x' }) // 예전 memo = 할 일 추가
  expect(parseNyanArgs('todo')).toEqual({ kind: 'open' }) // 글 없으면 그냥 펼치기
  expect(parseNyanArgs('tomorrow y')).toEqual({ kind: 'open' }) // v1 명령은 없앰
})

test('cat art: 3 lines per mood, same ears, narrow chars', async () => {
  const moods = ['idle', 'working', 'waiting', 'done', 'error'] as const
  for (const m of moods) {
    expect(CAT[m].length).toBe(3)
    expect(CAT[m][0]).toBe(CAT.idle[0]) // 귀는 같고 표정만 바뀜
    for (const line of CAT[m]) expect(/^[ -~ω]*$/.test(line)).toBe(true) // 줄맞춤 깨지는 넓은 글자 금지
  }
  expect(new Set(moods.map(m => CAT[m][1])).size).toBe(5) // 상태마다 다른 표정
})

test('due date parsing', async () => {
  const D = '2026-11-24' // 화요일
  expect(parseDue('오늘', D)).toBe('2026-11-24')
  expect(parseDue('내일', D)).toBe('2026-11-25')
  expect(parseDue('모레', D)).toBe('2026-11-26')
  expect(parseDue('11/28', D)).toBe('2026-11-28')
  expect(parseDue('11-28', D)).toBe('2026-11-28')
  expect(parseDue('1/5', D)).toBe('2027-01-05') // 지난 날짜 = 내년
  expect(parseDue('2026-12-01', D)).toBe('2026-12-01')
  expect(parseDue('금', D)).toBe('2026-11-27')
  expect(parseDue('금요일', D)).toBe('2026-11-27')
  expect(parseDue('화', D)).toBe('2026-11-24') // 오늘이 그 요일이면 오늘
  expect(parseDue('+3', D)).toBe('2026-11-27')
  expect(parseDue('2/30', D)).toBe(null) // 없는 날짜
  expect(parseDue('아무거나', D)).toBe(null)

  expect(parseTodoInput(' 보고서 초안 / 11/28 ', D)).toEqual({ ok: true, text: '보고서 초안', due: '2026-11-28' })
  expect(parseTodoInput('아이디어 메모', D)).toEqual({ ok: true, text: '아이디어 메모' }) // 마감 없음
  expect(parseTodoInput('A/B 정리 / 금', D)).toEqual({ ok: true, text: 'A/B 정리', due: '2026-11-27' }) // 띄어쓴 / 만 구분자
  expect(parseTodoInput('리뷰 / 아무거나', D)).toEqual({ ok: false, reason: 'due' })
  expect(parseTodoInput('  / 오늘', D)).toEqual({ ok: false, reason: 'empty' })
  expect(parseTodoInput('b'.repeat(200), D)).toMatchObject({ ok: true })
})

test('due dropdown options and fixed-format input', async () => {
  const D = '2026-11-24' // 화요일
  const o = dueOptions(D, 'ko')
  expect(o.length).toBe(17) // 오늘~2주 뒤 15칸 + 마감 없음 + 직접 입력
  expect(o[0]).toEqual({ value: '2026-11-24', label: '오늘 11/24 (화)' })
  expect(o[1]).toEqual({ value: '2026-11-25', label: '내일 11/25 (수)' })
  expect(o[2]).toEqual({ value: '2026-11-26', label: '11/26 (목)' })
  expect(o[14].value).toBe('2026-12-08')
  expect(o.slice(-2)).toEqual([{ value: 'none', label: '마감 없음' }, { value: 'custom', label: '직접 입력…' }])
  expect(dueOptions(D, 'en')[0].label).toBe('Today 11/24 (Tu)')
  // 지금 마감이 목록 밖이면 맨 위에 붙여서 선택 상태 유지
  expect(dueOptions(D, 'ko', '2026-11-20')[0]).toEqual({ value: '2026-11-20', label: '11/20 (금) ⚠️' })
  expect(dueOptions(D, 'ko', '2027-01-05')[0]).toEqual({ value: '2027-01-05', label: '1/5 (화)' })
  expect(dueOptions(D, 'ko', '2026-11-27').length).toBe(17)
  expect(dueOptions(D, 'ko', 'none').length).toBe(17) // 특수 값은 안 붙임
  expect(dueOptions(D, 'ko', 'custom').length).toBe(17)

  expect(parseFixedDue('12/25', D)).toBe('2026-12-25')
  expect(parseFixedDue(' 1/5 ', D)).toBe('2027-01-05')
  expect(parseFixedDue('13/1', D)).toBe(null)
  expect(parseFixedDue('금', D)).toBe(null) // 직접 입력은 MM/DD 형식만
  expect(parseFixedDue('+3', D)).toBe(null)
})

test('todos: sections by due, labels, postpone, prune, upgrade', async () => {
  const D = '2026-11-24'
  let t = addTodo([], '나머지-마감없음', undefined, 'n')
  t = addTodo(t, '나머지-28', '2026-11-28', 'r')
  t = addTodo(t, '오늘', D, 'a')
  t = addTodo(t, '지남', '2026-11-22', 'late')
  t = addTodo(t, '내일', '2026-11-25', 'b')
  t = addTodo(t, '   ', D, 'x') // 빈 글은 무시
  t = addTodo(t, 'c'.repeat(200), '2026-11-26', 'c')
  expect(t.length).toBe(6)
  expect(t.find(x => x.id === 'c')?.text.length).toBe(80)
  expect(t.find(x => x.id === 'n')).toEqual({ id: 'n', text: '나머지-마감없음' })

  let s = todoSections(t, D)
  expect(s.dueToday.map(x => x.id)).toEqual(['late', 'a']) // 지난 것이 맨 위
  expect(s.dueTomorrow.map(x => x.id)).toEqual(['b'])
  expect(s.rest.map(x => x.id)).toEqual(['c', 'r', 'n']) // 마감순, 마감 없음은 맨 끝

  expect(dueLabel('2026-11-22', D, 'ko')).toBe('⚠️ 2일 지남')
  expect(dueLabel(D, D, 'ko')).toBe('오늘')
  expect(dueLabel('2026-11-25', D, 'ko')).toBe('내일')
  expect(dueLabel('2026-11-28', D, 'ko')).toBe('11/28 (D-4)')
  expect(dueLabel(undefined, D, 'ko')).toBe('마감 없음')
  expect(dueLabel('2026-11-22', D, 'en')).toBe('⚠️ 2d late')

  const done = completeTodo(t, 'a', D)
  expect(t.find(x => x.id === 'a')?.doneOn).toBeUndefined() // 원본 안 바뀜
  s = todoSections(done, D)
  expect(s.dueToday.map(x => x.id)).toEqual(['late'])
  expect(s.doneToday.map(x => x.id)).toEqual(['a'])
  expect(todoSections(undoTodo(done, 'a'), D).dueToday.map(x => x.id)).toEqual(['late', 'a'])
  expect(todoSections(done, '2026-11-25').doneToday.length).toBe(0) // 어제 끝낸 건 안 보임

  expect(todoSections(setDue(t, 'a', '2026-11-25'), D).dueTomorrow.map(x => x.id)).toEqual(['a', 'b'])
  expect(setDue(t, 'a', undefined).find(x => x.id === 'a')).toEqual({ id: 'a', text: '오늘' }) // 마감 없음으로
  expect(t.find(x => x.id === 'a')?.due).toBe(D) // 원본 안 바뀜
  expect(removeTodo(t, 'a').length).toBe(5)

  expect(pruneTodos(completeTodo(t, 'a', '2026-11-10'), D).length).toBe(5) // 끝낸 지 7일 넘으면 정리
  expect(pruneTodos(completeTodo(t, 'a', '2026-11-20'), D).length).toBe(6)
  expect(pruneTodos([{ id: 'z', text: 'old', due: '2026-01-01' }], D).length).toBe(1) // 안 끝난 건 안 지움

  // v1 저장값(day) → due
  expect(upgradeTodos([{ id: 'v', text: '테스트', day: D }, { id: 'w', text: 'ok', due: D, doneOn: D }, 'junk']))
    .toEqual([{ id: 'v', text: '테스트', due: D }, { id: 'w', text: 'ok', due: D, doneOn: D }])
  expect(upgradeTodos(undefined)).toEqual([])
})

test('7-day history', async () => {
  const day = (date: string, activeMs: number) => ({ ...emptyToday(date), activeMs, edits: 2 })
  let h = {}
  for (let d = 10; d <= 20; d++) h = rememberDay(h, day(`2026-11-${d}`, d * 60e3))
  expect(Object.keys(h).length).toBe(7) // 오래된 건 버림
  expect(Object.keys(h)[0]).toBe('2026-11-14')
  const before = h
  const after = rememberDay(h, day('2026-11-20', 99))
  expect(before['2026-11-20'].activeMs).toBe(20 * 60e3) // 원본 안 바뀜
  expect(after['2026-11-20']).toEqual({ activeMs: 99, edits: 2, tests: 0 })

  const w = weekDays(h, '2026-11-21') // 오늘 기록 없어도 7칸
  expect(w.map(x => x.date)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'])
  expect(w[6].activeMs).toBe(0)
  expect(weekSvg(w, 'ko').includes('>토<')).toBe(true) // 2026-11-21 = 토요일

  const y = { '2026-11-23': { activeMs: 60 * 60e3, edits: 0, tests: 0 } }
  expect(vsYesterday('ko', y, '2026-11-24', 100 * 60e3)).toBe('어제보다 +40분')
  expect(vsYesterday('en', y, '2026-11-24', 30 * 60e3)).toBe('-30m vs yesterday')
  expect(vsYesterday('ko', {}, '2026-11-24', 5)).toBe('')
})

test('vscode: compact pane (band role) expands and collapses', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  const pane = await $.ui.mount({ plugin: 'nyan-helper', surface: 'vscode', component: 'Pane', requestId: 'nyan-helper', props: {} })
  await pane.drawn()
  // 여러 줄 고양이 + 말풍선 (정체성)
  expect((await pane.find({ key: 'cat' }))?.text ?? '').toContain(CAT.idle[1])
  expect((await pane.find({ key: 'bubble' }))?.text ?? '').toContain('쉬는 중이다냥~')
  expect(await pane.find({ text: '⏱ 시간대별 작업량' })).toBeUndefined()

  // 펼치면 처음엔 할 일 탭 (접기 버튼은 맨 위 머리줄)
  await pane.press({ key: 'expand' })
  expect(await pane.find({ key: 'collapse' })).toBeTruthy()
  expect((await pane.find({ key: 'cat' }))?.text ?? '').toContain(CAT.idle[1])
  expect(await pane.find({ key: 'bubble' })).toBeTruthy()
  expect(await pane.find({ key: 'todo-add' })).toBeTruthy()
  expect(await pane.find({ text: '⏱ 시간대별 작업량' })).toBeUndefined()
  // 통계 탭
  await pane.press({ key: 'tab-stats' })
  expect(await pane.find({ text: '⏱ 시간대별 작업량' })).toBeTruthy()
  expect(await pane.find({ text: '📅 최근 7일' })).toBeTruthy()
  expect(await pane.find({ key: 'todo-add' })).toBeUndefined()
  // 지금 탭
  await pane.press({ key: 'tab-now' })
  expect(await pane.find({ text: '📄 이번 대화에서 바뀐 파일' })).toBeTruthy()
  expect(await pane.find({ text: '⏱ 시간대별 작업량' })).toBeUndefined()
  // 접었다 펴도 마지막 탭 기억
  await pane.press({ key: 'collapse' })
  expect(await pane.find({ text: '📄 이번 대화에서 바뀐 파일' })).toBeUndefined()
  await pane.press({ key: 'expand' })
  expect(await pane.find({ text: '📄 이번 대화에서 바뀐 파일' })).toBeTruthy()
  await pane.press({ key: 'tab-todo' })
  await pane.press({ key: 'collapse' })

  // 명령으로 추가 → 접힌 화면에 다음 할 일
  const r = await $.command.run({ command: 'nyan', args: 'todo PR 리뷰 / 오늘' })
  expect(r.text).toContain('PR 리뷰')
  await pane.drawn()
  expect((await pane.find({ text: '📋 오늘까지 1' }))?.text ?? '').toContain('PR 리뷰')
  const bad = await $.command.run({ command: 'nyan', args: 'todo 리뷰 / 아무거나' })
  expect(bad.text).toContain('마감 형식')
  await pane.unmount()
})

test('vscode: todo list in expanded pane', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  const pane = await $.ui.mount({ plugin: 'nyan-helper', surface: 'vscode', component: 'Pane', requestId: 'nyan-helper', props: {} })
  await pane.drawn()
  await pane.press({ key: 'expand' })
  const opts = dueOptions(dayKey(Date.now()), 'ko')
  // 드롭다운 기본값 = 오늘
  await pane.input({ key: 'todo-add', text: '주간 리포트 확인' })
  expect(await pane.find({ text: '🔥 오늘까지 (1)' })).toBeTruthy()
  // 마감 없음 고르고 추가 → 나머지, 추가 뒤 드롭다운은 다시 오늘
  await pane.select({ key: 'todo-due', value: 'none' })
  await pane.input({ key: 'todo-add', text: '아이디어 메모' })
  expect(await pane.find({ text: '📋 나머지 (1)' })).toBeTruthy()
  expect(await pane.find({ text: '아이디어 메모' })).toBeTruthy()
  expect((await pane.find({ key: 'todo-due' }))?.props.value).toBe(opts[0].value)
  // 직접 입력: MM/DD만 받음
  await pane.select({ key: 'todo-due', value: 'custom' })
  await pane.input({ key: 'todo-due-custom', text: '99/99' })
  expect((await pane.find({ key: 'todo-due' }))?.props.value).toBe('custom') // 틀리면 그대로
  await pane.input({ key: 'todo-due-custom', text: '12/31' })
  await pane.input({ key: 'todo-add', text: '연말 정산' })
  expect(await pane.find({ text: '📋 나머지 (2)' })).toBeTruthy()

  const id = (await pane.find({ type: 'Box', text: /^☐\s?주간 리포트 확인/ }))?.key?.replace(/^todo-/, '') ?? ''
  expect(id).not.toBe('')
  // 체크박스 자체가 버튼: ☐ 누르면 완료, ☑ 누르면 되돌림
  expect(await pane.find({ key: `done-${id}` })).toBeUndefined() // ✓ 버튼은 없앰
  await pane.press({ key: `check-${id}` })
  expect((await pane.find({ key: `uncheck-${id}` }))?.props.label).toBe('☑')
  expect(await pane.find({ text: '✅ 오늘 한 일 (1)' })).toBeTruthy()
  await pane.press({ key: `uncheck-${id}` })
  expect((await pane.find({ key: `check-${id}` }))?.props.label).toBe('☐')
  // 행별 마감 변경: 드롭다운으로 내일 → 직접 입력으로 12/30
  await pane.select({ key: `due-${id}`, value: opts[1].value })
  expect(await pane.find({ text: '🌙 내일까지 (1)' })).toBeTruthy()
  await pane.select({ key: `due-${id}`, value: 'custom' })
  await pane.input({ key: `due-custom-${id}`, text: '12/30' })
  expect(await pane.find({ text: '📋 나머지 (3)' })).toBeTruthy()
  expect(await pane.find({ key: `due-custom-${id}` })).toBeUndefined() // 입력칸 닫힘
  await pane.press({ key: `del-${id}` })
  expect(await pane.find({ text: '주간 리포트 확인' })).toBeUndefined()
  await pane.unmount()
})

test('terminal: band draws; vscode: no band', async $ => {
  const band = await $.ui.mount({ plugin: 'nyan-helper', surface: 'terminal', component: 'AbovePrompt', props: {} })
  await band.drawn()
  expect((await band.find({ text: '쉬는 중이다냥~' }))?.text ?? '').toContain('(=^･ω･^=)')
  await band.unmount()
})
