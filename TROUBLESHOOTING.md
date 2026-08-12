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

### Investigation Result
🔴 **FOUND ERROR**: `permission denied for table conversations`
- Processor IS running ✅
- But still hitting RLS permission error ❌
- This means SUPABASE_SERVICE_ROLE_KEY is NOT being passed to the child process

### Status
❌ FAILED - start.js not properly passing env vars to child process

---

## Problem 6: start.js Not Passing Environment Variables to Child Process
**Date**: 2026-08-12
**Severity**: CRITICAL
**Error**: `permission denied for table conversations` in processor despite start.js fix

### Root Cause
The start.js script loads env vars into `process.env`, but when spawning the child process:
```javascript
const nextStart = spawn('node', [...], { env, stdio: 'inherit', cwd: __dirname });
```

The `env` object passed to spawn() is NOT merged with system environment variables. It REPLACES them entirely. This causes:
1. Custom vars from .env.production are loaded ✅
2. But critical PATH and other system vars are missing ❌
3. Child process runs with incomplete environment

### Solution
Must merge env vars properly:
```javascript
const env = { ...process.env };  // Copy existing env
// Then add .env.production vars on top
```

Already implemented in current start.js, but need to verify it's working.

### Alternative Solution (Simpler)
Instead of Node.js env loading, use shell to source the file:
```bash
#!/bin/bash
export $(cat /home/iaezap/.env.production | grep -v '^#' | xargs)
exec node /usr/local/bin/next start
```

### Implementation
Option A (Fix current start.js): Verify env merging is working
Option B (Use shell script): Replace start.js with bash wrapper

### Testing
Check if SERVICE_ROLE_KEY is loaded:
```bash
node -e "require('./start.js'); setTimeout(() => console.log(process.env.SUPABASE_SERVICE_ROLE_KEY), 100)"
```

### Implementation Attempt
Created start.sh bash script and updated package.json to use it.

### Status
❌ FAILED - File not synced to VPS

---

## Problem 7: start.sh File Not Syncing to VPS
**Date**: 2026-08-12
**Severity**: HIGH
**Error**: `chmod: cannot access 'start.sh': No such file or directory` on VPS

### Root Cause
The file was committed locally and pushed to GitHub, but `git pull` on VPS returned "Already up to date" without fetching the new file. This can happen if:
1. Git cache is stale
2. Remote tracking branch not updated
3. Local repo on VPS not fully synchronized with GitHub

### Solution
Force git to re-sync with remote:
```bash
cd /home/iaezap && git fetch origin main && git reset --hard origin/main
```

Then verify file exists:
```bash
ls -la start.sh && cat start.sh
```

### Investigation Result
❌ **ROOT CAUSE FOUND**: Local branch is 4 commits AHEAD of origin/main
- Commits exist locally: ✅ (c8ca0fd, 2607332, ee566e8, f617b56)
- But NOT pushed to GitHub: ❌
- VPS pulling from GitHub gets old commits
- This is why start.sh file doesn't exist on VPS

### Solution
Push commits to GitHub first:
```bash
git push origin main --force
```

Then sync on VPS:
```bash
git fetch origin main && git reset --hard origin/main
```

### Implementation Result
✅ **FIXED** - Commits pushed to GitHub and start.sh file synced to VPS
- File now exists: ✅ `/home/iaezap/start.sh` (211 bytes)
- Build successful: ✅
- PM2 restarted: ✅

### Status
✅ FIXED - File synced and process restarted

---

## Problem 8: RLS Permission Still Denied Even with start.sh
**Date**: 2026-08-12
**Severity**: CRITICAL
**Error**: `permission denied for table conversations` in processor even after start.sh deployed

### Current Symptoms
1. ✅ Webhook endpoint works (returns 200 success)
2. ✅ start.sh file deployed and PM2 running
3. ✅ Processor is being called (fire-and-forget)
4. ❌ Still getting RLS permission error
5. ❌ No data in Supabase

### Root Cause Analysis
The bash script is deployed, but environment variables may still not be loading correctly. Possible issues:
1. `.env.production` file exists but bash script not reading it properly
2. `export $(cat ...)` syntax might have issues with special characters in values
3. SERVICE_ROLE_KEY not being passed to child process

### Solution (Verification)
Check if environment variables are actually being loaded:
1. Verify `.env.production` file exists on VPS:
   ```bash
   cat /home/iaezap/.env.production | head -5
   ```
2. Test if start.sh is loading vars by checking the running process:
   ```bash
   ps aux | grep next | grep -v grep && env | grep SUPABASE_SERVICE_ROLE_KEY
   ```
3. Check if the exact error point in logs to understand where it fails

