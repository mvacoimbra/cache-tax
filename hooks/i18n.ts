export type Lang = 'en' | 'pt'

// The words of cache-tax's tab in the /mods pane. Durations and prices are passed in already
// formatted; the band above the prompt and the logs stay in English.
export type Strings = {
  title: string
  sections: { status: string; warm: string; guard: string }
  summary: {
    none: string
    compacted: string
    warm: (left: string) => string
    cold: (since: string) => string
    keepWarm: (left: string) => string
    keepWarmOff: string
    stopped: (why: string) => string
  }
  labels: {
    model: string
    cache: string
    context: string
    coldWrite: string
    keepWarm: string
    breakEven: string
    guard: string
    session: string
  }
  values: {
    modelUnseen: string
    compacted: string
    none: string
    cold: (since: string) => string
    warm: (left: string) => string
    tokens: (n: string) => string
    coldWrite: (cold: string, warm: string) => string
    keepWarmOn: (left: string, next: string, always: boolean) => string
    nextFirstTurn: string
    nextAfterCompaction: string
    nextCold: (every: string) => string
    nextPing: (inTime: string) => string
    lastPing: (read: string, usd: string) => string
    stopped: (why: string, always: boolean) => string
    offAlways: (window: string) => string
    off: string
    breakEven: (pings: number, idle: string, every: string) => string
    guardRefuse: string
    guardWarn: string
    session: (count: number, usd: string) => string
  }
  warm: {
    window: string
    windowHelp: string
    custom: string
    customHelp: string
    start: string
    always: string
    alwaysHelp: (window: string) => string
    off: string
    offHelp: string
    cost: string
  }
  guard: {
    label: string
    help: string
    refuse: string
    warn: string
  }
  messages: {
    badDuration: string
    badEvery: string
    alwaysOff: string
    armed: (window: string, every: string) => string
    armedCold: (window: string, every: string) => string
    alwaysOn: (window: string) => string
    coldNote: (every: string) => string
    off: string
    offAlways: string
    guardRefuse: string
    guardWarn: string
  }
}

const en: Strings = {
  title: 'Keep warm',
  sections: { status: 'Status', warm: 'Keep warm', guard: 'Guard' },
  summary: {
    none: 'no request yet this session',
    compacted: 'waiting for the first turn after compaction',
    warm: left => `warm · cold in ${left}`,
    cold: since => `cold for ${since}`,
    keepWarm: left => `keep warm ${left} left`,
    keepWarmOff: 'keep warm off',
    stopped: why => `keep warm stopped: ${why}`,
  },
  labels: {
    model: 'Model',
    cache: 'Cache',
    context: 'Context',
    coldWrite: 'Cold write',
    keepWarm: 'Keep warm',
    breakEven: 'Break-even',
    guard: 'Guard',
    session: 'This session',
  },
  values: {
    modelUnseen: 'not seen yet',
    compacted: 'reset by compaction, waiting for the first turn',
    none: 'no request yet this session',
    cold: since => `cold, last request ${since} ago`,
    warm: left => `warm, cold in ${left}`,
    tokens: n => `${n} tokens`,
    coldWrite: (cold, warm) => `${cold} to re-write it (a warm turn ${warm})`,
    keepWarmOn: (left, next, always) => `on, ${left} left${next}${always ? ' (always)' : ''}`,
    nextFirstTurn: ' · waiting for the first turn',
    nextAfterCompaction: ' · waiting for the first turn after compaction',
    nextCold: every => ` · cold now, first ping ${every} after the next turn`,
    nextPing: inTime => ` · ping in ${inTime}`,
    lastPing: (read, usd) => ` · last ping read ${read} ${usd}`,
    stopped: (why, always) => `stopped, ${why}${always ? ' (always)' : ''}`,
    offAlways: window => `off until the next session start, which arms ${window} (always)`,
    off: 'off',
    breakEven: (pings, idle, every) => `up to ${pings} pings at the read rate cost one cold write, about ${idle} of idle at one ping per ${every}`,
    guardRefuse: 'stop a cold send once, with its price',
    guardWarn: 'only show the price of a cold send',
    session: (count, usd) => `${count} cold write${count === 1 ? '' : 's'} paid, ${usd}`,
  },
  warm: {
    window: 'Keep warm for',
    windowHelp: 'A ping after each idle stretch keeps the cache read instead of re-written',
    custom: 'Other duration',
    customHelp: 'Such as 90m or 2h30m',
    start: 'start',
    always: 'Every session',
    alwaysHelp: window => `Each session starts with a ${window} window`,
    off: 'Turn off',
    offHelp: 'Stops the window and the every-session switch',
    cost: 'Pings are model requests: each reads the cached context at the read rate, far below a cold re-write.',
  },
  guard: {
    label: 'Cold send',
    help: 'What happens when you send to a cold cache of a big context',
    refuse: 'stop once',
    warn: 'warn only',
  },
  messages: {
    badDuration: 'keep warm takes a window such as 6h or 90m',
    badEvery: 'every takes a period of at least 1m',
    alwaysOff: 'keep warm no longer arms itself at session start',
    armed: (window, every) => `keepwarm on for ${window}, a ping ${every} after each idle stretch keeps the cache read, not re-written`,
    armedCold: (window, every) => `keepwarm on for ${window}. The cache is cold now, so the first ping comes ${every} after the next turn`,
    alwaysOn: window => `keepwarm always on: every session starts with a ${window} window; Turn off in /mods ends it for good`,
    coldNote: every => `. The cache is cold now, so the first ping comes ${every} after the next turn`,
    off: 'keepwarm is off',
    offAlways: 'keepwarm is off, and no longer arms itself at session start',
    guardRefuse: 'guard set to refuse once: a cold send is dropped with its price, the resend goes through',
    guardWarn: 'guard set to warn: a cold send goes through with its price shown',
  },
}

