# Findings & Decisions

## Requirements
- Build an internal mental model of the current architecture.
- Decompose the system into coherent subsystems.
- Identify rough edges, duplication, and over-specialized paths.
- Produce a refactor plan oriented around orthogonal, reusable mental models.
- Focus on current behavior and structure before proposing implementation changes.

## Research Findings
- The repo already records two local facts: graph child navigation prefers current visible rows over spawning `jj`, and startup profiling highlights palette detection and module loading as major startup costs.
- Runtime startup is a narrow chain: `src/index.ts` parses CLI/config and resolves repo path, `src/app.ts` selects layout and constructs `AppStore` plus `JjClient`, and `src/ui/render.tsx` performs the first real orchestration work.
- `src/state/appStore.ts` is primarily an adapter layer that exposes imperative actions but delegates nearly all state transitions to pure functions in `src/state/store.ts`.
- `src/ui/render.tsx` appears to be the main integration hub. It handles initial loading, palette updates, repository refresh wiring, command execution, async file loading, interactive command launching, and rendering concerns in one place.
- `src/commands/definitions.ts` is a declarative command catalog, but its controller interface is large and mirrors many one-off handlers implemented in `JifView`.
- `src/ui/startup.ts` and `src/ui/repositoryRefresh.ts` are small orchestration helpers, but the app still lacks a single explicit application-service layer. Helpers exist, yet `JifView` remains responsible for composing them.
- `src/modes.ts` introduces a second command-routing model beside `commandDefinitions`: mode inheritance and key binding resolution are centralized, but command availability also lives in command definitions and state helpers, so command semantics are split across at least three places.
- Persistence is conceptually split between workspace-scoped history/settings in `src/history/store.ts` and global settings in `src/config/globalSettings.ts`/`src/app.ts`, suggesting multiple small persistence models rather than one settings/history subsystem.
- `src/jj/process.ts` is a clean process boundary, but interactive and non-interactive command handling force UI-level branching because the higher-level command runner abstraction is thin.
- `src/domain/types.ts` shows one large `AppState` aggregate carrying repository data, navigation state, command composition state, search state, settings, and transient status/event state together.
- The input route itself is reasonably clean: `src/ui/keyboard.ts` normalizes keys, `src/ui/keybindings.ts` dispatches based on `src/modes.ts`, and `src/commands/definitions.ts` provides declarative command metadata.
- After dispatch, the architecture becomes less orthogonal. `JifView` owns the `CommandController`, so the same file both renders UI and implements application actions.
- There are at least three closely related command-execution flows in `JifView`: `executeCurrentCommand`, `runJjCommand`, and `runInteractiveJjCommand`. They share command parsing, failure recording, status/event updates, refresh behavior, and post-command cleanup with small variations.
- `src/state/store.ts` is not only a reducer module; it also mixes selectors, command-template evaluation, navigation helpers, and UI decision logic. It behaves more like a combined domain/state toolkit than a single-purpose store reducer file.
- State cancellation behavior (`cancelOrBlurState`) is centralized, which is good, but it also reveals how many concerns are cohabiting in one state machine: search, notifications, command focus, shortcut panel, draft commands, selections, and file expansion.
- Command composition is split between state and UI. `src/state/store.ts` owns template evaluation, target/source selection, command preview segments, and executability checks, while `src/ui/render.tsx` prompt components own history loading, keyboard behavior, and submit semantics.
- Prompt handling uses local `useKeyboard` hooks inside prompt components (`CommandPrompt`, `SearchPrompt`) rather than a single input state machine, so the app has both global key routing and component-local input behavior paths.
- `CommandPrompt` constructs `HistoryStore` instances directly and fetches command history reactively from within the view. This is a small but repeated example of persistence responsibilities living in the rendering layer.
- The rendering helper cluster under `src/ui/` is mostly well-factored and presentational. The architectural pressure is concentrated less in row rendering and more in orchestration and prompt/command behavior.
- Tests reflect this split: there is strong direct coverage of store, keymap, and helper behavior, but the highest-level integration behavior still appears to be centered around `render.tsx` composition rather than a thinner application layer.

## Current Mental Model
- The current runtime model is a hybrid: a fairly pure state toolkit and a fairly pure rendering-helper toolkit are both coordinated by a view-owned application controller in `src/ui/render.tsx`.
- `src/index.ts` and `src/app.ts` are thin bootstrap layers. They mostly assemble dependencies and then hand control to `JifView`.
- `AppStore` is an imperative shell over immutable-style state transforms. That is a solid local pattern, but the state surface itself is too broad to cleanly represent one mental model.
- The rendering stack has two distinct personalities:
  - revision-row helpers are mostly presentational and policy-oriented in a healthy way;
  - prompt, history, refresh, and command execution logic are orchestration-heavy and live inside the render layer.
