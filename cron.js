// cron.js - Scheduled deal fetcher
const cron = require('node-cron');
const { fetchAndStoreDeals } = require('./dealFetcher');

console.log('🕐 Cron scheduler started');
console.log('📅 Schedule: Every 12 hours (12am and 12pm UTC)');

// Run every 12 hours at midnight and noon UTC
// Cron format: minute hour day month weekday
// '0 0,12 * * *' = At minute 0 past hour 0 and 12 (midnight and noon)
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

// Optional: Run once on startup (for testing/immediate results)
console.log('🚀 Running initial fetch...\n');
fetchAndStoreDeals()
  .then(result => console.log('\n✅ Initial fetch complete:', result))
  .catch(error => console.error('\n❌ Initial fetch failed:', error));
// cron.js - Scheduled deal fetcher
// Trigger fetch - upgraded to Blaze
const cron = require('node-cron');
const { fetchAndStoreDeals } = require('./dealFetcher');
