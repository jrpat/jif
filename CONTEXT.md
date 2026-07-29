# jif

jif presents Jujutsu history as related keyboard-driven log surfaces and revision operation composers.

## Language

**Shortcuts panel**:
The contextual reference view of keybindings available in the current interaction mode.
_Avoid_: Keybindings panel, help panel

**Shortcut filter**:
A search constraint within the Shortcuts panel that shows only matching keybindings, ranked by fuzzy relevance in reading order.
_Avoid_: Keybinding search, shortcuts search

**Filter editing**:
The Shortcuts panel state in which the shortcut-filter query is being entered or changed.
_Avoid_: Search mode

**Applied shortcut filter**:
The Shortcuts panel state in which the emphasized results remain stable while their keybindings can be invoked.
_Avoid_: Pinned filter, locked results

**Log**:
A scrollable history surface with common movement, search, preview, and command-entry behavior.

**Revision Log Navigation**:
Focus movement among revisions using revision relationships and metadata such as parents, bookmarks, workspaces, divergence, and the working copy.

**Revision Draft**:
An in-progress revision operation whose source, target, or selection is composed against the revision log.
