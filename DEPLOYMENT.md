# ZEfood — Deployment Guide

## Architecture

```
                    GitHub Repository
                          │
              ┌───────────┼───────────┐
              │           │           │
         CI Tests      Build        Push
              │           │           │
              ▼           ▼           ▼
         pytest       npm build   Docker Image
                                (ghcr.io)
                                    │
                               ┌────┴────┐
                               │         │
                           Railway    Vercel
                          (Backend)  (3 Frontends)
```

---

## 🚀 Option 1: Deploy to Railway + Vercel (Recommended)

### Step 1: Push to GitHub

```bash
cd zefood
git add .
git commit -m "chore: prepare for deployment"
git remote add origin https://github.com/nikhurana13/zeefood.git
git push -u origin main
```

---

### Step 2: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your `zefood` repository
3. Railway will auto-detect the `backend/` folder — set **Root Directory** to `backend`
4. Add environment variables in the Railway dashboard:

```
FIREBASE_USER_APP_CREDENTIALS=<JSON content or path>
FIREBASE_STAFF_CREDENTIALS=<JSON content or path>
FIREBASE_ADMIN_CREDENTIALS=<JSON content or path>
FIREBASE_USER_APP_PROJECT_ID=zeefood-c72cd
FIREBASE_STAFF_PROJECT_ID=staff-1ac19
FIREBASE_ADMIN_PROJECT_ID=admin-ca01a
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
GEMINI_API_KEY=<from Google AI Studio>
RAZORPAY_KEY_ID=<from Razorpay dashboard>
RAZORPAY_KEY_SECRET=<from Razorpay dashboard>
APP_ENV=production
DEBUG=false
CORS_ORIGINS=https://zefood-user.vercel.app,https://zefood-staff.vercel.app,https://zefood-admin.vercel.app
```

5. Copy your Railway backend URL (e.g., `https://zefood-backend.up.railway.app`)

> **Tip for Firebase credentials**: Instead of file paths, encode your JSON as a string and update `config.py` to parse inline JSON, OR use Railway's volume to mount the JSON files.

---

### Step 3: Deploy Frontends to Vercel

Deploy each frontend as a separate Vercel project:

#### User App
```bash
cd frontend/user-app
npx vercel --prod
# When prompted:
#   Framework: Vite
#   Root directory: ./
# Set environment variable: VITE_API_BASE = https://your-backend.up.railway.app
```

#### Staff Panel
```bash
cd frontend/staff-panel
npx vercel --prod
# Set: VITE_API_BASE = https://your-backend.up.railway.app
```

#### Admin Panel
```bash
cd frontend/admin-panel
npx vercel --prod
# Set: VITE_API_BASE = https://your-backend.up.railway.app
```

---

### Step 4: Configure GitHub Secrets for CI/CD

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** and add:

| Secret | Value |
|--------|-------|
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens → New Token |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Vercel → Settings → General → Team ID |
| `VERCEL_USER_APP_PROJECT_ID` | Vercel project settings for user-app |
| `VERCEL_STAFF_PANEL_PROJECT_ID` | Vercel project settings for staff-panel |
| `VERCEL_ADMIN_PANEL_PROJECT_ID` | Vercel project settings for admin-panel |
| `BACKEND_URL` | `https://your-backend.up.railway.app` |

After adding secrets, every push to `main` will automatically deploy.

---

## 🐳 Option 2: Self-Hosted VPS with Docker Compose

### Prerequisites
- Ubuntu 22.04 VPS (DigitalOcean, Hetzner, AWS EC2, etc.)
- Docker + Docker Compose installed
- Domain name (optional but recommended)

### Deployment

```bash
# On your VPS
git clone https://github.com/YOUR_USERNAME/zefood.git
cd zefood

# Configure backend secrets
cp backend/.env.example backend/.env
nano backend/.env   # Fill in all values

# Set your backend URL
export BACKEND_URL=http://YOUR_VPS_IP:8000
# Or if you have a domain:
# export BACKEND_URL=https://api.yourdomain.com

# Deploy (production mode)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check status
docker-compose ps
docker-compose logs backend
```

Services will be available at:
- Backend: `http://YOUR_VPS_IP:8000`
- User App: `http://YOUR_VPS_IP:3000`
- Staff Panel: `http://YOUR_VPS_IP:3001`
- Admin Panel: `http://YOUR_VPS_IP:3002`

---

## 🔑 Firebase Credentials on Production

Firebase requires service account JSON files. For production:

**Option A — Inline JSON (Railway-friendly)**

Update `backend/app/services/firebase.py` to read credentials from environment variable instead of file path:

```python
import json, os
creds_json = json.loads(os.environ["FIREBASE_USER_APP_CREDENTIALS"])
cred = firebase_admin.credentials.Certificate(creds_json)
```

Then set `FIREBASE_USER_APP_CREDENTIALS` to the entire JSON string.

**Option B — Volume mount (Docker/VPS)**

1. Copy your Firebase JSON files to the VPS
2. Mount them via docker-compose volumes:
```yaml
backend:
  volumes:
    - /etc/zefood/firebase:/app/credentials
```
3. Set `FIREBASE_USER_APP_CREDENTIALS=/app/credentials/user-firebase-adminsdk.json`

---

## 🔒 Generating a Strong JWT Secret

```bash
openssl rand -hex 32
# Example output: a3f8d2c1b4e9f7a2...
```

Set this as `JWT_SECRET_KEY` in your environment.

---

## 📊 Monitoring

- **Backend health**: `GET https://your-backend.up.railway.app/health`
- **API docs**: `GET https://your-backend.up.railway.app/docs`
- **Railway dashboard**: Real-time logs and metrics
- **Vercel dashboard**: Deployment history and analytics

---

## 🔄 Updating the Deployment

```bash
# Simply push to main — GitHub Actions handles the rest
git add .
git commit -m "feat: your changes"
git push origin main
```

CI will run tests, then CD will auto-deploy to Railway and Vercel.
