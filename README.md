# pi-codex-web-search

Pi extension that enables native Codex `web_search` tool calls with Codex auth/model gating.

## What it does

This package appends native Responses web search to provider payloads so the model can call:

- `search`
- `open_page`
- `find_in_page`

It only activates when all are true:

1. The active model is Codex-compatible (`provider = openai-codex` or `api = openai-codex-responses`)
2. Codex OAuth exists in pi auth storage (`openai-codex`)
3. A Codex token resolves successfully
4. Web search mode is not `disabled`

By default, behavior mirrors Codex CLI defaults:

- `mode = "cached"`
- `context_size`: omitted
- `allowed_domains`: omitted
- `location`: omitted

## Install

```bash
pi install git:github.com/Evizero/pi-codex-web-search
```

Then reload:

```bash
/reload
```

## Configure (optional)

Follow pi's extension config-file pattern:

- Global: `~/.pi/agent/extensions/codex-web-search.json`
- Project: `.pi/extensions/codex-web-search.json`

Project config overrides global config.

Example:

```json
{
  "mode": "cached",
  "allowed_domains": ["example.com"],
  "context_size": "high",
  "location": {
    "country": "US",
    "city": "New York",
    "timezone": "America/New_York"
  }
}
```

Fields:

- `mode`: `"disabled" | "cached" | "live"` (default `"cached"`)
- `allowed_domains`: `string[]`
- `context_size`: `"low" | "medium" | "high"`
- `location`: `{ country?, region?, city?, timezone? }`

Notes:

- Run `/reload` after changing config.
- Invalid config is ignored with warnings.

## Development

This repo includes a minimal dev workflow that does not add install-time dependencies for users of the extension:

```bash
npm run lint
npm run fmt
```

`npm run lint` checks formatting and runs a TypeScript typecheck via a small script that looks for pi types in a local install, common global install locations, or `PI_CODING_AGENT_PATH`.

There is intentionally no checked-in machine-specific editor `tsconfig.json`; the lint script is the source of truth.
