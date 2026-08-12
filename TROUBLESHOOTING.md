# IAeZap Troubleshooting Log

## Problem 1: RLS Permission Denied on Webhook Processing
**Date**: 2026-08-12
**Severity**: CRITICAL
**Error**: `permission denied for table conversations`

### Root Cause
The z-api processor was calling `createSupabaseServerClient()` which requires `SUPABASE_SERVICE_ROLE_KEY` env var. However, Next.js production build does NOT automatically load `.env.production` file.

### Solution
Create a custom start.js script that loads `.env.production` before starting the server.

### Status
❌ FAILED - Next.js 16.3.0 doesn't use `.next/standalone/server.js`, uses different structure

---

## Problem 2: Missing server.js in .next/standalone/
**Date**: 2026-08-12
**Severity**: HIGH
**Error**: `Cannot find module './.next/standalone/server.js'`

### Root Cause
Next.js 16.3.0 uses a different build output structure. The server files are in `.next/server/` not `.next/standalone/server.js`.

### Solution
Use `next start` command (which handles the correct path internally) but load env vars first via shell export.

### Implementation
Modify package.json start script to:
```json
"start": "node -e \"require('dotenv').config({path:'.env.production'})\" && next start"
```
Or use pm2 with env_file option.

### Status
✅ FIXED - Created start.js that spawns `next start` with loaded env vars

---

## Problem 3: Windows Path in VPS Bash Command
**Date**: 2026-08-12
**Severity**: MEDIUM
**Error**: `-bash: cd: C:\Users\Kairo Lopes\OneDrive\...: No such file or directory`

### Root Cause
Executed a local Windows file path command directly in VPS (Linux) bash shell. The command was meant to run on local machine, not on VPS.

### Solution
Execute git commands locally on the development machine first (where the Windows paths exist):
1. Local: `git add start.js TROUBLESHOOTING.md && git commit && git push`
2. VPS: `git pull && npm run build && pm2 restart iaezap`

### Implementation
Keep commands in proper context:
- Local machine commands use Windows paths like `C:\Users\...`
- VPS commands use absolute paths like `/home/iaezap`

### Status
✅ FIXED - Execute commands in proper shell context
