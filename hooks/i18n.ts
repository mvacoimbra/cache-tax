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
    kept: (left: string) => string
    cold: (since: string) => string
    keepWarm: (left: string) => string
    stopped: string
  }
  labels: {
    cache: string
    keepWarm: string
    nextPing: string
    lastPing: string
    model: string
    context: string
    coldWrite: string
    breakEven: string
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
    keepWarmOn: (left: string, always: boolean) => string
    stopped: (always: boolean) => string
    offAlways: (window: string) => string
    off: string
    nextFirstTurn: string
    nextAfterCompaction: string
    nextCold: (every: string) => string
    nextPing: (inTime: string) => string
    lastPing: (read: string, usd: string) => string
    breakEven: (pings: number, idle: string) => string
    session: (count: number, usd: string) => string
  }
  warm: {
    window: string
    windowHelp: string
    custom: string
    customHelp: string
    start: string
    off: string
    offHelp: (left: string) => string
    always: string
    alwaysHelp: (window: string) => string
    cost: string
    breakEven: (pings: number, idle: string, every: string) => string
    stoppedBecause: (why: string) => string
  }
  guard: {
    label: string
    help: string
    refuse: string
    warn: string
    refuseNow: string
    warnNow: string
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
    offAlways: (window: string) => string
    guardRefuse: string
    guardWarn: string
  }
}

const en: Strings = {
  title: 'Keep warm',
  sections: { status: 'Status', warm: 'Keep warm', guard: 'Cold send guard' },
  summary: {
    none: 'no request yet',
    compacted: 'reset by compaction',
    warm: left => `warm · cold in ${left}`,
    kept: left => `warm · kept warm ${left}`,
    cold: since => `cold for ${since}`,
    keepWarm: left => `keep warm ${left} left`,
    stopped: 'keep warm stopped',
  },
  labels: {
    cache: 'Cache',
    keepWarm: 'Keep warm',
    nextPing: 'Next ping',
    lastPing: 'Last ping',
    model: 'Model',
    context: 'Context',
    coldWrite: 'Cold write',
    breakEven: 'Break-even',
    session: 'This session',
  },
  values: {
    modelUnseen: 'not seen yet',
    compacted: 'reset by compaction, waiting for the first turn',
    none: 'no request yet this session',
    cold: since => `cold, last request ${since} ago`,
    warm: left => `warm, cold in ${left}`,
    tokens: n => `${n} tokens`,
    coldWrite: (cold, warm) => `${cold} to re-write (warm turn ${warm})`,
    keepWarmOn: (left, always) => `on, ${left} left${always ? ' · every session' : ''}`,
    stopped: always => `stopped${always ? ' · every session' : ''}`,
    offAlways: window => `off · the next session starts with ${window}`,
    off: 'off',
    nextFirstTurn: 'after the first turn',
    nextAfterCompaction: 'after the first turn since compaction',
    nextCold: every => `cold now, ${every} after the next turn`,
    nextPing: inTime => `in ${inTime}`,
    lastPing: (read, usd) => `read ${read} tokens, ${usd}`,
    breakEven: (pings, idle) => `up to ${pings} pings, ${idle} idle`,
    session: (count, usd) => `${count} cold write${count === 1 ? '' : 's'} paid, ${usd}`,
  },
  warm: {
    window: 'Keep warm for',
    windowHelp: 'Starts a window: a ping after each idle stretch keeps the cache read instead of re-written',
    custom: 'Other duration',
    customHelp: 'Such as 90m or 2h30m',
    start: 'Start',
    off: 'Stop',
    offHelp: left => `Ends the window now, ${left} early`,
    always: 'Keep warm every session',
    alwaysHelp: window => `Each new session starts with a ${window} window`,
    cost: 'Pings are model requests: each reads the cached context at the read rate, far below a cold re-write.',
    breakEven: (pings, idle, every) => `Up to ${pings} pings at the read rate cost one cold write, about ${idle} of idle at one ping per ${every}.`,
    stoppedBecause: why => `Keep warm stopped: ${why}.`,
  },
  guard: {
    label: 'On a cold send',
    help: 'When the cache went cold on a context of 50k tokens or more',
    refuse: 'Stop once',
    warn: 'Warn only',
    refuseNow: 'A cold send is stopped once with its price; sending it again pays it.',
    warnNow: 'A cold send goes through; its price is noted in the transcript.',
  },
  messages: {
    badDuration: 'keep warm takes a window such as 6h or 90m',
    badEvery: 'every takes a period of at least 1m',
    alwaysOff: 'keep warm no longer arms itself at session start',
    armed: (window, every) => `keepwarm on for ${window}, a ping ${every} after each idle stretch keeps the cache read, not re-written`,
    armedCold: (window, every) => `keepwarm on for ${window}. The cache is cold now, so the first ping comes ${every} after the next turn`,
    alwaysOn: window => `keepwarm always on: every session starts with a ${window} window; switch Keep warm every session off in /mods to end it`,
    coldNote: every => `. The cache is cold now, so the first ping comes ${every} after the next turn`,
    off: 'keepwarm is off',
    offAlways: window => `keepwarm is off for this session; every new session still starts with a ${window} window`,
    guardRefuse: 'guard set to refuse once: a cold send is dropped with its price, the resend goes through',
    guardWarn: 'guard set to warn: a cold send goes through with its price shown',
  },
}

