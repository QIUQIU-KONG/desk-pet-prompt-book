# Data And Privacy Model

## Storage Location

The Electron main process creates the prompt store at:

```text
<Electron userData>/data/prompts.json
```

On Windows this is commonly `%APPDATA%\desk-pet-prompt-book\data\prompts.json`, but Electron and the operating system determine the actual `userData` path.

The file is UTF-8 JSON and is **not encrypted at rest**. The application currently has no database server, account, cloud sync, telemetry, or intentional prompt-library upload path.

## Top-Level Schema

The current file uses `schemaVersion: 1` and these collections:

```json
{
  "schemaVersion": 1,
  "prompts": [],
  "projects": [],
  "stages": [],
  "keywords": [],
  "viewState": {}
}
```

### Prompt

| Field | Meaning |
| --- | --- |
| `id` | Generated stable identifier |
| `projectId` | Optional project; `null` means pending organization |
| `stageId` | Optional stage belonging to the selected project |
| `title` | Derived from the first non-empty content line, then editable |
| `content` | Prompt body copied from the clipboard or edited by the user |
| `note` | User-maintained note |
| `keywordIds` | References to reusable keywords |
| `rating` | Integer from 0 through 5 |
| `pinned` | Prompt pin state |
| `createdAt`, `updatedAt` | ISO timestamps |
| `lastUsedAt`, `useCount` | Copy/reuse history |

### Project

A project represents one workflow or review space. It contains an ID, name, optional description, pin state, and timestamps. Deleting a project does not delete its prompts; it clears their project/stage references so they return to the pending filter.

### Stage

Stages belong to exactly one project and contain a name, display order, hidden state, and timestamps. New projects receive independent copies of the default stage template. Later changes affect only that project.

### Keyword

Keywords are reusable global labels. Removing a keyword from one prompt does not delete the keyword record. Prompt queries decorate keyword IDs with names before searching and rendering.

### View State

`viewState` stores the last library/project view, last project, explicit current-project marker, pending filter, sort mode, and stage filter. Search text is intentionally not restored. Legacy `all` and `inbox` view values are normalized to the single-library model.

## Capture Rules

Clipboard text is read only after the explicit desktop-pet capture gesture.

Before persistence, the store:

1. converts CRLF and CR line endings to LF;
2. trims surrounding whitespace;
3. rejects an empty result;
4. rejects an exact duplicate of normalized prompt content; and
5. derives a title from the first non-empty line, capped at 80 characters.

New prompts start with `projectId: null` and therefore appear under the pending filter. The explicit current-project marker does not silently change capture destination.

## Query And Search

Search covers prompt title, body, note, and resolved keyword names. With a search term, the renderer requests global library search by default; current-view-only is an explicit option.

The smart sort order is:

1. pinned prompts;
2. higher rating; and
3. most recent use, update, or creation timestamp.

Alternative sort modes cover rating, recent use, and recent update.

## Save Semantics

Mutations in one app instance are serialized in invocation order. Each mutation loads the current JSON model, applies normalization and relationship invariants, writes a formatted sibling `.tmp` file, and renames it to `prompts.json`. The same validated snapshot is written to `prompts.json.bak` for local recovery.

Invalid collection types become empty collections. A prompt whose project no longer exists returns to the pending state; missing or cross-project stage references and missing keyword references are cleared without deleting the prompt.

The queue protects concurrent actions inside one app process. The store is not a multi-process database, so independently launched app instances must not share and write the same `userData` directory.

## Clipboard And Copying

Capture reads text from the system clipboard. Copying a stored prompt writes the body back to the clipboard and persists `lastUsedAt` and `useCount`.

The application cannot control operating-system clipboard history or what another local application does with copied text. Deleting a prompt does not remove copies from clipboard history, filesystem backups, or other software.

## Browser Preview

The browser preview does not use the Electron preload bridge. It uses browser clipboard APIs when permission and context allow, and an in-memory preview model for UI development. Browser permission denial is expected behavior and does not imply that Electron persistence has failed.

## Diagnostics

On startup, renderer, or prompt-store recovery failures, the main process may append technical details to `<Electron userData>/startup-log.txt`. Recovery entries contain the recovery kind, reason, and local file names, not prompt bodies. The file remains local and is not intentionally uploaded. Review it for personal paths or sensitive runtime context before sharing.

## Backup, Restore, And Deletion

- Exit the application before copying or replacing `prompts.json`.
- Keep the existing file until a restored backup has been validated.
- The application maintains `prompts.json.bak` from the latest successful save.
- If the primary file is invalid, it is preserved as `prompts.json.corrupt-*` and the valid backup is restored. If neither file is valid, both invalid files are quarantined and a new empty store is created.
- Delete one prompt through the in-app confirmation flow.
- Delete all prompt-library and recovery data by closing the app and removing `data/prompts.json`, `data/prompts.json.bak`, and any `data/prompts.json*.corrupt-*` files.
- Delete all application state by closing the app and removing its entire `userData` directory.

Do not hand-edit the files while the app is running. Automatic recovery preserves invalid input for diagnosis, but it cannot reconstruct content when both the primary file and backup are unreadable.

## Privacy Change Gate

Any change involving background clipboard monitoring, new stored fields, network requests, telemetry, accounts, import/export, encryption, or retention must update this document, [`PRIVACY.md`](../PRIVACY.md), tests, and the pull request's privacy assessment.
