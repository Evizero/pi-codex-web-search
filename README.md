# pi-codex-web-search

Pi extension that enables native Codex `web_search` tool calls (with Codex auth/model gating).

## What it does

This package appends native Responses web search to provider payloads so the model can call:

- `search`
- `open_page`
- `find_in_page`

It only activates when all are true:

1. Active model is Codex (`provider = openai-codex` or `api = openai-codex-responses`, including `openai-codex/gpt-5.4`)
2. Codex OAuth exists in pi auth storage (`openai-codex`)
3. Codex token resolves successfully

By default, behavior mirrors Codex CLI defaults:

- mode: `cached` (`external_web_access: false`)
- `search_context_size`: omitted
- `filters.allowed_domains`: omitted
- `user_location`: omitted

## Install

```bash
pi install git:github.com/Evizero/pi-codex-web-search
```

Then reload:

```bash
/reload
```

## Configure (optional)

Use normal pi settings files:

- Global: `~/.pi/agent/settings.json`
- Project: `.pi/settings.json` (overrides global)

Add:

```json
{
  "extensions": {
    "codexWebSearch": {
      "enabled": true,
      "mode": "cached",
      "allowedDomains": ["example.com"],
      "contextSize": "high",
      "userLocation": {
        "country": "US",
        "city": "New York",
        "timezone": "America/New_York"
      }
    }
  }
}
```

Fields:

- `enabled`: boolean (default `true`)
- `mode`: `"disabled" | "cached" | "live"` (default `"cached"`)
- `allowedDomains`: string[]
- `contextSize`: `"low" | "medium" | "high"`
- `userLocation`: `{ country?, region?, city?, timezone? }`