const pt: Strings = {
  title: 'Manter aquecido',
  sections: { status: 'Estado', warm: 'Manter aquecido', guard: 'Proteção contra envio a frio' },
  summary: {
    none: 'nenhuma requisição ainda',
    compacted: 'zerado pela compactação',
    warm: left => `aquecido · esfria em ${left}`,
    kept: left => `aquecido · mantido por ${left}`,
    cold: since => `frio há ${since}`,
    keepWarm: left => `aquecimento por mais ${left}`,
    stopped: 'aquecimento parou',
  },
  labels: {
    cache: 'Cache',
    keepWarm: 'Aquecimento',
    nextPing: 'Próximo ping',
    lastPing: 'Último ping',
    model: 'Modelo',
    context: 'Contexto',
    coldWrite: 'Escrita a frio',
    breakEven: 'Empate',
    session: 'Esta sessão',
  },
  values: {
    modelUnseen: 'ainda não visto',
    compacted: 'zerado pela compactação, esperando o primeiro turno',
    none: 'nenhuma requisição nesta sessão ainda',
    cold: since => `frio, última requisição há ${since}`,
    warm: left => `aquecido, esfria em ${left}`,
    tokens: n => `${n} tokens`,
    coldWrite: (cold, warm) => `${cold} para reescrever (aquecido ${warm})`,
    keepWarmOn: (left, always) => `ligado, mais ${left}${always ? ' · em toda sessão' : ''}`,
    stopped: always => `parado${always ? ' · em toda sessão' : ''}`,
    offAlways: window => `desligado · a próxima sessão começa com ${window}`,
    off: 'desligado',
    nextFirstTurn: 'depois do primeiro turno',
    nextAfterCompaction: 'depois do primeiro turno desde a compactação',
    nextCold: every => `frio agora, ${every} depois do próximo turno`,
    nextPing: inTime => `em ${inTime}`,
    lastPing: (read, usd) => `leu ${read} tokens, ${usd}`,
    breakEven: (pings, idle) => `até ${pings} pings, ${idle} parado`,
    session: (count, usd) => `${count} escrita${count === 1 ? '' : 's'} a frio paga${count === 1 ? '' : 's'}, ${usd}`,
  },
  warm: {
    window: 'Manter por',
    windowHelp: 'Inicia uma janela: um ping depois de cada pausa mantém o cache sendo lido em vez de reescrito',
    custom: 'Outra duração',
    customHelp: 'Como 90m ou 2h30m',
    start: 'Iniciar',
    off: 'Parar',
    offHelp: left => `Encerra a janela agora, ${left} antes do fim`,
    always: 'Manter aquecido em toda sessão',
    alwaysHelp: window => `Toda sessão nova começa com uma janela de ${window}`,
    cost: 'Pings são requisições ao modelo: cada um lê o contexto em cache na taxa de leitura, bem abaixo de uma reescrita a frio.',
    breakEven: (pings, idle, every) => `Até ${pings} pings na taxa de leitura custam uma escrita a frio, cerca de ${idle} parado com um ping a cada ${every}.`,
    stoppedBecause: why => `O aquecimento parou: ${why}.`,
  },
  guard: {
    label: 'Num envio a frio',
    help: 'Quando o cache esfriou num contexto de 50k tokens ou mais',
    refuse: 'Segurar uma vez',
    warn: 'Só avisar',
    refuseNow: 'Um envio a frio é segurado uma vez com o preço; enviar de novo paga.',
    warnNow: 'Um envio a frio passa; o preço fica registrado na conversa.',
  },
  messages: {
    badDuration: 'o aquecimento aceita uma janela como 6h ou 90m',
    badEvery: 'o intervalo precisa ser de pelo menos 1m',
    alwaysOff: 'o aquecimento não liga mais sozinho no início da sessão',
    armed: (window, every) => `aquecimento ligado por ${window}: um ping ${every} depois de cada pausa mantém o cache sendo lido, não reescrito`,
    armedCold: (window, every) => `aquecimento ligado por ${window}. O cache está frio agora, então o primeiro ping vem ${every} depois do próximo turno`,
    alwaysOn: window => `aquecimento sempre ligado: toda sessão começa com uma janela de ${window}; desligue Manter aquecido em toda sessão em /mods para encerrar`,
    coldNote: every => `. O cache está frio agora, então o primeiro ping vem ${every} depois do próximo turno`,
    off: 'aquecimento desligado',
    offAlways: window => `aquecimento desligado nesta sessão; toda sessão nova ainda começa com uma janela de ${window}`,
    guardRefuse: 'proteção: um envio a frio é segurado uma vez com o preço, o reenvio passa',
    guardWarn: 'proteção: um envio a frio passa, com o preço mostrado',
  },
}

export const STRINGS: Readonly<Record<Lang, Strings>> = { en, pt }
