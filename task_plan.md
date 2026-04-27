# Task Plan: System-Level Architecture Review And Refactor Plan

## Goal
Build a grounded mental model of how jif currently works, identify subsystem boundaries and architectural rough edges, and produce a refactor plan aimed at orthogonal, reusable, understandable abstractions.

## Current Phase
Complete through Phase 15

## Phases

### Phase 1: Bootstrap And Core Flow Discovery
- [x] Capture user intent and constraints
- [x] Trace startup flow from CLI entry to first rendered frame
- [x] Identify top-level control points and data flow
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Subsystem Mapping
- [x] Group code into coherent subsystems
- [x] Describe responsibilities and boundaries
- [x] Note coupling, leaks, and duplicated mechanisms
- **Status:** complete

### Phase 3: Refactor Opportunity Analysis
- [x] Identify repeated patterns and special cases
- [x] Derive general principles underneath repeated logic
- [x] Propose target abstractions and migration seams
- **Status:** complete

### Phase 4: Refactor Plan Synthesis
- [x] Sequence the work into reviewable stages
- [x] Call out risks, validation strategy, and dependencies
- [x] Produce concise delivery notes for the user
- **Status:** complete

### Phase 5: Delivery
- [x] Review analysis for internal consistency
- [x] Deliver subsystem map and refactor plan to the user
- **Status:** complete

### Phase 6: Initial Refactor Implementation
- [x] Extract the shared command-runner mechanics out of `src/ui/render.tsx`
- [x] Rewire the existing command execution entrypoints to use the shared runner
- [x] Add focused tests and run broad regression validation
- **Status:** complete

### Phase 7: Controller Extraction
- [x] Extract the inlined command controller from `src/ui/render.tsx`
- [x] Rewire the view to consume the extracted controller factory
- [x] Add focused controller tests and rerun broad validation
- **Status:** complete

### Phase 8: Persistence And Prompt Extraction
- [x] Extract a typed persistence facade for layout, command history, revset history, and active revset state
- [x] Move prompt components and prompt-local keyboard/history/completion behavior into `src/ui/prompts.tsx`
- [x] Rewire `src/ui/render.tsx` to consume the extracted seams and rerun focused validation
- **Status:** complete

### Phase 9: Runtime And Startup Extraction
- [x] Extract the remaining command/revset/elided runtime callbacks from `src/ui/render.tsx`
- [x] Move palette/theme/resize startup helpers behind `src/ui/startup.ts`
- [x] Add focused runtime/startup tests and rerun broad regression validation
- **Status:** complete

### Phase 10: Status Render Extraction
- [x] Extract the status surface and message overlay cluster out of `src/ui/render.tsx`
- [x] Keep pure status timing/color helpers on a non-JSX utility boundary
- [x] Add focused validation and rerun broad regression validation
- **Status:** complete

### Phase 11: Autocomplete Popup Chrome Tweak
- [x] Add an explicit popup frame around autocomplete suggestions
- [x] Keep the scrollbox inside the frame while preserving direct attachment to the prompt border
- [x] Add focused render validation for the bordered popup treatment
- **Status:** complete

### Phase 12: Command Bar Placeholder Tone Adjustment
- [x] Add one dimmer semantic text level for low-emphasis prompt copy
- [x] Apply the new level to the command-bar placeholder without changing other prompt placeholders
- [x] Add focused config validation for the new semantic color tier and rerun prompt-slice validation
- **Status:** complete

### Phase 13: Revert Placeholder Tone Experiment
- [x] Verify whether OpenTUI is actually consuming the command-bar `placeholderColor`
- [x] Revert the temporary `textQuinary` experiment and restore the command-bar placeholder to `textQuaternary`
- [x] Rerun focused config and prompt validation after the revert
- **Status:** complete

