# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **collaborative real-time text editor** with a Next.js frontend and Node.js/Socket.IO backend. Multiple users can join shared editing sessions where one user acts as the "owner" (master) and others can suggest edits that the owner reviews and applies.

## Architecture

### Two-Project Structure

```
TextEditorApp/
├── learn_ms/          # Next.js 16 frontend (React 19, TypeScript)
└── nodejslms/         # Express 5 + Socket.IO backend
```

### Frontend (`learn_ms/`)

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Editor**: Slate.js with custom real-time sync
- **State Management**: Custom `useSyncExternalStore` pattern via `useSyncstore.js`
- **Styling**: Tailwind CSS v4

**Key Files**:
- `app/page.tsx` - Entry point, renders `HOMEPAGE` component
- `app/homepage.tsx` - Group creation/join screen (username, group name, key)
- `app/reports/page.tsx` - Wrapper for editor
- `app/reports/reports.tsx` - Socket.IO connection management
- `app/reports/slateedit.jsx` - Main Slate editor with sync logic
- `app/reports/toolbar.jsx` - Rich text formatting toolbar
- `app/useSyncstore.js` - Custom store for cross-component state sync

### Backend (`nodejslms/`)

- **Server**: Express 5 with Socket.IO 4
- **Port**: 8000
- **CORS**: Restricted to `http://localhost:3000`

**Key Concepts**:
- `connected_owners` array tracks room owners (users with `owner: true`)
- Non-owner clients must provide valid `key` to join a group
- Owners receive edit suggestions from non-owners via `sendchanges_masters` event

## Development Commands

### Frontend (`learn_ms/`)
```bash
cd learn_ms
npm run dev    # Start Next.js dev server on port 3000
npm run build  # Production build
npm run start  # Start production server
npm run lint   # Run ESLint
```

### Backend (`nodejslms/`)
```bash
cd nodejslms
node index.js  # Start Socket.IO server on port 8000
```

## Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `joingroup` | Client→Server | Join a room with username, group, key, owner flag |
| `sendGroupMessage` | Client→Server | Broadcast editor state (owner only) |
| `sendchanges_masters` | Client→Server | Send edit suggestions to owner |
| `receive_message` | Server→Client | Receive broadcasted messages |
| `youjsutjoined` | Server→Client | Confirmation of joining a group |
| `recieve_editted` | Server→Client | Owner receives edit suggestions |

## Editor Sync Flow

1. **Owner** sends full editor state via `sendGroupMessage` on every change
2. **Non-owners** accumulate local operations and send via `sendchanges_masters`
3. **Owner** sees suggestions in a panel with APPLY/CANCEL buttons
4. Applied changes are decorated with the contributor's color

## Notes

- Backend URL hardcoded as `http://127.0.0.2:8000` in `reports.tsx` (may need fixing to `127.0.0.1`)
- Custom store (`useSyncstore.js`) uses a module-level `storedata` array for cross-component communication
- Editor uses `useSyncExternalStore` for reactive updates from the custom store
