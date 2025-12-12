# Travail Module

## Overview

The Travail module provides lightweight task and project tracking inside OdbVue. It is centered around **boards** (each board defines task statuses/priorities via JSON settings) and **tasks** that can be viewed as a Kanban board or as a due-date calendar.

Travail is available to authenticated users and includes:

- Board selection and board settings management
- Task creation and editing
- Drag & drop task moves and ordering (rank)
- Task details page with comments (Markdown) and file attachments
- A background **AI assistant job** that can analyze image attachments and store the generated analysis on the note

## User Stories

- **View a board**: As a user, I can open `/travail` and see tasks grouped by status.
- **Switch view modes**: As a user, I can toggle between *Board* and *Calendar* views.
- **Create a task**: As a user, I can create a new task (optionally as a child of an existing task).
- **Edit task details**: As a user, I can edit title, due date, priority, status, effort, and assignee.
- **Move tasks**: As a user, I can drag a task to another status column.
- **Reorder tasks**: As a user, I can drag a task between other tasks to update its rank within a column.
- **Filter tasks**: As a user, I can click task chips (e.g., due date, assignee) to filter the board.
- **Comment and attach files**: As a user, I can add Markdown comments and upload attachments to a task.
- **Download attachments**: As a user, I can download files previously attached to notes.

## UI (Pages)

Travail uses file-based routing.

- **Travail home** (`/travail`)
  - Toggles between:
    - `TravailBoardView` (Kanban board)
    - `TravailCalendarView` (monthly calendar)
  - Initializes data by calling `travail.init()` on mount.
  - Source: `apps/src/pages/travail/index.vue`

- **Boards management** (`/travail/boards`)
  - Table CRUD for boards (edit/add) and an action to select the active board.
  - Uses the generic `v-ov-table` / `useTableFetch` and `useFormAction` helpers.
  - Source: `apps/src/pages/travail/boards.vue`

- **Task details** (`/travail/[num]`)
  - Displays an editable form for a task.
  - For existing tasks, shows comments/notes with pagination.
  - Notes render Markdown to HTML (client-side) and can include attachments.
  - Source: `apps/src/pages/travail/[num].vue`

## Frontend Architecture

### Store

State and API calls are centralized in a Pinia store:

- Store: `useTravailStore`
- Source: `apps/src/pages/travail/travail.ts`

Persisted fields (localStorage adapter):

- `key` (active board key)
- `viewMode` (`board` | `calendar`)
- `boardFilters` (per-board active filters)

Key store responsibilities:

- Load boards + tasks (`init`, `getBoards`, `getTasks`)
- Change active board (`setActiveBoard`)
- Create/update task (`postTask`) and normalize payload (notably the `assignee` field)
- Change status (`postTaskStatus`)
- Rank/move tasks (`postTaskMove`, `postTaskRank`)
- Compute display chips (`taskDetails`)
- Notes pagination and create (`fetchNotesPage`, `postNote`)
- File download (`downloadFile`)

### Board View (Kanban)

The Kanban view groups tasks by status and sorts by:

1. `rank_value` (ascending)
2. `created` (descending)

It uses an HTML5 drag & drop composable to:

- Move a task to another status (drop on column)
- Re-rank a task between other tasks (drop on “gap” slots)

Source: `apps/src/pages/travail/_components/TravailBoardView.vue`

### Calendar View

The calendar view displays tasks with a due date as events in a monthly calendar. Clicking an event opens the corresponding task.

Source: `apps/src/pages/travail/_components/TravailCalendarView.vue`

## Board Settings

Board settings are stored as JSON in the database (`tra_boards.settings`). The UI exposes settings editing as a raw JSON textarea.

The default shape (see `DEFAULT_SETTINGS_TEXT` in `boards.vue`) includes:

- `due_warn_before_days`
- `statuses[]` with `value`, `title`, and formatting metadata (`attrs.format.color`)
- `priorities[]` with `value`, `title`, and formatting metadata
- `units` (used for effort display)