- The command system is split into at least five conceptual steps: key normalization, key-to-command routing, command metadata, command state composition, and command execution. Those steps exist, but not as one cohesive subsystem.

## Proposed Subsystems
- Bootstrap and runtime shell: CLI parsing, config loading, sample-repo selection, dependency assembly, renderer startup.
- Repository gateway: all `jj` process execution, output parsing, refresh, repository verification, and interactive command launching.
- Application controller: startup sequencing, command dispatch side effects, refresh policy, error handling, post-command cleanup, focus adjustments, and persistence coordination.
- State model: repository state, navigation state, command composition state, prompt/search state, selection state, and chrome/status state.
- Input and command subsystem: key normalization, mode routing, command registry, command intent resolution, prompt sessions, and autocomplete/history navigation.
- Presentation subsystem: revision row layout, gutters, borders, headers, file rows, shortcut panel layout, status overlays, and passive prompt rendering.
- Persistence subsystem: workspace-scoped history/settings plus global settings through one typed interface with explicit scope.

## Rough Edges And Duplication
- `JifView` is doing at least three jobs at once: root view, application controller, and command runner.
- `src/state/store.ts` is doing at least four jobs at once: reducers, selectors, command-composition engine, and UI policy helpers.
- Command execution is implemented three ways with mostly shared mechanics: `executeCurrentCommand`, `runJjCommand`, and `runInteractiveJjCommand`.
- Command semantics are distributed across mode selection (`src/modes.ts`), command metadata (`src/commands/definitions.ts`), store-derived state (`src/state/store.ts`), and view handlers (`src/ui/render.tsx`).
- Prompt behavior is split between global input dispatch and component-local keyboard handlers.
- Persistence is split between workspace and global scopes with no single typed abstraction, and some persistence calls are initiated directly from view components.
- `AppState` groups together durable model state, transient prompt state, effect/status state, and user preferences. That makes cancellation logic and focus transitions more complex than they need to be.

## General Principles Beneath The Special Cases
- Most command actions are special cases of one general operation pipeline: resolve intent, optionally gather context, execute sync or interactive `jj`, record outcome, refresh repository, then reconcile UI state.
- Most prompt surfaces are special cases of one prompt-session model: text value, history provider, autocomplete provider, navigation behavior, apply behavior, cancel behavior, and focus policy.
- Most persistence is a scoped key-value or append-history concern. The distinction is scope and typing, not fundamentally different mechanisms.
- Most state transitions fall into a few buckets: browsing/navigation, composition, transient overlays/messages, and repository snapshot replacement.

## Target Refactor Shape
- Keep bootstrap thin.
- Introduce an application-service layer between `JifView` and lower-level state/client helpers.
- Split state logic by concern without losing the current pure-function style.
- Collapse command execution into one operation runner with policy options instead of multiple near-duplicate flows.
- Treat prompts as first-class sessions instead of one-off component behaviors.
- Preserve the existing presentational helper decomposition for revision rendering unless a specific helper later proves leaky.

## Implemented Refactor Slice
- Added a shared command runner in `src/commands/runner.ts` that centralizes:
	- command parsing into retryable tracked-command metadata,
	- success and failure publication policy,
	- loading-state handling,
	- last-failed-command capture,
	- repository refresh on success,
	- optional history recording and focus-after-refresh policy.
