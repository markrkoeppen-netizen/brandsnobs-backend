require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { fetchAndStoreDeals, runScheduledFetch } = require('./dealFetcher');
const { initializeFirebase } = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase
initializeFirebase();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'brandsnobs-backend'
  });
});

// Manual trigger endpoint (for testing) — intentionally UNGUARDED.
// This is the "I know what I'm doing, run it now" button used by
// manual-trigger.html. It always forces a real fetch regardless of
// when the last one ran.
app.post('/fetch-deals', async (req, res) => {
  try {
    console.log('Manual deal fetch triggered (unguarded — forces a real run)');
    const result = await fetchAndStoreDeals();
    res.json({ 
      success: true, 
      message: 'Deals fetched successfully',
      ...result
    });
  } catch (error) {
    console.error('Manual fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get deal statistics
app.get('/stats', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    
    const dealsSnapshot = await db.collection('deals').get();
    const brandsSnapshot = await db.collection('brands').get();
    
    res.json({
      totalDeals: dealsSnapshot.size,
      totalBrands: brandsSnapshot.size,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule automatic updates — checks once daily at 6 AM UTC, but
// runScheduledFetch() internally decides whether enough time has actually
// passed (~2.5+ days per the guard in DealFetcher.js) before spending any
// API calls. This is what enforces "every ~3 days" rather than daily.
cron.schedule('0 6 * * *', async () => {
  console.log('🔄 Daily cron check at 6 AM UTC...');
  console.log('Cron check started:', new Date().toISOString());
  try {
    const result = await runScheduledFetch();
    if (result.skipped) {
      console.log('⏭️  Skipped — last fetch was too recent');
    } else {
      console.log('✅ Daily deal fetch completed:', result);
    }
  } catch (error) {
    console.error('❌ Scheduled fetch error:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Brandsnobs backend running on port ${PORT}`);
  console.log(`⏰ Cron check scheduled: daily at 6 AM UTC (actual fetch only every ~3 days)`);
  console.log(`🔥 Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
  
  // Run a GUARDED check on startup — NOT an unconditional fetch.
  // This is the fix for the bug where every Railway restart/redeploy
  // silently triggered a full unbudgeted fetch. Now a restart will only
  // trigger a real fetch if one is actually due (~3 days since the last one).
  console.log('Checking on startup whether a fetch is due...');
  runScheduledFetch()
    .then((result) => {
      if (result.skipped) {
        console.log('⏭️  Startup check complete — skipped (ran too recently)');
      } else {
        console.log('✅ Startup fetch completed:', result);
      }
    })
    .catch(err => console.error('❌ Startup fetch failed:', err));
});

// Log SIGTERM clearly instead of letting the process die silently.
// Railway sends this whenever it stops a container — a new deploy taking
// over, a manual restart, or infra maintenance. If a fetch was mid-run
// when this happens, it will automatically resume from where it left off
// the next time the app starts (see getResumeState in DealFetcher.js) —
// so an interruption here is expected and safe, not a failure.
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received — Railway is stopping this container.');
  console.log('    (Likely a new deploy taking over, a manual restart, or Railway maintenance.)');
  console.log('    If a fetch was in progress, it will resume from where it left off on next startup.');
  process.exit(0);
});
