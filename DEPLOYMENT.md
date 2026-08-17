# 🚀 Deployment Guide - IAeZap6

## Quick Deploy (Recommended)

### On VPS (179.198.102.88):

```bash
cd /root/iaezap6
chmod +x deploy.sh
./deploy.sh
```

That's it! The script will:
1. ✅ Pull latest code from GitHub
2. ✅ Install dependencies
3. ✅ Build Next.js app
4. ✅ Restart PM2 processes
5. ✅ Verify app is running

---

## Manual Deploy Steps

If you prefer manual control:

```bash
# SSH to VPS
ssh root@179.198.102.88

# Navigate to app directory
cd /root/iaezap6

# Pull latest code
git fetch origin
git reset --hard origin/main

# Install dependencies (use ci for production)
npm ci

# Build
npm run build

# Restart PM2
pm2 restart all --update-env
pm2 save

# Verify
pm2 status
pm2 logs
```

---

## Check Deployment Status

```bash
# SSH to VPS
ssh root@179.198.102.88

# Check if processes are running
pm2 status

# View logs
pm2 logs

# View specific process logs
pm2 logs iaezap6

# Real-time monitoring
pm2 monit
```

---

## If Deployment Fails

### Check logs:
```bash
pm2 logs -n 100  # Last 100 lines
```

### Check Node.js:
```bash
node --version
npm --version
```

### Restart manually:
```bash
pm2 restart all
pm2 save
```

### Force restart:
```bash
pm2 kill
pm2 start ecosystem.config.js
```

---

## Test New Endpoint After Deployment

```bash
# Test integrated company creation endpoint
curl -X POST https://jotaonline.com.br/api/admin/companies/with-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {YOUR_ADMIN_TOKEN}" \
  -d '{
    "name": "Test Company",
    "slug": "test-company",
    "cnpj": "12.345.678/0001-90",
    "plan": "professional",
    "users": [
      {
        "email": "admin@test.com",
        "fullName": "Test Admin",
        "role": "admin"
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "company": {...},
    "users": [...],
    "credentials": [
      {
        "email": "admin@test.com",
        "password": "GENERATED_PASSWORD"
      }
    ]
  }
}
```

---

## Automated HTTP Deploy (Alternative)

If SSH is not available, use the HTTP deployment endpoint:

```bash
# On any machine with curl
curl -X POST https://jotaonline.com.br/api/dev/deploy \
  -H "Content-Type: application/json" \
  -H "X-Deploy-Token: {DEPLOY_TOKEN}" \
  -d '{}'
```

Where `DEPLOY_TOKEN` is set in `.env.local` on the VPS as `DEPLOY_TOKEN`.

---

## Deployment Checklist

- [ ] Code pushed to main branch
- [ ] Latest commit visible in GitHub
- [ ] SSH access to VPS working
- [ ] PM2 processes configured
- [ ] `.env.local` has all required variables
- [ ] Run `./deploy.sh` on VPS
- [ ] Verify with `pm2 status`
- [ ] Test endpoint with curl
- [ ] Check logs for errors

---

## Environment Variables Required

Make sure these are in `/root/iaezap6/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# JWT
PRIVATE_KEY=...
PUBLIC_KEY=...

# Admin
ADMIN_MIGRATE_TOKEN=admin-migrate-phase2

# Deploy (optional, for HTTP deployment)
DEPLOY_TOKEN=your-secret-token-here
```

---

## Recent Changes Deployed

✅ **New Endpoint:** `POST /api/admin/companies/with-users`
- Creates company + users in one request
- Auto-generates secure passwords
- Returns credentials for each user

✅ **Documentation:** `PHASE2_INTEGRATED_SETUP.md`
- Complete guide for new endpoint
- Examples and error handling

✅ **Deploy Script:** `deploy.sh`
- Automated deployment workflow
- Includes verification step

---

## Git Commits to Deploy

Latest commits on main:
```
4766da5 feat: add auto-deploy endpoint for VPS
f6c5433 docs: add comprehensive guide for integrated company+users endpoint
d522563 feat: integrated company + users creation endpoint with auto-generated passwords
```

---

**Status:** ✅ Ready to deploy
**Last Updated:** 2026-08-17