Example:

```json
{
  "due_warn_before_days": 5,
  "statuses": [
    {"value": "todo", "title": "To Do", "attrs": {"format": {"color": "warning"}}},
    {"value": "doing", "title": "In Progress", "attrs": {"format": {"color": "info"}}},
    {"value": "done", "title": "Done", "attrs": {"format": {"color": "success"}}}
  ],
  "priorities": [
    {"value": "attention", "title": "Attention", "attrs": {"format": {"color": "warning"}}},
    {"value": "high", "title": "High", "attrs": {"format": {"color": "error"}}}
  ],
  "units": "days"
}
```

## Data Model (Database)

Travail data lives in the `tra_*` tables.

- `tra_boards`
  - Board key, title/description, and JSON `settings`

- `tra_tasks`
  - Task record; includes due/reminder/start/completed timestamps and effort fields
  - `num` is a virtual column: `key || '-' || id`

- `tra_ranks`
  - Per-task rank value used for ordering within a board/status column

- `tra_links`
  - Parent/child relationships between tasks (for “child task” creation)

- `tra_notes`
  - Notes for a task, optionally linked to stored files
  - Has optional `assistant` content populated by the AI assistant job

A full reference schema for local/test usage exists in `db/tests/travail.sql`.

## API

The UI calls the following endpoints (prefix `tra/`). Backend procedures are implemented in `odbvue.pck_tra`.

All Travail endpoints require authentication; the package checks `pck_api_auth.uuid` and returns HTTP 401 if missing.

### Boards

- `GET tra/boards/` → `pck_tra.get_boards`
  - Query params: `filter` (URL-encoded JSON), `search`, `offset`, `limit`

- `POST tra/board/` → `pck_tra.post_board`
  - Body: `{ data: encodeURIComponent(JSON.stringify(boardPayload)) }`

### Tasks

- `GET tra/tasks/` → `pck_tra.get_tasks`
  - Query params: `filter` (URL-encoded JSON), `search`, `offset`, `limit`

- `POST tra/task/` → `pck_tra.post_task`
  - Body: `{ data: encodeURIComponent(JSON.stringify(taskPayload)) }`
  - Supports optional `parent` linking (creates a row in `tra_links`)

- `POST tra/rank/` → `pck_tra.post_rank`
  - Params: `num`, `before`, `after`
  - Used for reordering within the same board/status column

### Assignees

- `GET tra/assignees/` → `pck_tra.get_assignees`
  - Query params: `search`, `offset`, `limit`

### Notes and Attachments

- `GET tra/notes/` → `pck_tra.get_notes`
  - Query params: `filter` (URL-encoded JSON; typically `{ "num": ["TRA-1"] }`), `offset`, `limit`

- `POST tra/note/` → `pck_tra.post_note`
  - Accepts comment text and optional files.
  - The frontend uses `processFormDataWithFiles` to encode files into JSON (base64 content), and the backend stores them in `app_storage`.

- `GET tra/download/{fileId}` → `pck_tra.get_download`
  - Streams the file from `app_storage`.

## Background Job: AI Assistant

Travail includes a scheduled job that enriches notes containing image attachments.

- Scheduler job: `ODBVUE.TRA_JOB` (see `db/src/database/odbvue/jobs/tra_job.sql`)
- Package procedure: `pck_tra.job_assistant`

Behavior:

- Picks up `tra_notes` rows with a `storage_id` and `assistant IS NULL`
- Reads the stored file content (from `app_storage`)
- Calls `pck_api_openai.vision` using model `gpt-5`
- Stores the generated analysis (or error text) into `tra_notes.assistant`

### Configuration

The assistant job reads the API key from settings:

- `TRA_OPENAI_API_KEY` (via `pck_api_settings.read('TRA_OPENAI_API_KEY')`)

## Internationalization

Travail translations live under:

- `apps/src/i18n/travail/en.json`

`de.json` and `fr.json` currently exist but are empty placeholders.
