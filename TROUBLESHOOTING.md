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

---

## Problem 4: Webhook Validation Passing but Data Not Persisting (Return to Original Issue)
**Date**: 2026-08-12
**Severity**: CRITICAL
**Error**: `Success. No rows returned` when querying Supabase after webhook

### Root Cause (Updated)
Previous attempt to fix webhook processing failed due to env var loading issue. After implementing start.js to load .env.production:
1. Webhook validation: ✅ PASSING (returns success:true with correct eventId)
2. Processor invocation: UNKNOWN (fire-and-forget, no direct error visibility)
3. Database persistence: 🔄 TESTING (about to verify in Supabase)

### Solution (Verification Step)
1. Query Supabase conversations table: Check if new conversation was created
2. Query messages table: Check if message "NOVO TEST!" was inserted
3. If no rows: Check PM2 logs for processor errors and add more detailed logging

### Current Action
Just sent webhook:
```
messageId: 550e8400-e29b-41d4-a716-446655440011
senderPhone: 5511988888888
messageText: "NOVO TEST!"
timestamp: 1723493857
```

Expected result: New conversation + message in Supabase

### Verification Result
❌ **FAILED** - `total_conversations = 0` - NO DATA PERSISTED

This confirms the processor is still not working despite env var fix attempt.

### Status
❌ FAILED - Webhook endpoint succeeds but processor still fails silently

---

## Problem 5: Processor Still Failing Despite Environment Variables Loaded
**Date**: 2026-08-12
**Severity**: CRITICAL
**Error**: Webhook returns success:true but no data in Supabase (total_conversations = 0)

### Root Cause (Investigation)
1. ✅ Webhook endpoint runs (returns 200 success)
2. ✅ Validation passes (event is correct)
3. ✅ processZApiWebhook() is being called (fire-and-forget)
4. ❌ But NO data appears in database after processing

Possible causes:
- Environment variables NOT actually being loaded by start.js
- Error thrown in processor but caught and logged only (hidden)
- RLS policies still blocking inserts
- Processor throwing exception before reaching database

### Solution (Next Step)
1. Check PM2 logs for any "[Z-API Processor Error]" or "[handleReceiveEvent]" messages
2. Add console.log at START of handleReceiveEvent to verify processor is actually running
3. If processor doesn't start: verify env vars are loaded in start.js
4. If processor starts but fails: identify exact error point

### Implementation
Check VPS logs:
```bash
pm2 logs iaezap --lines 200 | grep -i "processor\|handleReceive\|webhook"
```

### Status
🔄 IN PROGRESS - Investigating processor execution
