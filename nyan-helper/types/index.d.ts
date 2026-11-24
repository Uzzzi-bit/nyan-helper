export type Mood = 'idle' | 'working' | 'waiting' | 'done' | 'error'
export type Lang = 'ko' | 'en'
export type Tone = 'nyan' | 'gyaru' | 'plain' | 'custom'

/** 오늘(로컬 시간) 누적 통계. $.store 'today'에도 저장돼 세션이 바뀌어도 이어짐 */
export type Today = {
  date: string
  activeMs: number
  edits: number
  tests: number
  testsFailed: number
  pushBlocked: number
  asks: number
  /** 0~23시, 도구 실행 횟수 */
  hourly: number[]
  /** 프로젝트 이름 → 도구 실행 횟수 */
  projects: Record<string, number>
  /** 토큰: 새 입력(캐시 쓰기 포함) · 캐시 읽기 · 출력 */
  tokensIn: number
  tokensCached: number
  tokensOut: number
}

/** 하루 요약 (최근 7일 기록용, $.store 'week') */
export type DaySum = { activeMs: number; edits: number; tests: number }

/** 매니저 할 일. due = 마감(없으면 마감 없음), doneOn = 끝낸 날 */
export type Todo = { id: string; text: string; due?: string; doneOn?: string }

/** git 저장소 하나의 정리 안 된 상태 */
export type RepoState = { name: string; branch: string; changes: number; ahead: number }

/** 지금 상태 (세션 한정). activity는 [종류, 대상] — 언어는 그릴 때 입힘 */
export type Live = {
  mood: Mood
  project: string
  activity: [string, string]
  todoDone: number
  todoTotal: number
  /** 마지막으로 실패한 셸 명령 설명. 다음 셸 명령이 성공하면 '' */
  lastFail: string
  /** 방금 끝난 답변: 걸린 시간·수정 파일 수·출력 토큰 */
  lastTurn: { ms: number; files: number; out: number } | null
}

/** 대화 기억 공간(컨텍스트) 사용률과 사용 한도 */
export type Meter = {
  contextPct: number | null
  limits: { kind: string; pct: number; resetsAt?: string }[]
}

declare module 'claude-code' {
  interface PluginState {
    'nyan-helper': {
      today: Shaped<Today>
      live: Shaped<Live>
      isCompact: boolean
      /** 이번 대화에서 수정한 파일 경로 → 횟수 */
      files: Shaped<Record<string, number>>
      /** 찾은 저장소 전부 (깨끗한 것 포함 — 현재 브랜치 표시에 씀) */
      repos: Shaped<RepoState[]>
      meter: Shaped<Meter>
      /** 날짜 → 하루 요약 (최근 7일) */
      week: Shaped<Record<string, DaySum>>
      /** 매니저 할 일 목록. $.store 'todos'에도 저장 */
      todos: Shaped<Todo[]>
      /** 마감 드롭다운 상태: add = 새 할 일 마감('' = 오늘·'none'·'custom'·날짜), editing = 직접 입력 중인 행 */
      dueUi: Shaped<{ add: string; editing: string }>
    }
  }
}
