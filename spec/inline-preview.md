# Inline Preview

## Intent

jif should eventually support an inline preview surface for prompt-driven pickers
that need more context than a row label can carry.

The file search prompt should use that preview surface when it exists. The
preview should show the diff for the highlighted file, using the same focused
revision context that the rest of the UI uses for file operations.

## Current Status

Inline preview is not implemented yet. File search currently shows fuzzy file
path suggestions in the bottom prompt and applies the selected file revset
without rendering a diff preview.
