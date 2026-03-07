# CLAUDE.md — apple2js Codebase Guide

## Project Overview

apple2js is an Apple II and Apple IIe emulator written in TypeScript and HTML5. It runs in a browser using Canvas and WebGL rendering, emulates the 6502/65C02 CPU (via a git submodule), and supports a wide range of Apple II peripherals and disk formats.

Two emulator targets are produced:
- **Apple ][js** (`apple2js.html`) — Apple II emulator
- **Apple //jse** (`apple2jse.html`) — Apple IIe emulator

---

## Development Setup

```bash
# Initial setup (required after cloning)
git submodule init
git submodule update
npm install

# Development server with hot reload
npm start
# Open http://localhost:8080/apple2js.html or http://localhost:8080/apple2jse.html

# Production build to dist/
npm run build

# Run tests
npm test

# Lint all files
npm run lint

# Auto-fix lint issues
npm run lint-fix
```

---

## Technology Stack

| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | 5.5.3 | Primary language (strict mode) |
| Preact | 10.22.1 | UI component framework (React-compatible) |
| Webpack | 5.92.1 | Bundler (3 output bundles) |
| Jest | 29.5.0 | Test runner |
| ESLint | 8.x | Linting |
| Prettier | 3.x | Code formatting |
| Stylelint | 15.x | SCSS linting |
| SCSS | — | Component styles |

**Key git submodules** (in `submodules/`):
- `@whscullin/cpu6502` — 6502/65C02 CPU emulator
- `apple2shader` — WebGL shaders for CRT rendering

---

## Repository Structure

```
apple2js/
├── js/                    # All TypeScript source code
│   ├── apple2.ts          # Core Apple2 emulator class
│   ├── apple2io.ts        # I/O bus, slots, peripherals
│   ├── mmu.ts             # Memory Management Unit (Apple IIe)
│   ├── ram.ts             # RAM page implementation
│   ├── videomodes.ts      # Video mode abstractions
│   ├── canvas.ts          # Canvas 2D renderer
│   ├── gl.ts              # WebGL renderer
│   ├── types.ts           # Core type definitions (bit, byte, word, etc.)
│   ├── main2.ts           # Apple II initialization
│   ├── main2e.ts          # Apple IIe initialization
│   ├── entry.tsx          # Preact app entry
│   ├── entry2.ts          # Apple II webpack entry
│   ├── entry2e.ts         # Apple IIe webpack entry
│   ├── prefs.ts           # User preferences
│   ├── symbols.ts         # Debugger symbol table
│   ├── util.ts            # General utilities
│   ├── cards/             # Expansion card implementations
│   ├── components/        # Preact UI components
│   ├── formats/           # Disk image format handlers
│   ├── applesoft/         # Applesoft BASIC interpreter
│   ├── intbasic/          # Integer BASIC interpreter
│   ├── roms/              # ROM images (system, character, card)
│   ├── ui/                # Low-level UI utilities (keyboard, audio, etc.)
│   ├── hooks/             # Preact custom hooks
│   └── util/              # Higher-level utilities
├── test/                  # Jest tests
│   ├── js/                # Core emulator tests
│   ├── components/        # Component tests
│   └── util/              # Test helpers (memory, BIOS, assertions)
├── css/                   # Global stylesheets and graphics
├── json/                  # Disk metadata and index
├── asm/                   # Assembly source files
├── bin/                   # CLI utilities (disk conversion, indexer)
├── workers/               # Web Workers (audio)
├── types/                 # Global TypeScript type declarations
├── submodules/            # Git submodules (cpu6502, apple2shader)
├── .github/workflows/     # CI (runs on Node 18.x and 20.x)
├── webpack.config.js
├── tsconfig.json
├── jest.config.js
├── .eslintrc.json
├── .prettierrc
└── .stylelintrc.json
```

---

## Key Source Files

### Emulation Core

| File | Description |
|------|-------------|
| `js/apple2.ts` | Main `Apple2` class — wires together CPU, I/O, memory, video |
| `js/apple2io.ts` | I/O bus — slot system, keyboard, joystick, game paddles |
| `js/mmu.ts` | Apple IIe memory management with bank switching |
| `js/ram.ts` | RAM page abstraction |
| `js/videomodes.ts` | Video mode state (text, lores, hires, double-hires) |
| `js/canvas.ts` | Canvas 2D renderer with dirty-region tracking |
| `js/gl.ts` | WebGL renderer (higher performance, CRT effects) |

### Expansion Cards (`js/cards/`)

| File | Card |
|------|------|
| `disk2.ts` | Disk II drive controller |
| `smartport.ts` | SmartPort (ProDOS block device) |
| `langcard.ts` | Language Card (48KB RAM expansion) |
| `ramfactor.ts` | RAMFactor (1MB RAM) |
| `parallel.ts` | Parallel printer interface |
| `mouse.ts` | Apple Mouse card |
| `thunderclock.ts` | Thunderclock real-time clock |
| `videoterm.ts` | Videx Videoterm 80-column card |
| `cffa.ts` | CompactFlash for Apple (CFFA) card |

### Disk Formats (`js/formats/`)

| File | Format |
|------|--------|
| `do.ts` | DOS 3.3 `.DO` |
| `po.ts` | ProDOS `.PO` |
| `nib.ts` | Nibble `.NIB` |
| `woz.ts` | WOZ (modern standard) |
| `2mg.ts` | 2MG container |
| `d13.ts` | 13-sector format |
| `block.ts` | Generic block device interface |
| `http_block_disk.ts` | HTTP-streamed block disk |
| `create_disk.ts` | Disk creation helpers |

### UI Components (`js/components/`)

The UI is built with **Preact** (React-compatible). Key components:

| File | Purpose |
|------|---------|
| `App.tsx` | Root application |
| `Apple2.tsx` | Main emulator display |
| `Screen.tsx` | Canvas/WebGL screen |
| `ControlStrip.tsx` | Button controls |
| `FileModal.tsx` | Disk image file picker |
| `Debugger.tsx` | Integrated debugger |
| `AudioControl.tsx` | Audio controls |
| `DiskDragTarget.tsx` | Drag-and-drop disk loading |

---

## Core Abstractions

### `bit`, `byte`, `word`, `nibble` (js/types.ts)

Semantic type aliases over `number`. Not enforced at runtime but document intent clearly. Use them consistently.

```ts
import { bit, byte, word } from 'js/types';
```

### `Memory` / `MemoryPages` Interface

```ts
interface Memory {
    read(page: byte, offset: byte): byte;
    write(page: byte, offset: byte, value: byte): void;
}

interface MemoryPages extends Memory {
    start(): byte;  // Start page
    end(): byte;    // End page (inclusive)
}
```

All memory-mapped components implement `MemoryPages`.

### `Card` Interface

All expansion cards implement:

```ts
interface Card<StateT = unknown> extends Memory, Restorable<StateT> {
    reset?(): void;
    blit?(): ImageData | undefined;
    tick?(): void;
    ioSwitch(off: byte, val?: byte): byte | undefined;
}
```

### `Restorable` Interface

Components that support state save/restore (for snapshots) implement:

```ts
interface Restorable<T = unknown> {
    getState(): T | Promise<T>;
    setState(state: T): void;
}
```

---

## TypeScript Configuration

TypeScript runs in **strict mode** with several additional strict flags:

```json
{
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "strictNullChecks": true
}
```

**Important rules:**
- Never use `any` — it is an ESLint error (`@typescript-eslint/no-explicit-any: error`)
- Unused parameters must be prefixed with `_` (e.g., `_unused`)
- Explicit type declarations are preferred; `@typescript-eslint/no-inferrable-types` is off

**JSX:** Preact's `h` and `Fragment` are used instead of React's:
```ts
// tsconfig.json
"jsxFactory": "h",
"jsxFragmentFactory": "Fragment"
```

**Path aliases** (usable in imports):
```ts
import something from 'js/types';    // → js/types.ts
import data from 'json/some/file';   // → json/some/file
import helper from 'test/util/...';  // → test/util/...
```

---

## Code Style

Enforced by Prettier and ESLint. Key rules:

- **Indentation:** 4 spaces (no tabs)
- **Quotes:** Single quotes
- **Semicolons:** Required
- **Trailing commas:** ES5 style (in arrays and objects, not function params)
- **Line endings:** Unix LF
- **`const` preferred** over `let`; `var` is forbidden
- **`===` required** (no `==`, except with `null`)
- **`console.log` forbidden** — use `console.info`, `console.warn`, or `console.error`
- TypeScript interface members separated by semicolons

Run `npm run lint-fix` to auto-correct most style issues before committing.

---

## Testing

**Framework:** Jest 29 with ts-jest and Testing Library

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
```

**Test locations:**
- `test/js/` — unit tests for emulation core
- `test/components/` — Preact component tests
- `test/util/` — shared test utilities (memory helpers, BIOS simulation, assertion helpers)

**Test file naming:** `*.test.ts`, `*.spec.ts`, or `*.test.tsx`

**Image snapshots:** Some rendering tests use `jest-image-snapshot` for pixel-level regression testing. Snapshot files are stored under `__image_snapshots__/`.

**CSS Modules in tests:** Mocked via `identity-obj-proxy` — class names are returned as-is.

**Coverage exclusions:** `js/roms/` and test files themselves are excluded from coverage.

---

## Webpack Build

Three bundles are produced:

| Bundle | Entry | Output |
|--------|-------|--------|
| Apple II (legacy) | `js/entry2.ts` | `dist/main2.js` |
| Apple IIe (legacy) | `js/entry2e.ts` | `dist/main2e.js` |
| Preact app | `js/entry.tsx` | `dist/apple2js.bundle.js` |

The Preact bundle is the primary modern UI. The legacy bundles support standalone HTML pages (`apple2js.html`, `apple2jse.html`).

---

## Disk Image Management

To add disk images to the library:

```bash
# Convert a disk image to JSON format
./bin/dsk2json -c "Category" -n "Name" path/to/image.dsk > json/disks/image.json

# Regenerate the disk index after adding images
npm run index
# equivalent to: ./bin/index > json/disks/index.js
```

Disk images in `json/disks/` are served as static assets.

---

## UI Patterns (Preact)

- Use **functional components** with hooks, not class components
- Component styles use **CSS Modules** (`.scss` files imported alongside components)
- Available custom hooks:
  - `usePrefs` — user preference state
  - `useHotKey` — keyboard shortcut registration
  - `useHash` — URL hash state management
- The ESLint `react-hooks/exhaustive-deps` rule is enforced — keep dependency arrays accurate
- The JSX pragma is `h` from `preact`, not `React.createElement`:
  ```tsx
  import { h } from 'preact';
  ```

---

## ESLint Overrides by File Type

| Glob | Special rules |
|------|--------------|
| `js/ui/**.ts` | Non-null assertions (`!`) allowed (DOM access) |
| `bin/*, webpack.config.js, babel.config.js` | `console.log` allowed, Node env |
| `test/**/*` | `console.log` allowed, Jest + Node env |
| `workers/*` | Uses `workers/tsconfig.json` |

---

## CI / GitHub Actions

CI runs on **Node 18.x and 20.x** and executes:
1. `npm install`
2. `npm run lint`
3. `npm test`

All PRs should pass lint and tests before merging.

---

## Common Pitfalls

1. **Forgetting submodule init** — The cpu6502 and apple2shader submodules must be initialized before building. Run `git submodule init && git submodule update`.

2. **Using `any`** — Strictly forbidden. Use proper types or `unknown` with type guards.

3. **JSX pragma** — This project uses Preact's `h`, not React. Don't import from `react`; use `preact` instead.

4. **Unused parameters** — Must be prefixed with `_` or removed. TypeScript will fail to compile otherwise.

5. **`console.log`** — Forbidden in production code. Use `console.warn` or `console.error`.

6. **`==` vs `===`** — Always use `===`. The ESLint `eqeqeq: smart` rule allows `== null` for nullish checks only.

7. **CSS class access in tests** — CSS modules are proxied as identity objects in Jest; class names resolve to themselves.
