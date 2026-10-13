// Another mod's noun cache-tax calls, for the editor and tsc only (not this plugin's contract):
// whether skins' usage band already shows the time until the cache goes cold.
declare module 'claude-code' {
  interface EngineInterface {
    skins: { band: () => Promise<boolean> }
  }
}

export {}
