# Copilot Instructions for AI Coding Agents

## Project Overview
- This project is a full-stack AI Studio app with a React (TypeScript) frontend and a Node.js (Express) backend.
- The frontend is in the root directory; backend code is in the `backend/` folder.
- The app uses a Gemini API key (set in `.env.local`) for AI features.

## Key Components
- **Frontend:**
  - Main entry: `index.tsx`, `App.tsx`
  - State management: `store.ts`
  - Type definitions: `types.ts`
  - UI components: `components/` (e.g., `AdminDashboard.tsx`, `Auth.tsx`, etc.)
- **Backend:**
  - Express server: `backend/server.js`
  - Data persistence: `backend/sessions.json` (JSON file-based session storage)
  - Database logic: `backend/db.js`

## Developer Workflows
- **Install dependencies:** `npm install` (run in root and in `backend/` if needed)
- **Run frontend:** `npm run dev`
- **Run backend:** `node backend/server.js`
- **Environment:** Set `GEMINI_API_KEY` in `.env.local` for AI features

## Patterns & Conventions
- **Component structure:** Each dashboard/user role has a dedicated component in `components/`
- **State:** Centralized in `store.ts`, types in `types.ts`
- **Backend:** Uses file-based storage (`sessions.json`) instead of a database
- **API communication:** Frontend communicates with backend via HTTP (see `backend/server.js` for routes)
- **No tests or build scripts** are present by default; add as needed

## Integration Points
- **Gemini API:** Used for AI features; key required in `.env.local`
- **Session management:** Handled via `sessions.json` in backend

## Examples
- To add a new user role, create a new component in `components/` and update routing/state as needed
- To persist new data, update logic in `backend/db.js` and `backend/sessions.json`

## References
- See `README.md` for setup and run instructions
- See `backend/server.js` for backend API structure
- See `store.ts` and `types.ts` for state and type patterns

---
For questions or unclear patterns, review the referenced files or ask for clarification.
