# MySummarizer — Claude Context

## Project Overview

This is a **SillyTavern third-party extension** that builds a persistent memory system for roleplay sessions. It analyzes chat history with an LLM, breaks it into scenes, extracts character data, and stores everything in SillyTavern's Lorebook (World Info) system so it persists across sessions.

Author: Pedro Lenorio (pauloht on GitHub)

---

## Language & Build

- **Source language:** TypeScript (`src/` folder)
- **Output:** Plain JavaScript files in the project root (compiled by `tsc`)
- **SillyTavern loads** `index.js` from the root — never edit root `.js` files directly

### Build commands (run from project root)
```
npm run build    # one-time compile
npm run watch    # auto-compile on save (recommended during dev)
```

### Config files
- `tsconfig.json` — compiles `src/**/*.ts` → root `*.js`, target ES2020, module ESNext
- `package.json` — devDependency: typescript

---

## File Organization

```
MySummarizer/
├── src/                          ← ALL source code lives here
│   ├── types/
│   │   └── sillytavern.d.ts     ← type stubs for SillyTavern globals & modules
│   ├── index.ts                  ← extension entry point, slash command registration
│   ├── my_lorebook.ts            ← lorebook read/write abstraction (World Info API)
│   ├── myutil.ts                 ← general utilities (e.g. extractJson)
│   ├── xmlutil_memory.ts         ← XML serialization for memory entries
│   └── xmlutil_characters.ts    ← XML serialization for character entries
│
├── prompts/
│   └── scene_breakdown.txt      ← system prompt sent to LLM for scene analysis
│
├── index.js                      ← compiled output (do not edit)
├── my_lorebook.js                ← compiled output
├── myutil.js                     ← compiled output
├── xmlutil_memory.js             ← compiled output
├── xmlutil_characters.js         ← compiled output
│
├── manifest.json                 ← SillyTavern extension manifest (points to index.js)
├── style.css                     ← extension UI styles
├── tsconfig.json
├── package.json
└── CLAUDE.md                     ← this file
```

---

## SillyTavern Concepts

### How extensions work
- SillyTavern loads `index.js` as an ES module directly in the browser
- Extensions import from SillyTavern core via relative paths like `../../../extensions.js`
- These paths are browser-relative, not filesystem paths — they work at runtime but TypeScript can't resolve them at compile time

### Key SillyTavern APIs used
| API | Source | Purpose |
|-----|--------|---------|
| `getContext()` | `extensions.js` | Gets current chat context (characterId, chat history, generateRaw) |
| `loadWorldInfo(name)` | `world-info.js` | Loads a lorebook by name |
| `createWorldInfoEntry(book, data)` | `world-info.js` | Creates a new entry in a lorebook |
| `saveWorldInfo(name, data)` | `world-info.js` | Persists lorebook changes |
| `reloadEditor(name)` | `world-info.js` | Refreshes the UI after save |
| `getCurrentChatId()` | `script.js` | Returns the current chat's unique ID |
| `SlashCommandParser` | `slash-commands/SlashCommandParser.js` | Registers slash commands |
| `toastr` | global | Browser toast notifications |
| `jQuery` / `$` | global | jQuery, available globally in ST |

### Lorebook storage strategy
Loreebooks are used as a key-value store. Each lorebook is named using a slug pattern:
```
{MODULE_NAME}-{chatId}-{subSection}
```
Example: `lenoriogarden-chat-abc123-debug`

Entries within a lorebook are looked up by their `comment` field (used as a title/key).

### SillyTavern type stubs
Since core ST files can't be resolved by TypeScript, `src/types/sillytavern.d.ts` contains:
- Ambient module declarations matching `*extensions.js`, `*script.js`, etc.
- Global declarations for `toastr`, `jQuery`, `$`
- Interface definitions for `STContext`, `STMessage`, `WorldInfoData`, `WorldInfoEntry`

All SillyTavern imports in source files use `// @ts-ignore` as a fallback safety.

---

## Slash Commands

Registered in `src/index.ts` via `SlashCommandParser`:


---

## LLM Pipeline

1. Visible chat messages are filtered (excluding system, hidden, extra messages) and concatenated
2. The text is saved to lorebook under `SUBSECTION_DEBUG / KEY_DEBUG_CHAT_CONTENT`
3. `scene_breakdown.txt` is fetched via HTTP and used as the system prompt
4. `context.generateRaw({ systemPrompt, prompt, prefill })` sends it to the active LLM
5. The JSON response is extracted with `extractJson()` (strips markdown code fences)
6. Result is saved to lorebook under `SUBSECTION_CHARACTER / KEY_DEBUG_JSON_SCENE_BREAKDOWN`

### Scene breakdown JSON format
```json
{
  "narrative_analysis": {
    "scenes": [
      {
        "scene_number": 1,
        "title": "Short Title Here",
        "short_description": "1-2 sentence summary.",
        "participants": [
          {
            "name": "CharacterName",
            "feelings": ["Happy", "Excited"],
            "perception": "Positive",
            "reasoning": "One sentence justification."
          }
        ]
      }
    ]
  }
}
```

## Lorebook Subsection Keys

Constants defined in `src/index.ts`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `SUBSECTION_DEBUG` | `"debug"` | Debug/raw data subsection |
| `SUBSECTION_CHARACTER` | `"characters_data"` | Character and scene data |
| `KEY_DEBUG_CHAT_CONTENT` | `"my_debug"` | Raw visible chat dump |
| `KEY_DEBUG_JSON_SCENE_BREAKDOWN` | `"json_scene_breakdown"` | LLM scene analysis output |
| `KEY_INTERNALINFO_ARRAY_CHARACTERS` | `"characters_list"` | All characters ever seen |
| `KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS` | `"new_characters_list"` | Characters from last sweep |
