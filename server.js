require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { fetchAndStoreDeals } = require('./dealFetcher');
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

// Manual trigger endpoint (for testing)
app.post('/fetch-deals', async (req, res) => {
  try {
    console.log('Manual deal fetch triggered');
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

// Schedule automatic updates every 6 hours
// Runs at: 00:00, 06:00, 12:00, 18:00 UTC
cron.schedule('0 */6 * * *', async () => {
  console.log('Scheduled deal fetch started:', new Date().toISOString());
  try {
    await fetchAndStoreDeals();
    console.log('Scheduled deal fetch completed');
  } catch (error) {
    console.error('Scheduled fetch error:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Brandsnobs backend running on port ${PORT}`);
  console.log(`📅 Automatic updates scheduled every ${process.env.UPDATE_INTERVAL || 6} hours`);
  console.log(`🔥 Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
  
  // Run initial fetch on startup
  console.log('Running initial deal fetch...');
  fetchAndStoreDeals()
    .then(() => console.log('✅ Initial fetch completed'))
    .catch(err => console.error('❌ Initial fetch failed:', err));
});