- Rewired `executeCurrentCommand`, `runJjCommand`, and `runInteractiveJjCommand` in `src/ui/render.tsx` to delegate to that shared runner.
- Removed the duplicated local `createTrackedCommand` and `recordFailedCommand` helpers from `src/ui/render.tsx`.
- This does not yet extract a full controller, but it meaningfully narrows the responsibilities of `JifView` and makes the command/effect path more explicitly one-way: intent -> runner policy -> store effects -> reactive view.
- Added `src/ui/controller.ts` as an extracted command-controller factory.
- Rewired the large inlined `CommandController` object in `src/ui/render.tsx` to use that factory with injected callbacks for command execution, refresh, elided expansion, layout persistence, and shortcut-panel logging.
- Added focused controller tests in `test/controller.test.ts` covering representative controller behaviors: interactive squash confirmation, retry forcing, elided expansion delegation, on-demand file loading, and layout persistence.
- Added `src/persistence/service.ts` as a typed facade over global layout settings plus workspace-local command history, revset history, and active revset persistence.
- Rewired `src/app.ts` and `src/ui/render.tsx` to consume that persistence facade instead of constructing lower-level persistence mechanisms directly.
- Added `src/ui/prompts.tsx` and moved `PromptShell`, `CommandPrompt`, `CommandPreview`, `SearchPrompt`, and `RevsetPrompt` there so prompt-local keyboard/history/completion behavior is no longer embedded in the main view module.
- Added `src/ui/runtime.ts` as a small runtime service holding the remaining command/revset/elided effect paths: `executeCurrentCommand`, `runJjCommand`, `runInteractiveJjCommand`, `expandElidedRevisions`, and `applyRevsetQuery`.
- Expanded `src/ui/startup.ts` with `createPaletteDetector` and `bindViewRendererEvents` so palette/theme/resize startup wiring is also owned outside `src/ui/render.tsx`.
- Added `src/ui/statusArea.tsx` as a dedicated render cluster for the bottom status surface plus transient message overlay and toast rendering.
- Kept `src/ui/statusMessages.ts` as the non-JSX status helper module, now housing both toast-dismiss timing and status-level-to-color mapping.
- Added focused tests for the new seams in `test/persistenceService.test.ts`, `test/runtime.test.ts`, and `test/uiStartup.test.ts`, and revalidated prompt behavior through the existing autocomplete/completion/history tests.
- Added focused status validation in `test/statusArea.test.ts` and preserved the existing `test/statusMessages.test.ts` timing coverage.
- This leaves `JifView` much closer to a root composition layer: it assembles dependencies, binds startup helpers, and renders presentation-oriented surfaces while delegating most effectful orchestration outward.

## Validation Results
- Focused validation passed:
	- `bun test test/commandRunner.test.ts test/commands.test.ts`
	- `bunx tsc --noEmit`
- Broad validation passed:
	- `bun test`
- Controller extraction validation passed:
	- `bun test test/controller.test.ts test/commandRunner.test.ts test/commands.test.ts`
	- `bunx tsc --noEmit`
	- `bun test`
- Persistence extraction validation passed:
	- `bun test test/persistenceService.test.ts test/controller.test.ts test/commandRunner.test.ts test/commands.test.ts`
	- `bunx tsc --noEmit`
- Prompt extraction validation passed:
	- `bun test test/autocomplete.test.ts test/autocompleteRender.test.ts test/completions.test.ts test/historyStore.test.ts`
	- `bunx tsc --noEmit`
- Runtime/startup extraction validation passed:
	- `bun test test/uiStartup.test.ts test/runtime.test.ts test/controller.test.ts test/commandRunner.test.ts test/repositoryRefresh.test.ts`
	- `bunx tsc --noEmit`
- Status extraction validation passed:
	- `bun test test/statusArea.test.ts test/statusMessages.test.ts`
	- `bunx tsc --noEmit`
- Broad validation after the full extraction wave passed:
	- `bun test` (317 pass)

## Staged Refactor Plan
1. Extract a `JifController` or `AppController` from `src/ui/render.tsx`.
	- Move startup sequencing, refresh orchestration, command handlers, failure recording, and post-command cleanup into a controller/service object.
	- Keep the public behavior unchanged and keep `JifView` consuming a narrower interface.
   - Status: mostly implemented via `src/ui/controller.ts`, `src/ui/runtime.ts`, `src/ui/startup.ts`, and `src/persistence/service.ts`; `JifView` still acts as the root composition layer.
2. Introduce a single `CommandRunner` abstraction.
	- Unify `executeCurrentCommand`, `runJjCommand`, and `runInteractiveJjCommand` into one path that accepts policy flags such as interactive, record history, show toast style, and focus working copy after refresh.
	- Centralize command failure capture and retry metadata there.
   - Status: implemented.
3. Split `src/state/store.ts` into concern-based modules.
	- Separate reducers/transitions from selectors.
	- Separate command-composition/template logic into a `commandComposer` module.
	- Separate search/navigation helpers if they continue to grow.
4. Reshape `AppState` into explicit slices while preserving current APIs initially.
	- Suggested slices: `repository`, `navigation`, `selection`, `command`, `prompts`, `chrome`, `preferences`.
	- Keep `AppStore.actions` stable in the first pass and migrate internals underneath it.
5. Unify input and prompt handling.
	- Define a prompt-session model shared by command, revset, and search prompts.
	- Route prompt-local navigation behavior through shared prompt/session helpers instead of ad hoc `useKeyboard` blocks.
   - Status: partially implemented via `src/ui/prompts.tsx`; prompt components are extracted, but a shared prompt-session state model still remains future work.