const pt: Strings = {
  title: 'Manter aquecido',
  sections: { status: 'Estado', warm: 'Manter aquecido', guard: 'Proteção' },
  summary: {
    none: 'nenhuma requisição nesta sessão ainda',
    compacted: 'esperando o primeiro turno depois da compactação',
    warm: left => `aquecido · esfria em ${left}`,
    cold: since => `frio há ${since}`,
    keepWarm: left => `aquecimento por mais ${left}`,
    keepWarmOff: 'aquecimento desligado',
    stopped: why => `aquecimento parou: ${why}`,
  },
  labels: {
    model: 'Modelo',
    cache: 'Cache',
    context: 'Contexto',
    coldWrite: 'Escrita a frio',
    keepWarm: 'Aquecimento',
    breakEven: 'Empate',
    guard: 'Proteção',
    session: 'Esta sessão',
  },
  values: {
    modelUnseen: 'ainda não visto',
    compacted: 'zerado pela compactação, esperando o primeiro turno',
    none: 'nenhuma requisição nesta sessão ainda',
    cold: since => `frio, última requisição há ${since}`,
    warm: left => `aquecido, esfria em ${left}`,
    tokens: n => `${n} tokens`,
    coldWrite: (cold, warm) => `${cold} para reescrever (um turno aquecido ${warm})`,
    keepWarmOn: (left, next, always) => `ligado, mais ${left}${next}${always ? ' (sempre)' : ''}`,
    nextFirstTurn: ' · esperando o primeiro turno',
    nextAfterCompaction: ' · esperando o primeiro turno depois da compactação',
    nextCold: every => ` · frio agora, primeiro ping ${every} depois do próximo turno`,
    nextPing: inTime => ` · ping em ${inTime}`,
    lastPing: (read, usd) => ` · último ping leu ${read} ${usd}`,
    stopped: (why, always) => `parado, ${why}${always ? ' (sempre)' : ''}`,
    offAlways: window => `desligado até a próxima sessão, que liga ${window} (sempre)`,
    off: 'desligado',
    breakEven: (pings, idle, every) => `até ${pings} pings na taxa de leitura custam uma escrita a frio, cerca de ${idle} parado com um ping a cada ${every}`,
    guardRefuse: 'segura um envio a frio uma vez, com o preço',
    guardWarn: 'só mostra o preço de um envio a frio',
    session: (count, usd) => `${count} escrita${count === 1 ? '' : 's'} a frio paga${count === 1 ? '' : 's'}, ${usd}`,
  },
  warm: {
    window: 'Manter por',
    windowHelp: 'Um ping depois de cada pausa mantém o cache sendo lido em vez de reescrito',
    custom: 'Outra duração',
    customHelp: 'Como 90m ou 2h30m',
    start: 'iniciar',
    always: 'Em toda sessão',
    alwaysHelp: window => `Toda sessão começa com uma janela de ${window}`,
    off: 'Desligar',
    offHelp: 'Para a janela e o liga-em-toda-sessão',
    cost: 'Pings são requisições ao modelo: cada um lê o contexto em cache na taxa de leitura, bem abaixo de uma reescrita a frio.',
  },
  guard: {
    label: 'Envio a frio',
    help: 'O que acontece quando você envia para um cache frio de um contexto grande',
    refuse: 'segurar uma vez',
    warn: 'só avisar',
  },
  messages: {
    badDuration: 'o aquecimento aceita uma janela como 6h ou 90m',
    badEvery: 'o intervalo precisa ser de pelo menos 1m',
    alwaysOff: 'o aquecimento não liga mais sozinho no início da sessão',
    armed: (window, every) => `aquecimento ligado por ${window}: um ping ${every} depois de cada pausa mantém o cache sendo lido, não reescrito`,
    armedCold: (window, every) => `aquecimento ligado por ${window}. O cache está frio agora, então o primeiro ping vem ${every} depois do próximo turno`,
    alwaysOn: window => `aquecimento sempre ligado: toda sessão começa com uma janela de ${window}; Desligar em /mods encerra de vez`,
    coldNote: every => `. O cache está frio agora, então o primeiro ping vem ${every} depois do próximo turno`,
    off: 'aquecimento desligado',
    offAlways: 'aquecimento desligado, e não liga mais sozinho no início da sessão',
    guardRefuse: 'proteção: um envio a frio é segurado uma vez com o preço, o reenvio passa',
    guardWarn: 'proteção: um envio a frio passa, com o preço mostrado',
  },
}

export const STRINGS: Readonly<Record<Lang, Strings>> = { en, pt }
