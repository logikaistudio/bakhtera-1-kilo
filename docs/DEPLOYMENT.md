# Deployment Guide - FreightOne

## Prerequisites
- GitHub account
- Vercel account (free tier is sufficient)
- Git installed locally
- Node.js 18+ installed

---

## Step 1: GitHub Setup

### Initialize Git Repository (if not already done)
```bash
cd /Users/hoeltz/Documents/GitHub/FreightOne
git init
git add .
git commit -m "Initial commit - FreightOne TPPB Management System"
```

### Create GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Repository name: `FreightOne`
3. Description: "TPPB Management System with Bridge, Pabean, and Centralized modules"
4. Visibility: Private (recommended) or Public
5. **Do NOT** initialize with README, .gitignore, or license
6. Click "Create repository"

### Push to GitHub
```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/FreightOne.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 2: Vercel Deployment

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Login to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/Login with GitHub account

2. **Import Project**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Choose `FreightOne` from your GitHub repositories
   - Click "Import"

3. **Configure Project**
   - **Framework Preset:** Vite (auto-detected)
   - **Root Directory:** `./`
   - **Build Command:** `npm run build` (auto-filled)
   - **Output Directory:** `dist` (auto-filled)
   - **Install Command:** `npm install` (auto-filled)

4. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Your app will be live at: `https://freight-one-XXXXX.vercel.app`

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## Step 3: Custom Domain (Optional)

1. In Vercel Dashboard, go to your project
2. Settings → Domains
3. Add your custom domain
4. Follow DNS configuration instructions
5. Wait for propagation (5-10 minutes)

---

## Step 4: Environment Variables (If Needed)

Currently, FreightOne doesn't require environment variables. If you add API keys or secrets in the future:

1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add variable name and value
3. Select environments (Production, Preview, Development)
4. Redeploy for changes to take effect

---

## Automatic Deployments

Vercel automatically deploys when you push to GitHub:
- **Push to `main` branch** → Production deployment
- **Push to other branches** → Preview deployment
- **Pull Requests** → Preview deployment with URL

```bash
# Make changes
git add .
git commit -m "Update feature X"
git push

# Vercel will automatically deploy
# Check deployment status at vercel.com/dashboard
```

---

## Build Verification

Before deploying, verify local build:

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Test build
npm run build

# Preview build
npm run preview
```

Expected output:
```
✓ 2775 modules transformed
✓ built in ~10-15s
dist/index.html         0.45 kB
dist/assets/index.css   26.49 kB
dist/assets/index.js    986+ kB
```

---

## Troubleshooting

### Build Fails on Vercel

**Issue:** `Module not found` or dependency errors

**Solution:**
```bash
# Ensure package-lock.json is committed
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

### App Shows Blank Page

**Issue:** Routing not working on Vercel

**Solution:** Vercel.json is already configured, but verify:
- Routes are using React Router properly
- Base URL is set correctly in vite.config.js

### Large Bundle Size Warning

**Expected:** The current build is ~987 KB which is normal for:
- React + Dependencies
- Recharts library
- Framer Motion
- Multiple modules

**To optimize (future):**
- Code splitting with React.lazy()
- Dynamic imports for routes
- Tree shaking optimization

---

## Post-Deployment Checklist

- ✅ GitHub repository created and pushed
- ✅ Vercel project deployed successfully
- ✅ All pages load without errors
- ✅ Navigation works correctly
- ✅ Data displays properly
- ✅ Charts render correctly
- ✅ Search functionality works
- ✅ Modals open/close properly
- ✅ Responsive design verified on mobile
- ✅ Custom domain configured (if applicable)

---

## Monitoring

### Vercel Analytics (Free)
- Enable in Vercel Dashboard → Analytics
- Track pageviews, unique visitors, performance

### Deployment Logs
- Vercel Dashboard → Deployments → [Click deployment] → View Logs
- Check for any runtime errors or warnings

---

## Maintenance

### Update Dependencies
```bash
# Check for updates
npm outdated

# Update all dependencies
npm update

# Update specific package
npm update package-name

# Test after updates
npm run build
git add .
git commit -m "Update dependencies"
git push
```

### Rollback Deployment
1. Vercel Dashboard → Deployments
2. Find previous successful deployment
3. Click "..." → Promote to Production

---

## Support

For deployment issues:
- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- Vite Documentation: [vitejs.dev](https://vitejs.dev)
- GitHub Help: [docs.github.com](https://docs.github.com)

---

**Your application is ready for production!** 🚀