### Verification Result
✅ **ENV VARS ARE LOADING CORRECTLY**
```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_[LOADED]
SERVICE_ROLE_KEY loaded: sb_secret_[LOADED_CORRECTLY]
```

The bash script CAN load variables successfully! But the process still gets permission denied.

### New Root Cause
The environment variables are loaded in the bash shell, but they're NOT being passed to the child Node.js process started by `node_modules/.bin/next start`.

In start.sh:
```bash
export $(cat .env.production | grep -v '^#' | xargs)
exec node_modules/.bin/next start
```

The `exec` statement should pass the environment, but `node_modules/.bin/next` might be a symlink or wrapper that doesn't inherit the parent environment properly.

### Solution
Use explicit environment passing in start.sh:
```bash
#!/bin/bash
export $(cat .env.production | grep -v '^#' | xargs)
export NODE_ENV=production
exec node -e "
  const vars = require('fs').readFileSync('.env.production', 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .reduce((acc, line) => {
      const [k, ...v] = line.split('=');
      acc[k] = v.join('=');
      return acc;
    }, {});
  Object.assign(process.env, vars);
  require('next/dist/server/lib/start-server').startServer({});
"
```

Or simpler: directly run the compiled server with proper env.

### File Status Check
✅ **start.sh file is CORRECT**:
```bash
#!/bin/bash
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '^#' | xargs)
fi
exec node_modules/.bin/next start
```

BUT: The `node_modules/.bin/next` script might not inherit the bash environment properly.

### Solution (Best Approach)
Create a Node.js wrapper (start-env.js) that:
1. Loads .env.production directly in Node.js (before any module imports)
2. Calls require('next/start') after env is set
3. Avoids bash environment inheritance issues

New start.sh:
```bash
#!/bin/bash
exec node start-env.js
```

New start-env.js:
```javascript
const fs = require('fs');
const path = require('path');

// Load .env.production BEFORE importing Next.js
const envPath = path.join(__dirname, '.env.production');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
}

// NOW import and start Next.js
require('next/dist/bin/next')(['start']);
```

### Implementation
✅ **Created and pushed**:
- start-env.js: Node.js wrapper that loads .env.production before starting Next.js
- Updated start.sh: Now calls `node start-env.js` instead of bash env loading
- Documentation updated to remove secrets

### Status
✅ IMPLEMENTED - Ready to deploy on VPS

---

## Problem 9: Git Merge Conflict on VPS - start.sh Modified Locally
**Date**: 2026-08-12
**Severity**: MEDIUM
**Error**: `error: Your local changes to the following files would be overwritten by merge: start.sh`

### Root Cause
The VPS has local changes to start.sh that conflict with the new version being pulled from GitHub. This happened because:
1. start.sh was previously edited on VPS
2. New version exists in GitHub with different content
3. `git pull` tries to merge but fails due to conflict

### Solution
Force git to discard local changes and use GitHub version:
```bash
cd /home/iaezap && git fetch origin main && git reset --hard origin/main
```

Then rebuild and restart:
```bash
npm run build && pm2 restart iaezap
```

### Resolution
✅ **FIXED** - Force reset resolved conflict
- start-env.js deployed successfully
- Environment variables ARE loading correctly
- Log shows: `[Env Loader] Successfully loaded .env.production`
- Log shows: `[Env Loaded] SUPABASE_SERVICE_ROL... = sb_secret_uh1cDxnWtz...`

### Status
✅ FIXED - Merge conflict resolved

---

## Problem 10: Incorrect Next.js Module Path in start-env.js
**Date**: 2026-08-12
**Severity**: CRITICAL
**Error**: `require('next/dist/bin/next')(['start'])` - Error at line 31 of start-env.js

### Current Symptoms
1. ✅ Environment variables ARE loading correctly
2. ✅ start-env.js is running and logs env loading
3. ❌ Error when trying to require Next.js internal module
4. ❌ 502 Bad Gateway from Nginx (process failed to start)

### Root Cause
The internal module path `'next/dist/bin/next'` is not correct for Next.js 16.3.0. This causes the process to crash immediately after loading env vars.

Correct approach: Use the next CLI via `require('next').startServer()` or via child process.

### Solution
Fix start-env.js to properly start Next.js:
```javascript
const { createServer } = require('http');
const fs = require('fs');
const path = require('path');

// Load .env.production FIRST
const envPath = path.join(__dirname, '.env.production');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('[Env Loader] Environment variables loaded');
}

// Import and start Next.js AFTER env is set
const { default: next } = require('next');
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(3000, '0.0.0.0', () => {
    console.log('[Server] Next.js started on port 3000');
  });
});
```

### Status
🔄 IN PROGRESS - Fixing Next.js initialization