6. Consolidate persistence behind one scoped service.
	- Introduce a typed persistence facade that exposes workspace history/settings and global settings with explicit scope.
	- Remove direct `HistoryStore` construction from view components.
   - Status: implemented for current layout/history/revset call sites.
7. Add higher-level tests around the new controller and command runner.
	- Preserve current focused helper tests.
	- Add integration-style tests around intent-to-effect behavior without depending on `render.tsx` as the only integration seam.
8. Continue extracting coherent render clusters only where they reduce change-surface overlap.
	- Prefer cluster-shaped modules like status/prompt surfaces over one-component-per-file splitting.
	- Keep screen-local row composition together unless a helper develops independent behavior or tests.

## Risk Notes
- The biggest risk is over-rotating into a frameworky abstraction before the controller boundary is extracted. Extract orchestration first, then reshape state and commands.
- The row-rendering helpers appear comparatively healthy; broad rewrites there would likely create churn without paying down the main complexity.
- The transition should preserve existing keyboard conventions, command-bar preview behavior, and immediate-execution UX from the current philosophy docs.
- The new command runner is intentionally policy-driven rather than framework-heavy; keeping it small reduces the risk of replacing duplication with over-abstraction.
- The extracted controller/runtime/startup helpers are still under `src/ui/`, which is a pragmatic intermediate step rather than the final subsystem boundary.

## Validation Strategy For The Refactor
- Maintain current store/helper tests during extraction.
- Add focused tests for the new controller/runner abstractions before moving more logic out of `JifView`.
- For each refactor stage, verify one end-to-end slice such as `rebase`, `restore`, `search`, and revset apply/save behavior.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use repo-root planning files for this exploration | The task spans many tool calls and needs persistent notes while synthesizing architecture. |
| Treat `JifView` as the current architectural center of gravity | Startup files are thin; most cross-subsystem behavior converges in the render layer. |
| Use `AppState` shape as a subsystem-discovery map | The state aggregate reveals which concerns the app currently treats as part of one runtime model. |
| Trace concrete behavior slices before proposing subsystem boundaries | The code has multiple thin helper layers; end-to-end paths show where the real responsibility currently sits. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| No existing planning files in repo root | Created task-specific planning files before deeper exploration. |
| Command semantics appear distributed across mode routing, command definitions, store helpers, and view handlers | Continue tracing one end-to-end command path before collapsing this into a refactor recommendation. |
| The `state/store.ts` filename understates its scope | Treat it as a mixed state/domain helper surface during analysis instead of assuming reducer-only responsibility. |
| Prompt behavior forms a second orchestration hotspot after `JifView` | Include prompt/history/search input flows in subsystem decomposition instead of treating them as minor UI details. |

## Resources
- [AGENTS.md](/Users/jrpat/src/jif/AGENTS.md)
- [src/index.ts](/Users/jrpat/src/jif/src/index.ts)
- [src/app.ts](/Users/jrpat/src/jif/src/app.ts)
- [src/state/appStore.ts](/Users/jrpat/src/jif/src/state/appStore.ts)
- [src/state/store.ts](/Users/jrpat/src/jif/src/state/store.ts)
- [src/ui/render.tsx](/Users/jrpat/src/jif/src/ui/render.tsx)
- [src/commands/definitions.ts](/Users/jrpat/src/jif/src/commands/definitions.ts)
- [src/ui/startup.ts](/Users/jrpat/src/jif/src/ui/startup.ts)
- [src/ui/repositoryRefresh.ts](/Users/jrpat/src/jif/src/ui/repositoryRefresh.ts)
- [src/modes.ts](/Users/jrpat/src/jif/src/modes.ts)
- [src/history/store.ts](/Users/jrpat/src/jif/src/history/store.ts)
- [src/jj/process.ts](/Users/jrpat/src/jif/src/jj/process.ts)
- [src/domain/types.ts](/Users/jrpat/src/jif/src/domain/types.ts)
- [src/ui/autocomplete.ts](/Users/jrpat/src/jif/src/ui/autocomplete.ts)
- [src/ui/AutocompleteList.tsx](/Users/jrpat/src/jif/src/ui/AutocompleteList.tsx)
- [test/commands.test.ts](/Users/jrpat/src/jif/test/commands.test.ts)
- [test/appStore.test.ts](/Users/jrpat/src/jif/test/appStore.test.ts)
- /memories/repo/graph-navigation.md
- /memories/repo/startup-profile.md

## Visual/Browser Findings
- None.

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*