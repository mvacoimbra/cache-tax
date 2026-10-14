<picture>
  <source media="(prefers-color-scheme: dark)" srcset="site/assets/cache-tax-dark.svg">
  <img src="site/assets/cache-tax-light.svg" alt="Cache Tax" width="64" height="64">
</picture>

# Cache Tax for Claude Code

**Keep Claude Code's prompt cache warm during breaks.**

Cache Tax is a Claude Code mod that refreshes your prompt cache while you step away and shows the estimated rewrite cost before a cold send. Open the Keep warm tab in `/mods` before a break. Pings cost tokens; choose a window you expect to return within.

**[Install](#install)** · [Website](https://cachetax.aidojo.si/) · [How it works](#how-it-works) · [Costs and limits](#cost-and-the-plan-limit-question) · [The Keep warm tab](#the-keep-warm-tab)

![Real recording of cache-tax stopping a cold send with a $6.61 estimate](site/assets/refusal.gif)

A two-line recap in a 330k-token session triggered a **$6.61 estimate**. After resending, the reported cache write was **$6.28**. Recorded on 2.1.1; current wording says “up to” the estimated token count. These are API-equivalent costs, not extra subscription charges.

## Install

Needs [Claude Code 2.1.287 or later](https://code.claude.com/docs/en/plugins/mods/overview#turn-mods-on-or-off), a one-hour cache and Claude Code left running. Mods are on by default. Pings cost tokens, including uncapped output.

```sh
claude plugin marketplace add karanb192/claude-code-mods
claude plugin install cache-tax@claude-code-mods
```

Restart Claude Code or run `/reload-plugins` in an open session. No early-access flag is needed. If you set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` previously, remove it; current Claude Code ignores it.

In a warm session, open `/mods`, go to the Keep warm tab and pick a window (6h, or type one such as 90m). Stop there ends it early. The `/mods` pane comes from the [claude-mods-hub](https://github.com/mvacoimbra/claude-mods-hub) mod.

**Check the main cache lifetime.** Included subscription usage defaults to one hour. API-key, usage-credit and cloud-provider sessions default to five minutes, so set [`promptCacheTtl`](https://code.claude.com/docs/en/prompt-caching#choose-the-ttl-yourself) to `"1h"` for those billing paths. A 50-minute timer cannot protect a five-minute main cache. See [Limits](#limits) for the fork evidence.

**Prefer a settings hook?** The [hook version](https://github.com/karanb192/claude-code-hooks/tree/main/plugins/cache-tax) warns by default, refuses once with `CACHE_TAX_BLOCK=1`, and provides a standalone status-line countdown. Warming is part of this mod.

## How it works

**Before a break:** a window from the Keep warm tab arms a bounded window. After 50 idle minutes, a timer inside Claude Code sends one tool-less fork over the session's transcript. It reads usage after every ping and stops if reads are zero or writes reach 10% of reads. There is no background transcript-polling loop.

**When you return cold:** for a context of at least 50,000 tokens, the guard drops your ordinary message once when its one-hour clock says cold. It shows the estimated rewrite price. Resend to continue, or `/clear` and start from a note.

A detected cold write automatically arms at least three hours of keepwarm. The tab's Status section shows the current cache estimate, warming window and this session's cold-write tally.

Windows belong to individual sessions. An already-cold session waits for your next turn before pinging. A window ends at its deadline; Stop in the tab ends it early. The every-session switch and the guard are your settings: set in one session, they hold in every other within a few seconds.

### A recorded warming ping

![Real keepwarm status showing a 75k-token cache read at $0.02](site/assets/keepwarm-receipt.png)

Sonnet 5, 16 September 2026: the status reported **75k tokens read at $0.02**. Nothing appeared in the conversation during the live run. This capture used the one-minute testing interval on 2.0.0; its card's $0.45 rewrite estimate used an older Sonnet price row, versus $0.30 for the same context with the current row. The two-cent ping is a receipt for that session, not a fixed price.

## Why a short message can cost so much

When the cached prefix expires, even “give me a recap” can trigger a rewrite of the old context before the answer. Cache Tax's Fable 5.1 price row compares a $20 one-hour write with a $0.25 cache read per million tokens: 80x per token, not 80x total savings. See the [pricing assumptions](#cost-and-the-plan-limit-question) and [Anthropic's price table](https://platform.claude.com/docs/en/about-claude/pricing).

[Watch the 23-second overview](docs/assets/cache-cost-explainer.mp4). Its designed scenes label Fable 5.1 list prices; every terminal and status-line pixel comes from the real refusal recording and keep-warm receipt above. The refusal was recorded on 2.1.1 and the keep-warm crop on 2.0.0.

New to caching? [Anthropic explains how Claude Code uses it](https://code.claude.com/docs/en/prompt-caching).

## The Keep warm tab

There are no slash commands: everything is in the Keep warm tab of `/mods`, in English or Portuguese.

| Section | What it holds |
|---|---|
| Status | Whether the cache is warm and when it goes cold, the keep-warm window, its next ping and last receipt, the model, the context, the cold-write price, the break-even and this session's cold writes |
| Keep warm | One press for 1h, 3h, 6h, 12h or 24h; a field for any other window (90m, 2h30m, or `6h every 2m`, a testing knob with a 1m floor that lasts only for that window); Stop, which ends the window early. These three are marked "this session only". Then Keep warm every session, which arms six hours at each session start, and why a stopped loop stopped |
| Cold send guard | Stop a cold send once, the resend goes through (this mod's default), or warn only and send (the hook's default) |

The every-session switch and the guard live in the mod's store, one per user: the tab reads them back before it draws and every 3 seconds, so a change in one session shows in every other. The keep-warm window stays with the session that started it.

Every row and message this mod draws (the band row in each state, the held-send notice, the status line text, the guard's and the log's lines) is named in the Components tab of `/mods`.

With [skins](https://github.com/mvacoimbra/claude-skins) installed and its usage band on, the time until the cache goes cold shows in that band, and this mod's own row steps aside.

The refusal, verbatim:

    cache-tax: the prompt cache went cold 2h00m ago. Sending this re-writes up to 200,502 tokens at $20/MTok = $4.01 (a warm turn would have cost $0.05). Send it again to pay it, and keepwarm will then hold the cache for 3h00m. Or /clear and start from a note.

The figure is an upper bound. The context count the engine reports for a resumed session is the last response's input, cache read, cache write and output together, and the resume payload carries no separate output count to take off; on one 15-day-old session the refusal said 330,316 tokens and $6.61 and the write that followed was 314k tokens, $6.28.

While the guard holds a cold send, the terminal and Desktop Code tab also show a notice above the prompt with the same figures and a Dismiss button. It goes away when you send again, dismiss it, or the next turn lands.

While keepwarm is armed, the terminal and Desktop Code tab show a row above the prompt in the pack's shared style: the cache icon (the Cache Tax cube on terminals that draw images), `Cache`, the state as a dot and a word, and the countdown in skins' wording, such as `kept warm 5h12 · ping in 38m`. The word is `warm` (green), `cold` (red), `stopped` (red, with its reason) or `waiting` (grey, before the first turn or after compaction), so color is never the only signal. Colours come from the skin chosen in skins, Claude Code's own without it. Other terminals show `[>]` in place of the cube. A nonempty `NO_COLOR` selects a bold `[>]` and an uncolored state word. These states use the same one-hour clock as the tab; they are estimates, not a live server cache check.

The row includes the warming window, next ping and last readback. Stop or an expired window removes the row. Surveys temporarily take priority, and other mods' content stays in the band. Sessions without this band retain the plain status text.

The icon and the cube follow Claude's light or dark theme. The cube's terminal image also has a contrasting edge for terminal backgrounds that differ from that setting. The embedded assets come from the website's official SVGs; maintainers can regenerate them with `python3 tools/generate-status-icons.py` and `rsvg-convert` installed. No image files are read or fetched at runtime.

The mod reads the theme and `NO_COLOR` once when the session starts. Accepted theme changes update the icon immediately; ordinary redraws do not reread either setting. Set `NO_COLOR` before starting the session.

## Both forms installed

The hook and the mod share a name and a job, so having both means two guards on every cold send. The mod checks at session start whether the hook's `/cache-tax:status` command exists and says so once. Keep one guard. The hook remains an option for people who prefer settings hooks. Before uninstalling it, check your status line: the 🧊 row wired to `cache-tax.js` comes from the hook's files. This mod draws above the prompt while keepwarm is armed; it does not replace your shell status line.

## What it can reach

Validated on Claude Code 2.1.290:

    ❯ ./register.ts hooks: engine.create, cachetax.panel, cachetax.act, cachetax.state, cachetax.catalog, config.set{key=theme}, ui.render{component=AbovePrompt}, session.start, classic.SessionStart, prompt.submit, turn.step, turn.complete, session.compact
    ❯ ./register.ts calls: $.clock.after (via arm), $.clock.every, $.clock.now, $.command.list, $.config.list, $.env.get, $.model.fork (via ping), $.session.id, $.session.model, $.session.usage, $.skins.band (via skinsShowsCache), $.skins.palette (via skinOf), $.store.delete (via actOn, prune, startWindow, stop), $.store.get, $.store.set (via actOn, startWindow), $.ui.invalidate, $.ui.log, $.ui.resolve, $.ui.status
    ❯ ./register.ts env reads: NO_COLOR

Reach L2, drives Claude. Sees every prompt you type, every model request's timing and every answer's token counts.

    Threat model for cache-tax (reach L2, drives Claude)
    1. Reads:    of each prompt, whether it starts with a slash and nothing else (the text is passed on untouched, never kept, never logged); the time; the token counts and model id the engine already holds on turn.complete and on the fork's reply; the resume fields Claude Code computes for settings hooks; the command list, the session id and, when a resumed session's fields carry no model id, the session's model once at start; from its own $.store, the keepwarm deadline and the ping period keyed by session id, plus the user's always switch and guard mode, read again before the /mods tab draws, before a cold send is judged, and every 3 seconds
    2. Runs:     one $.model.fork per idle stretch inside a keepwarm window, one per ping period (50 minutes unless the testing knob set it, floor 1 minute), never outside the window, never onto a cache the mod already knows is cold, never after a readback that read nothing or wrote at least a tenth of what it read
    3. Sends:    nothing leaves the machine except the fork, an API request over the session's own transcript with a fixed one-line prompt
    4. Persists: in $.store, the keepwarm deadline and the ping period under this session's id, and the always switch and the guard mode for every session; a window that has ended is deleted at stop and at this session's next start, together with the bare keys of a 2.1.0 store; another session's keys are never deleted here, because a read followed by a delete cannot be made atomic against that session renewing its window, so a session that armed keepwarm and never came back leaves two small keys behind; the session's cold-write tally lives in memory and dies with the session
    5. Hostile input: the only text it parses is the argument of its two commands, matched against a duration regex and five literals; of the prompt text only the first non-blank character is inspected, for a slash; tool results and files never reach a branch; the fork's prompt is a constant, so nothing crafted can be sent through it; a refusal only ever drops the user's own message, and the resend is unconditional; if a hook throws, the engine skips it and the message enters unguarded, with one dim line

## Cost and the plan-limit question

Prices are the list table, where Fable 5.1 reads at $0.25, writes the 1h tier at $20 and answers at $50 per million tokens; Sonnet 5 has its own row ($0.20, $4, $10). On an API key the arithmetic is plain. A ping bills the cache read, its own few uncached tokens at the base rate, and whatever the model says back at the output rate; the displayed ping cost counts all of it, since a fork takes no output cap and a model at high effort may think before it says "warm". A comeback after the lapse is a write. The card prints the read-only upper bound for your model, 80 pings on Fable 5.1, with the idle that covers at the current ping period; a real ping costs a little more than a read, so the true break-even sits below that number. On a subscription the dollars are a yardstick, not the bill, and how a cache read weighs against the 5-hour and weekly limits is not documented anywhere I could find. Watch the rate-limit row of your status line during the first window.

## Limits

- Mods require Claude Code 2.1.287+. They are on by default, but local settings, safe mode or organization policy can prevent them from loading. See [mod controls](https://code.claude.com/docs/en/plugins/mods/overview#turn-mods-on-or-off).
- The 50-minute schedule needs a one-hour main cache. Included subscription usage has it by default. Other billing paths need [`promptCacheTtl`](https://code.claude.com/docs/en/prompt-caching#choose-the-ttl-yourself) set to `"1h"`.
- One transcript-verified return at the default interval, Fable 5.1 on a subscription, 19 September 2026: keepwarm armed at minute 42 of a break, the ping fired at minute 50 and read 157k, and the message sent at minute 62 read 156,886 tokens from cache and wrote 2,255. Claude Code's own cache countdown reset to 58 minutes after the ping, so the fork carried the one-hour TTL. One run, one configuration: it shows the ping kept that cache alive past the hour, not net savings for every setup. Claude Code documents forks in its non-main request bucket, normally five minutes. In this run, the fork still read the one-hour session prefix and reset the native countdown. That is observed behavior in one configuration, not proof that every provider handles the buckets identically.
- A ping that reads warm proves the cache was warm then. Prefix changes can invalidate the cache regardless of time. The exact effect depends on the model and when Claude Code applies the change; see [Claude Code's cache behavior](https://code.claude.com/docs/en/prompt-caching).
- Resume fields let the guard check the first ordinary send after resuming. If those fields are absent, the first turn seeds its clock and context.
- The refusal's token count is an upper bound: it is the context the engine reports for the last response, which on a resume includes that response's output, and the mod has no separate output count to subtract.
- The cold-write tally is per session and in memory; /clear empties it.
- Context size is the engine's live window figure. A turn's own usage is its responses summed, which on a ten-step turn is ten reads of the context, so it is only the fallback where the host reports no live figure.

## Local development

From a local checkout, load it for one session:

    claude --plugin-dir .

To keep it installed, use the [marketplace commands](#install).

## Prove it on your own session

The mock-clock tests prove the timer, the guard and the scoring, not that a fork hits the main cache. One ping proves that, and it costs a cache read plus the answer. In any warm session:

    > Reply with one word: ready

Then type `1h every 1m` in the tab's Other duration field.

Watch the row above the prompt after a minute, or the plain status text on other surfaces. `last ping read 20k $0.01` reports the fork's readback. `keepwarm stopped: the ping read ... and wrote ...` means the readback did not meet the warm threshold; the loop has stopped. An API failure, interruption, empty reply or missing conversation also stops the loop with a reason. Older engines that return null show a combined cold-snapshot or API-failure message. Finish with Stop. This short check establishes a cache read, not retention across the default 50-minute interval.

## Tests and typecheck

Run from the repository root:

```sh
claude plugin validate .claude-plugin/plugin.json
claude plugin test .
```

The [56 tests](tests/register.test.ts) use a mock clock and engine. They cover:

- **Guard:** refuse once and resend, warn mode, slash commands, small contexts, resume seeding and cold-write scoring.
- **Warming:** command defaults, always/off, idle resets, usage-based stopping, cold-window expiry and delayed timers after sleep.
- **Session state:** isolated store keys, restored windows, legacy cleanup, clear/compaction resets and subagent isolation.
- **Pricing and display:** model matching, output and uncached input costs, context counts, duration formatting and the read-only break-even figure.
- **Indicator:** terminal images and desktop SVGs, theme selection, warm/cold transitions, resume, compaction, clear, expiry, surveys, other mods' content, text alternatives and `NO_COLOR` fallback.
- **Preferences:** one read per session, immediate theme updates, denied changes and the effective theme returned by the settings writer.
- **Fork failures:** structured failure results from current engines and the null result returned by older releases stop without retrying.

The render tests check the element tree, not native terminal or desktop pixels. They do not validate server-side cache retention. See [the live check](#prove-it-on-your-own-session).

### Typecheck

Load this checkout with `claude --plugin-dir .` to generate declarations beside the plugin. Then, from the repository root:

```sh
npx -p typescript tsc -p .
```

Generated declarations live in `.claude-plugin/types/`. Keep them untracked.
