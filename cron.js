// cron.js - Scheduled deal fetcher
// Refetch after fixing rules
const cron = require('node-cron');
const { fetchAndStoreDeals } = require('./dealFetcher');

console.log('🕐 Cron scheduler started');
console.log('📅 Schedule: Every 12 hours (12am and 12pm UTC)');

// Run every 12 hours at midnight and noon UTC
cron.schedule('0 0,12 * * *', async () => {
  console.log('\n' + '='.repeat(60));
  console.log(`🔔 Cron job triggered at ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');
  
  try {
    const result = await fetchAndStoreDeals();
    console.log('\n✅ Cron job completed successfully:', result);
  } catch (error) {
    console.error('\n❌ Cron job failed:', error);
  }
}, {
  timezone: "UTC"
});

// Run once on startup
console.log('🚀 Running initial fetch...\n');
fetchAndStoreDeals()
  .then(result => console.log('\n✅ Initial fetch complete:', result))
  .catch(error => console.error('\n❌ Initial fetch failed:', error));
