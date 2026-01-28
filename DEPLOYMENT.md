# Multi-Port Deployment Guide

This application supports running multiple instances on different ports for different companies.

## Configuration

### Backend (.env in backend/ folder)
Create a `.env` file in the `backend/` directory with the port for each instance:

```env
# For Company 1 (default)
PORT=3001

# For Company 2
# PORT=3002
```

### Frontend (Automatic)
No `.env.local` needed! The frontend automatically reads the backend port from `backend/.env` via `vite.config.ts`.

## Running Multiple Instances

### Company 1 (Port 3001)
1. **Backend Setup**: Set `PORT=3001` in `backend/.env`
2. **Start backend**: `cd backend && node server.js`
3. **Start frontend**: `npm run dev`
   - Frontend automatically connects to `http://127.0.0.1:3001` via proxy

### Company 2 (Port 3002)
1. **Backend Setup**: Set `PORT=3002` in `backend/.env`
2. **Start backend**: `cd backend && node server.js`
3. **Start frontend**: `npm run dev` (on a different port, e.g., 5174)
   - Frontend automatically connects to `http://127.0.0.1:3002` via proxy

## Production Deployment

### For Production Frontend Build:
If deploying to a different host/domain, override the backend URL:

```bash
# Build for Company 1 API
VITE_BACKEND_URL=https://company1-api.example.com npm run build

# Or for Company 2 API
VITE_BACKEND_URL=https://company2-api.example.com npm run build
```

Otherwise, the frontend defaults to the backend port from `backend/.env`.

## Architecture

- **vite.config.ts**: Reads `PORT` from `backend/.env` and sets up proxy routes
  - `/api/*` → backend at `http://127.0.0.1:{PORT}/api`
  - `/uploads/*` → backend uploads at `http://127.0.0.1:{PORT}/uploads`
- **Frontend Components**: Use centralized `store.ts` for all API calls
  - Automatic token-based authentication
  - Centralized file uploads (chat, forum, member work submissions)
  - Dynamic config fetched from backend

## Key Changes

- ✅ No `.env.local` needed for development
- ✅ Backend port auto-detected from `backend/.env`
- ✅ Centralized API communication via store.ts
- ✅ Fixed image path handling (no duplicate `/uploads`)
- ✅ Removed unused `config.ts`