### Phase 14: Prompt Border Junction Tweak
- [x] Add focused prompt rendering coverage for the command-bar top border when autocomplete is visible
- [x] Switch the command-bar top corners to T-junctions only while suggestions are present
- [x] Rerun focused prompt and autocomplete validation after the tweak
- **Status:** complete

### Phase 15: Revert Autocomplete Chrome Experiments
- [x] Remove the temporary command-bar T-junction treatment and delete its focused render test
- [x] Remove the autocomplete frame and replace it with one non-scrolling blank row in the parent container
- [x] Move row padding into the suggestion rows so selection highlight covers the visible blank columns
- [x] Rerun focused autocomplete validation after the revert
- **Status:** complete

## Key Questions
1. What is the controlling runtime model of the app: command-driven state machine, view-driven renderer, or a hybrid?
2. Which responsibilities are currently spread across multiple modules that should instead be centralized?
3. Where are similar behaviors implemented through separate ad hoc paths instead of a shared abstraction?
4. What refactor sequence improves conceptual clarity without destabilizing the app?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Analyze from bootstrap inward | The clearest way to build a cohesive model is to start at app startup, then follow state, command, data, and rendering flow. |
| Keep the task exploratory and planning-focused | The user asked first for a mental model and refactor plan, not implementation changes. |
| Model the current app as a hybrid with a view-owned application controller | This best explains why state helpers are fairly pure while orchestration still concentrates in `JifView`. |
| Keep render-row helpers largely intact in the refactor plan | The strongest architectural pressure is in orchestration and command/prompt flows, not in the visual row helper modules. |
| Start implementation with the shared command runner | This is the highest-value low-risk extraction because three duplicated execution paths already existed in `JifView`. |
| Extract the command controller before startup/prompt orchestration | The large controller object in `JifView` was the next densest orchestration hotspot and could be isolated with injected callbacks. |
| Extract persistence and prompt seams before the last runtime/startup helpers | Removing view-owned history/settings and prompt-local behavior first made the remaining render-layer orchestration small and easier to isolate cleanly. |
| Finish this refactor wave by extracting runtime/startup helpers instead of splitting state next | That leaves `JifView` primarily as a composition root without opening the wider `state/store.ts` migration in the same pass. |
| Extract the status surface as a cluster, not as individual atoms | `StatusArea`, `MessageOverlay`, and `StatusToast` share one visual/runtime concern, while the pure timing/color helpers are better left in a `.ts` utility module. |
| Keep autocomplete popup chrome local to `AutocompleteList` plus prompt height accounting | The visual imbalance came from a missing frame rather than prompt semantics, so the safest change was a bordered parent container around the existing scrollbox. |
| Add a fifth text tier instead of reusing a chrome token for the command-bar placeholder | The placeholder was already on `textQuaternary`, so the only semantically coherent way to dim it one more step was to extend the text hierarchy with `textQuinary`. |
| Revert the temporary command-bar placeholder experiment after verifying the render path | OpenTUI does apply `placeholderColor`, so once the user confirmed they preferred the original tone, the right fix was to remove `textQuinary` entirely instead of debating whether the prop was ignored. |
| Use prompt-shell top T-junctions instead of changing the autocomplete popup frame | The visual seam was at the command bar's top corners, so the smallest fix was to swap only those characters when suggestions are present and leave the popup frame itself unchanged. |
| Revert the autocomplete frame and prompt T-junction experiments in favor of layout-only spacing | The border treatments looked heavier than the underlying issue, so the better fix was a plain spacer row above the suggestions and row-owned padding that lets the selected background fill the visible margins. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Re-read this plan before shifting from discovery to synthesis.
- Capture concrete duplication sites, not just broad impressions.
- Prefer subsystem boundaries that match user-visible mental models and test seams.
- Favor extraction of application services before deeper state redesign so tests and behavior can stay stable during the first steps.
- Keep the next implementation slice adjacent: extract controller/orchestration seams without rewriting healthy render helpers.
- The remaining `render.tsx` work is now much closer to root composition than to app-controller logic.