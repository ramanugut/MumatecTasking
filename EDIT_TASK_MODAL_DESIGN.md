# Edit Task Modal Design Overview

This document captures the intended feature set for the new Edit Task modal.
It is based on the comprehensive project requirements.

## Tabbed Interface
- **Details Tab** – Core fields including status, estimate, time spent and notes.
- **Comments Tab** – Threaded comments with avatars, emoji reactions and drafts.
- **Activity Tab** – Chronological history of all task actions.
- **Attachments Tab** – Upload area with drag & drop and file previews.

Keyboard shortcuts (Ctrl+1..Ctrl+4) switch between tabs. The last active tab is
remembered per user session.

## Real‑Time Collaboration
- Presence indicators when other users are viewing or typing.
- Auto‑refresh of comments and activity streams.
- Conflict resolution when multiple edits occur simultaneously.

## Task Relationships
- Visualise dependencies, subtasks and related issues.
- Ability to create or unlink relations from within the modal.

## Time Tracking
- Start/stop timer widget to log work.
- Summary of estimated versus actual effort with billable flag.

## Notifications
- Users can watch/unwatch a task for updates.
- @mentions trigger notifications.

## Responsive Behaviour
The modal adapts to small screens using collapsible tabs and swipe gestures.

This design assumes the additional Firestore collections outlined in
`DATABASE_SCHEMA.md` are available.
