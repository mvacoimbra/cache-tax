// What cache-tax adds to `$`: its tab in the /mods pane (PROTOCOL.md in claude-mods-hub) and its
// state, for another mod to show the time until the cache goes cold.

export type CachetaxLang = 'en' | 'pt'

export type CachetaxPanelArgs = { lang: CachetaxLang; surface: 'terminal' | 'desktop' | 'vscode' | 'mobile'; columns: number }

export type CachetaxTone = 'ok' | 'warn' | 'err' | 'muted' | 'accent'

export type CachetaxItem =
  | { kind: 'toggle'; id: string; label: string; help?: string; value: boolean }
  | { kind: 'choice'; id: string; label: string; help?: string; value: string; options: { value: string; label: string }[] }
  | { kind: 'action'; id: string; label: string; help?: string; primary?: boolean }
  | { kind: 'input'; id: string; label: string; help?: string; placeholder?: string; submitLabel?: string }
  | { kind: 'info'; label: string; value: string; tone?: CachetaxTone }
  | { kind: 'text'; text: string; tone?: CachetaxTone }
  | { kind: 'swatch'; id: string; label: string; color: string; selected: boolean }
  | { kind: 'tree'; tree: unknown }

export type CachetaxSection = { id: string; title: string; items: CachetaxItem[] }

export type CachetaxPanel = { title: string; summary?: string; tone?: CachetaxTone; sections: CachetaxSection[]; refreshMs?: number }

export type CachetaxActArgs = { id: string; value?: string }

export type CachetaxActResult = { message?: string }

// Where the prompt cache stands. `coldAt` is when it goes cold unless a request reads it
// first (null before the first request, after compaction, or once cold); `warmUntil` is when
// the keep-warm window ends (null while off).
export type CachetaxState = {
  phase: 'warm' | 'cold' | 'unknown' | 'stopped'
  coldAt: number | null
  warmUntil: number | null
}

declare module 'claude-code' {
  interface EngineInterface {
    cachetax: {
      panel: (args: CachetaxPanelArgs) => Promise<CachetaxPanel>
      act: (args: CachetaxActArgs) => Promise<CachetaxActResult>
      state: () => Promise<CachetaxState>
    }
  }
}
