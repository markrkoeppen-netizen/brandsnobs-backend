# Brandsnobs Backend - Railway Deployment Guide

## 🚀 Phase 3 Backend Setup

This backend automatically fetches deals from RapidAPI and stores them in Firestore.

---

## Part 1: Get Firebase Service Account (15 minutes)

### Step 1: Go to Firebase Console

1. Go to: https://console.firebase.google.com/
2. Click on your **brandsnobs-37142** project

### Step 2: Generate Service Account Key

1. Click the **gear icon** (⚙️) next to "Project Overview"
2. Click **"Project settings"**
3. Click the **"Service accounts"** tab
4. Click **"Generate new private key"**
5. Click **"Generate key"** in the popup
6. A JSON file will download (keep this safe!)

### Step 3: Extract Values from JSON

Open the downloaded JSON file. You'll need these 3 values:

```json
{
  "project_id": "brandsnobs-37142",
  "private_key": "-----BEGIN PRIVATE KEY-----\nABC123...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@brandsnobs-37142.iam.gserviceaccount.com"
}
```

**Save these somewhere safe - you'll need them in a moment.**

---

## Part 2: Deploy to Railway (20 minutes)

### Step 1: Prepare Code for Upload

You have the backend code in the `backend` folder. You need to:

**Option A: Upload via GitHub (Recommended)**

1. Create a new GitHub repository called `brandsnobs-backend`
2. Upload all files from the `backend` folder:
   - package.json
   - server.js
   - firebase.js
   - dealFetcher.js
   - .env.example (rename to just `.env` locally, don't commit real .env)

3. Commit and push to GitHub

**Option B: Deploy from Local (Simpler)**

We'll use Railway's CLI to deploy directly.

### Step 2: Deploy to Railway

1. Go to https://railway.app/

2. Click **"New Project"**

3. Click **"Deploy from GitHub repo"**

4. Select your `brandsnobs-backend` repository

5. Railway will detect it's a Node.js app and start deploying

### Step 3: Add Environment Variables

This is CRITICAL - the backend needs these to work:

1. In Railway, click on your deployed project

2. Click **"Variables"** tab

3. Add these environment variables (one by one):

```
RAPIDAPI_KEY=bab4f9b16bmsh2e0f66613ba73f5p14d0f2jsn0bd27c025e9b

RAPIDAPI_HOST=real-time-product-search.p.rapidapi.com

FIREBASE_PROJECT_ID=brandsnobs-37142

FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@brandsnobs-37142.iam.gserviceaccount.com

FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
Your private key here (paste the entire multi-line key)
-----END PRIVATE KEY-----

PORT=3000

NODE_ENV=production

UPDATE_INTERVAL=6
```

**IMPORTANT for FIREBASE_PRIVATE_KEY:**
- Paste the ENTIRE key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Include all the `\n` characters as-is
- Railway will handle the multi-line format

4. Click **"Deploy"** or it will auto-redeploy

### Step 4: Verify Deployment

1. Wait 2-3 minutes for Railway to deploy

2. Railway will give you a URL like: `https://brandsnobs-backend-production.up.railway.app`

3. Visit: `https://YOUR-URL/health`

4. You should see:
```json
{
  "status": "healthy",
  "timestamp": "2025-02-10T...",
  "service": "brandsnobs-backend"
}
```

5. If you see that → ✅ Backend is running!

---

## Part 3: Trigger First Deal Fetch (5 minutes)

### Manual Trigger:

1. Use this URL: `https://YOUR-RAILWAY-URL/fetch-deals`

2. Send a POST request:
   - Option A: Use Postman or Insomnia
   - Option B: Use curl:
     ```bash
     curl -X POST https://YOUR-RAILWAY-URL/fetch-deals
     ```
   - Option C: I'll give you a simple HTML page to trigger it

3. Wait 2-5 minutes (fetching 15 brands takes time)

4. You should see:
```json
{
  "success": true,
  "totalDeals": 150,
  "successfulBrands": 15,
  "failedBrands": 0
}
```

5. ✅ Deals are now in Firestore!

---

## Part 4: Verify Deals in Firestore (5 minutes)

### Check Firestore Database:

1. Go to Firebase Console
2. Click **"Firestore Database"**
3. You should see two collections:
   - **`deals`** - Should have 100-200 documents (individual deals)
   - **`brands`** - Should have 15 documents (brand metadata)

4. Click on a deal document - should look like:
```json
{
  "brand": "Nike",
  "product": "Nike Air Max 270 Shoes",
  "originalPrice": 150,
  "salePrice": 89,
  "discount": "41%",
  "retailer": "Amazon",
  "link": "https://...",
  "lastUpdated": "2025-02-10T..."
}
```

5. ✅ If you see deals → Backend is working!

---

## Part 5: Automatic Updates

The backend is now running 24/7 and will:

- ✅ Fetch new deals every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- ✅ Clean old deals (removes deals older than 24 hours)
- ✅ Update Firestore automatically
- ✅ Keep deals fresh

**You don't need to do anything - it runs automatically!**

---

## Monitoring

### Check Backend Status:

Visit these URLs anytime:

1. **Health Check:** `https://YOUR-URL/health`
   - Should always return `{"status": "healthy"}`

2. **Statistics:** `https://YOUR-URL/stats`
   - Shows total deals and brands

### Railway Dashboard:

1. Go to Railway → Your project
2. Click **"Metrics"**
3. See CPU usage, memory, requests

### Firestore:

1. Check Firestore Database in Firebase Console
2. See deal counts increasing every 6 hours

---

## Troubleshooting

### Build Failed:

**Error: "Cannot find module"**
- Make sure all files are uploaded (package.json, server.js, etc.)

**Error: "Firebase credentials invalid"**
- Check FIREBASE_PRIVATE_KEY is complete
- Make sure it includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`

### Backend Running but No Deals:

1. Check Railway logs:
   - Railway → Project → "Logs" tab
   - Look for errors

2. Test RapidAPI directly:
   - Visit RapidAPI dashboard
   - Make sure you haven't hit rate limits

3. Check Firestore rules:
   - Make sure service account can write

### Deals Not Updating:

1. Check Railway logs for cron job messages
2. Manually trigger: `POST /fetch-deals`
3. Verify in Firestore that deals have new timestamps

---

## Cost Monitoring

### RapidAPI Usage:

1. Go to RapidAPI → Dashboard
2. Check API usage
3. You have 5,000 requests/month on Pro plan
4. Current usage: 15 brands × 4 updates/day = 60 requests/day = 1,800/month
5. ✅ Well within limits!

### Railway Usage:

1. Railway → Project → "Usage"
2. You get $5/month free credits
3. Backend uses ~$5/month
4. ✅ Essentially free!

---

## Next Steps

After backend is deployed and working:

1. ✅ Update frontend to read from Firestore (instead of hardcoded deals)
2. ✅ Test end-to-end flow
3. ✅ Launch Phase 3!

---

## Files in This Package

```
backend/
├── package.json          # Dependencies
├── server.js            # Main server & scheduling
├── firebase.js          # Firebase Admin SDK setup
├── dealFetcher.js       # RapidAPI integration & deal logic
└── .env.example         # Environment variables template
```

---

## Support

If you get stuck:

1. Check Railway logs (most errors show here)
2. Check Firebase Console (verify deals are being written)
3. Check RapidAPI dashboard (verify requests are going through)
4. Let me know the specific error message!

---

**Ready to deploy?** Follow Part 1 → Part 2 → Part 3 → Done! 🚀

Total time: ~45 minutes for complete backend setup.
