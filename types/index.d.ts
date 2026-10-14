// What cache-tax adds to `$`: its tab in the /mods pane (PROTOCOL.md in claude-mods-hub) and its
// state, for another mod to show the time until the cache goes cold.

export type CachetaxLang = 'en' | 'pt'

export type CachetaxPanelArgs = { lang: CachetaxLang; surface: 'terminal' | 'desktop' | 'vscode' | 'mobile'; columns: number }

export type CachetaxTone = 'ok' | 'warn' | 'err' | 'muted' | 'accent'

// Where a setting lives: the user's (every session and project, the default) or this session's
// alone, such as the keep-warm window. The hub marks the session's.
export type CachetaxScope = 'user' | 'session'

export type CachetaxItem =
  | { kind: 'toggle'; id: string; label: string; help?: string; value: boolean; scope?: CachetaxScope }
  | { kind: 'choice'; id: string; label: string; help?: string; value: string; options: { value: string; label: string }[]; scope?: CachetaxScope }
  | { kind: 'action'; id: string; label: string; title?: string; help?: string; primary?: boolean; scope?: CachetaxScope }
  | { kind: 'input'; id: string; label: string; help?: string; placeholder?: string; submitLabel?: string; scope?: CachetaxScope }
  | { kind: 'info'; label: string; value: string; tone?: CachetaxTone }
  | { kind: 'text'; text: string; tone?: CachetaxTone }
  | { kind: 'swatch'; id: string; label: string; color: string; selected: boolean }
  | { kind: 'tree'; tree: unknown }

export type CachetaxSection = { id: string; title: string; items: CachetaxItem[] }

export type CachetaxPanel = { title: string; summary?: string; tone?: CachetaxTone; sections: CachetaxSection[]; refreshMs?: number }

export type CachetaxActArgs = { id: string; value?: string }

export type CachetaxActResult = { message?: string }

// One named component cache-tax draws, for the Components tab of /mods (the hub's catalog).
export type CachetaxCatalogEntry = { id: string; name: string; help?: string; tree: unknown }

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
      catalog: (args: CachetaxPanelArgs) => Promise<CachetaxCatalogEntry[]>
    }
  }
}
