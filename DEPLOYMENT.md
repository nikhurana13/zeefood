# ZEfood — Deployment Guide (Render + Vercel)

## Architecture

```
                    GitHub Repository
                    (nikhurana13/zeefood)
                           │
           ┌───────────────┼───────────────┐
           │               │               │
       CI Tests        Auto-Deploy    Auto-Deploy
       (GitHub         (on push)      (on push)
        Actions)           │               │
                           ▼               ▼
                        Render          Vercel
                       (Backend)      (3 Frontends)
                      FastAPI API    user-app
                      Port: auto     staff-panel
                                     admin-panel
```

---

## 🚀 Step 1 — Deploy Backend on Render

### 1a. Connect GitHub to Render

1. Go to **[render.com](https://render.com)** → Sign up / Log in
2. Click **New +** → **Web Service**
3. Connect your GitHub account → Select **`nikhurana13/zeefood`**
4. Set the following:

| Setting | Value |
|---------|-------|
| **Name** | `zefood-backend` |
| **Root Directory** | `backend` |
| **Runtime** | `Docker` |
| **Branch** | `main` |
| **Plan** | Free (or Starter for always-on) |

5. Click **Create Web Service**

---

### 1b. Set Environment Variables in Render Dashboard

Go to your service → **Environment** tab → Add the following:

#### 🔑 Secrets (paste full JSON content for Firebase credentials)

| Key | Value |
|-----|-------|
| `FIREBASE_USER_APP_CREDENTIALS` | *Paste entire content of `zeefood-c72cd-firebase-adminsdk-*.json`* |
| `FIREBASE_STAFF_CREDENTIALS` | *Paste entire content of `staff-1ac19-firebase-adminsdk-*.json`* |
| `FIREBASE_ADMIN_CREDENTIALS` | *Paste entire content of `admin-ca01a-firebase-adminsdk-*.json`* |
| `JWT_SECRET_KEY` | `e81648c7ea4a1c533adfe4486b974f3328c07e7f97f3ce2a7387396263f274b7` |
| `GEMINI_API_KEY` | *(your Gemini API key)* |
| `RAZORPAY_KEY_ID` | `rzp_test_TKSJKw0ABEcjZI` |
| `RAZORPAY_KEY_SECRET` | *(your Razorpay secret)* |

#### App Settings

| Key | Value |
|-----|-------|
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `FIREBASE_USER_APP_PROJECT_ID` | `zeefood-c72cd` |
| `FIREBASE_STAFF_PROJECT_ID` | `staff-1ac19` |
| `FIREBASE_ADMIN_PROJECT_ID` | `admin-ca01a` |
| `USER_APP_STORAGE_BUCKET` | `zeefood-c72cd.appspot.com` |
| `CORS_ORIGINS` | `https://zefood-user.vercel.app,https://zefood-staff.vercel.app,https://zefood-admin.vercel.app` |
| `GEMINI_MODEL` | `gemini-1.5-flash` |
| `WHISPER_MODEL_SIZE` | `base` |

> **Tip for Firebase JSON**: Open your downloaded `.json` file, select all, copy, and paste the entire content as the value of `FIREBASE_USER_APP_CREDENTIALS` etc. The backend auto-detects whether the value is a JSON string or file path.

6. Click **Save Changes** → Render will rebuild and deploy.

Your backend URL will be: **`https://zefood-backend.onrender.com`**
(confirm the exact URL in Render dashboard)

---

## 🌐 Step 2 — Deploy Frontends on Vercel

Deploy each of the 3 React apps as a separate Vercel project.

### User App

```bash
cd "C:\Users\n3297\OneDrive\Desktop\hotel management\zefood\frontend\user-app"
npx vercel --prod
```

When Vercel asks for settings:
- **Framework**: Vite
- **Root directory**: `./` (current directory)
- **Build command**: `npm run build`
- **Output directory**: `dist`

Then add the environment variable in Vercel Dashboard:
- `VITE_API_BASE` = `https://zefood-backend.onrender.com`

### Staff Panel

```bash
cd "..\staff-panel"
npx vercel --prod
```
Add env var: `VITE_API_BASE` = `https://zefood-backend.onrender.com`

### Admin Panel

```bash
cd "..\admin-panel"
npx vercel --prod
```
Add env var: `VITE_API_BASE` = `https://zefood-backend.onrender.com`

---

## 🔄 Step 3 — Update CORS After Vercel Deploy

Once you have the actual Vercel URLs (e.g., `https://zefood-user-abc123.vercel.app`),
go back to Render → Environment → update `CORS_ORIGINS`:

```
https://zefood-user-abc123.vercel.app,https://zefood-staff-abc123.vercel.app,https://zefood-admin-abc123.vercel.app
```

---

## ⚙️ Step 4 — Set Up GitHub Actions for Auto-Deploy

### CI runs automatically on every push ✅

### For CD (auto-deploy on push to main), add these GitHub Secrets:
Go to: **github.com/nikhurana13/zeefood → Settings → Secrets and variables → Actions**

| Secret | How to get it |
|--------|--------------|
| `RENDER_DEPLOY_HOOK_URL` | Render dashboard → Service → Settings → Deploy Hook → Copy URL |
| `VERCEL_TOKEN` | vercel.com → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | vercel.com → Settings → General → Team ID |
| `VERCEL_USER_APP_PROJECT_ID` | Vercel project → Settings → Project ID |
| `VERCEL_STAFF_PANEL_PROJECT_ID` | Vercel project → Settings → Project ID |
| `VERCEL_ADMIN_PANEL_PROJECT_ID` | Vercel project → Settings → Project ID |
| `BACKEND_URL` | `https://zefood-backend.onrender.com` |

---

## 🐳 Option B — Self-Hosted VPS with Docker Compose

```bash
# On your Ubuntu VPS
git clone https://github.com/nikhurana13/zeefood.git
cd zeefood

# Fill in your secrets
cp backend/.env.example backend/.env
nano backend/.env

# Deploy production stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose logs -f backend
```

---

## 📊 Verify Deployment

```bash
# Check backend health
curl https://zefood-backend.onrender.com/health

# Expected response:
# {"status":"healthy","services":{"firebase":"connected","rag":"ready",...}}
```

---

## 🔒 Security Checklist

- [ ] `backend/.env` is NOT committed (already in `.gitignore` ✅)
- [ ] Firebase JSON files are NOT committed (already in `.gitignore` ✅)
- [ ] JWT secret is set to a strong random value
- [ ] `DEBUG=false` and `APP_ENV=production` in Render env vars
- [ ] CORS_ORIGINS lists only your actual Vercel URLs (no `localhost` in production)
- [ ] Revoke the GitHub PAT used for the initial push (github.com/settings/tokens)
