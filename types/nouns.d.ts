// Another mod's nouns cache-tax calls, for the editor and tsc only (not this plugin's contract):
// whether skins' usage band already shows the time until the cache goes cold, and the skin
// every mod of the pack wears.
import type { KitSkin } from '../hooks/kit/tone'

declare module 'claude-code' {
  interface EngineInterface {
    skins: { band: () => Promise<boolean>; palette: () => Promise<KitSkin> }
  }
}

export {}
