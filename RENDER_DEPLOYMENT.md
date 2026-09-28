# Hasut Deployment Guide for Render Free Plan

## Overview

This guide provides step-by-step instructions to deploy Hasut on Render's free plan without errors, with a healthy frontend and backend.

## Key Issues Fixed

### 1. **Lockfile Mismatch Error**
**Error:**
```
specifiers in the lockfile don't match specifiers in package.json:
- expo-network (lockfile: ^57.0.2, manifest: ~57.0.2)
```

**Root Cause:** Version mismatch between `package.json` and `pnpm-lock.yaml`

**Solutions:**
- Use `--frozen-lockfile` flag during build to prevent version changes
- Configure `.npmrc` with `prefer-frozen-lockfile=true`
- Regenerate lockfile locally if needed: `pnpm install --force`

### 2. **Turbo Not Found Error**
**Error:**
```
sh: 1: turbo: not found
ELIFECYCLE Command failed.
```

**Root Cause:** Turbo is only in devDependencies and not globally accessible during CI/CD

**Solution:**
- Use `pnpm exec turbo` instead of just `turbo`
- Or use `pnpm run build` which properly executes workspace builds

### 3. **Memory and Build Time Issues on Free Plan**

**Root Cause:** Free plan has limited resources (512MB RAM, 4GB build storage)

**Solutions:**
- Skip unnecessary files with `.renderignore`
- Optimize build commands
- Split deployment into smaller services
- Use environment variables efficiently

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│       Render Free Plan Services         │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   API        │  │   Web        │   │
│  │  (Port 3001) │  │  (Port 3000) │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   Admin      │  │   PostgreSQL │   │
│  │  (Port 3002) │  │   (Free)     │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

## Pre-Deployment Checklist

### Local Setup
- [ ] Node.js >= 22.14.0 installed
- [ ] pnpm >= 10.15.0 installed
- [ ] Run `pnpm install --frozen-lockfile` locally
- [ ] Run `pnpm build` successfully
- [ ] All tests pass: `pnpm test`
- [ ] No lockfile conflicts: `pnpm install --force` if needed

### GitHub Repository
- [ ] Push all changes to main branch
- [ ] Ensure `.npmrc` is committed
- [ ] Ensure `.renderignore` is committed
- [ ] Ensure `render.yaml` is committed

### Environment Variables
Set these in Render dashboard for each service:

**For API Service:**
```
NODE_ENV=production
DATABASE_URL=<postgres connection string>
JWT_SECRET=<your-secret-key>
REDIS_URL=<redis-url-if-using>
```

**For Web Service:**
```
NODE_ENV=production
REACT_APP_API_URL=https://your-api-service.onrender.com
```

**For Admin Service:**
```
NODE_ENV=production
REACT_APP_API_URL=https://your-api-service.onrender.com
```

## Step-by-Step Deployment

### Option 1: Using render.yaml (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Connect in Render Dashboard:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Blueprint"
   - Select your GitHub repository
   - Name your blueprint
   - Click "Create Blueprint"

3. **Configure Environment Variables:**
   - API Service → Environment
   - Add all required variables
   - Repeat for Web and Admin services

4. **Deploy:**
   - Click "Deploy" on the blueprint
   - Monitor logs in real-time

### Option 2: Manual Deployment

**Deploy API Service:**
1. Click "New +" → "Web Service"
2. Select GitHub repository
3. Set Name: `hasut-api`
4. Set Build Command:
   ```bash
   pnpm install --frozen-lockfile && pnpm build
   ```
5. Set Start Command:
   ```bash
   pnpm --filter @hasut/api start:prod
   ```
6. Add Environment Variables
7. Deploy

**Deploy Web Service:**
1. Repeat above with Name: `hasut-web`
2. Start Command: `cd apps/web && pnpm start`

**Deploy Admin Service:**
1. Repeat above with Name: `hasut-admin`
2. Start Command: `cd apps/admin && pnpm start`

**Create Database:**
1. Click "New +" → "PostgreSQL"
2. Select Free plan
3. Copy connection string to API environment variables

## Troubleshooting

### Build Fails with "Turbo not found"
**Fix:**
Update render.yaml build command:
```yaml
buildCommand: pnpm install --frozen-lockfile && pnpm --filter @hasut/api build
```

### Build Fails with "expo-network version mismatch"
**Fix:**
1. Local fix:
   ```bash
   pnpm install --force
   pnpm update expo-network
   ```
2. Commit updated lockfile
3. Push to GitHub
4. Redeploy on Render

### Service Won't Start (502 Bad Gateway)
**Debug:**
1. Check Render service logs:
   ```
   Logs tab in service dashboard
   ```
2. Verify environment variables are set
3. Check health endpoint responds:
   ```bash
   curl https://your-service.onrender.com/health
   ```
4. If database: verify DATABASE_URL is correct

### Out of Memory during Build
**Solutions:**
1. Remove unnecessary dependencies
2. Use `.renderignore` to exclude files
3. Split into smaller services
4. Consider upgrading to paid plan

### Database Connection Errors
**Fix:**
1. Verify PostgreSQL service is running
2. Copy exact connection string from Render
3. Run migrations:
   ```bash
   pnpm db:migrate:deploy
   ```
4. Check inbound rules allow connections

## Health Checks

### API Service Health
```bash
curl https://hasut-api.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Web Service Health
```bash
curl https://hasut-web.onrender.com
```

Should return HTML homepage.

### Admin Service Health
```bash
curl https://hasut-admin.onrender.com
```

Should return HTML admin dashboard.

## Performance Optimization

### Free Plan Limitations
- 512 MB RAM per service
- 30 GB bandwidth/month
- Services auto-sleep after 15 min inactivity
- Build takes longer with limited resources

### Recommendations
1. **Enable Auto-Sleep:** Keep enabled to save resources
2. **Optimize Dependencies:** Remove unused packages
3. **Minimize Build Size:** Use `.renderignore`
4. **Cache Strategy:** Render caches `node_modules` between builds
5. **Monitor Usage:** Check Render dashboard regularly

## Production Readiness Checklist

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Health endpoints responding
- [ ] Error logs reviewed and addressed
- [ ] CORS configured properly
- [ ] API rate limiting configured
- [ ] Security headers set
- [ ] Database backups enabled (if upgrading)
- [ ] Monitoring/alerting configured
- [ ] Rollback plan documented

## Rollback Procedure

If deployment fails:

1. **View Previous Deployments:**
   - Service Settings → Deployments
   - Redeploy previous working version

2. **Or via Git:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

3. **Redeploy on Render:**
   - Service will auto-detect new commit
   - Redeploy with previous working version

## Support & Resources

- [Render Documentation](https://render.com/docs)
- [pnpm Documentation](https://pnpm.io/)
- [NestJS Deployment](https://docs.nestjs.com/deployment)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

## Quick Commands

```bash
# Local testing before deployment
pnpm install --frozen-lockfile
pnpm build
pnpm test

# Build specific app
pnpm --filter @hasut/api build
pnpm --filter @hasut/web build
pnpm --filter @hasut/admin build

# Check for issues
pnpm lint
pnpm typecheck
```

## Next Steps

1. Follow the pre-deployment checklist
2. Push changes to GitHub
3. Deploy using render.yaml or manual steps
4. Monitor logs during build and startup
5. Verify all health endpoints
6. Test critical user flows
7. Monitor performance and logs
