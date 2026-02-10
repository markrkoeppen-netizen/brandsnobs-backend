# Brandsnobs Backend - Automated Deal Fetching

🚀 Phase 3 backend server that automatically fetches deals from RapidAPI and stores them in Firebase Firestore.

---

## What This Does

- ✅ Fetches deals from RapidAPI every 6 hours
- ✅ Searches 15+ priority brands (Nike, Apple, Yeti, etc.)
- ✅ Normalizes and filters quality deals (10%+ discount)
- ✅ Stores deals in Firestore
- ✅ Cleans old deals automatically
- ✅ Runs 24/7 on Railway

---

## Quick Start

### 1. Prerequisites

- ✅ RapidAPI account with Real-Time Product Search subscription
- ✅ Firebase project (brandsnobs-37142)
- ✅ Railway account

### 2. Get Firebase Service Account

Follow instructions in `RAILWAY-DEPLOYMENT.md` Part 1

### 3. Deploy to Railway

Follow instructions in `RAILWAY-DEPLOYMENT.md` Part 2-3

### 4. Trigger First Fetch

Open `manual-trigger.html` in your browser and click "Fetch Deals Now"

---

## Files

- `server.js` - Main Express server with scheduling
- `dealFetcher.js` - RapidAPI integration and deal normalization
- `firebase.js` - Firebase Admin SDK setup
- `package.json` - Dependencies
- `.env.example` - Environment variables template
- `RAILWAY-DEPLOYMENT.md` - Full deployment guide
- `manual-trigger.html` - Manual trigger interface

---

## Environment Variables

Required in Railway:

```
RAPIDAPI_KEY=your_key_here
RAPIDAPI_HOST=real-time-product-search.p.rapidapi.com
FIREBASE_PROJECT_ID=brandsnobs-37142
FIREBASE_PRIVATE_KEY=your_private_key_here
FIREBASE_CLIENT_EMAIL=your_client_email_here
PORT=3000
NODE_ENV=production
UPDATE_INTERVAL=6
```

---

## API Endpoints

### GET /health
Health check endpoint
```bash
curl https://your-railway-url/health
```

### POST /fetch-deals
Manually trigger deal fetch
```bash
curl -X POST https://your-railway-url/fetch-deals
```

### GET /stats
Get deal statistics
```bash
curl https://your-railway-url/stats
```

---

## How It Works

### 1. Scheduled Jobs (Every 6 hours)

```
00:00 UTC → Fetch deals
06:00 UTC → Fetch deals
12:00 UTC → Fetch deals
18:00 UTC → Fetch deals
```

### 2. For Each Brand:

1. Search RapidAPI for "{brand} sale"
2. Get 20 results
3. Filter valid deals (has price, link, in stock)
4. Normalize data (standardize format)
5. Keep only 10%+ discounts
6. Sort by discount (best first)
7. Keep top 15 deals
8. Store in Firestore

### 3. Data Flow:

```
RapidAPI → dealFetcher.js → Firestore
                ↓
        Priority Brands (15)
                ↓
        ~150-200 deals total
                ↓
        Frontend reads from Firestore
```

---

## Monitoring

### Railway Logs:

```
✅ Fetched 18 deals for Nike
💾 Stored 15 deals for Nike
✅ Fetched 16 deals for Apple
💾 Stored 14 deals for Apple
...
✅ Deal fetch completed: {
  totalDeals: 187,
  successfulBrands: 15,
  failedBrands: 0,
  duration: "142.5s"
}
```

### Firestore Collections:

**`deals` collection:**
- Individual deal documents
- ~150-200 documents
- Updated every 6 hours

**`brands` collection:**
- Brand metadata
- Deal counts
- Last updated timestamps

---

## Priority Brands

Currently fetching deals for:

1. Nike
2. Adidas
3. Lululemon
4. Apple
5. Yeti
6. The North Face
7. Coach
8. On Running
9. Columbia
10. Alo
11. Samsung
12. Sony
13. Vuori
14. Tumi
15. UGG

To add more brands, edit `PRIORITY_BRANDS` array in `dealFetcher.js`

---

## Cost

- **RapidAPI:** $30/month (5,000 requests)
- **Railway:** ~$5/month (covered by free credits)
- **Firebase:** Free (under quota)

**Total:** ~$30/month

---

## Next Steps

After backend is deployed:

1. ✅ Update frontend to read from Firestore
2. ✅ Remove hardcoded deals
3. ✅ Test real-time updates
4. ✅ Launch Phase 3!

---

## Troubleshooting

See `RAILWAY-DEPLOYMENT.md` for detailed troubleshooting steps.

Common issues:
- Firebase credentials → Check FIREBASE_PRIVATE_KEY format
- No deals fetched → Check RapidAPI key and quota
- Build failed → Check all files uploaded

---

## Support

Check:
1. Railway logs (Deployments → Logs)
2. Firebase Console (Firestore Database)
3. RapidAPI Dashboard (Usage)

---

**Built for Brandsnobs Phase 3 - Fully Automated Deal Aggregation** 🚀
