const axios = require('axios');
const { getFirestore } = require('./firebase');

const PRIORITY_BRANDS = [
  'Nike', 'Adidas', 'Lululemon', 'Apple', 'Yeti', 
  'The North Face', 'Coach', 'On Running', 'Columbia',
  'Alo', 'Tommy Bahama', 'Sony', 'Vuori', 'Tumi', 'UGG'
];

async function searchDealsForBrand(brandName) {
  const options = {
    method: 'GET',
    url: `https://${process.env.RAPIDAPI_HOST}/search-v2`,
    params: {
      q: brandName,
      country: 'us',
      language: 'en',
      page: '1',
      limit: '20',
      sort_by: 'BEST_MATCH',
      product_condition: 'ANY'
    },
    headers: {
      'x-rapidapi-host': process.env.RAPIDAPI_HOST,
      'x-rapidapi-key': process.env.RAPIDAPI_KEY
    }
  };

  try {
    console.log(`🔍 Fetching ${brandName}...`);
    const response = await axios.request(options);
    const products = response.data?.data?.products || [];
    console.log(`   Found ${products.length} products`);
    return products;
  } catch (error) {
    console.error(`   ERROR: ${error.message}`);
    return [];
  }
}

function parsePrice(priceString) {
  if (!priceString) return null;
  // Remove $, commas, and convert to number
  const cleaned = String(priceString).replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeDeals(products, brandName) {
  console.log(`📝 Normalizing ${products.length} products for ${brandName}...`);
  
  const deals = [];
  
  for (const product of products) {
    // Skip if missing required fields
    if (!product.product_title) continue;
    if (!product.offer) continue;
    
    const currentPrice = parsePrice(product.offer.price);
    if (!currentPrice || currentPrice < 1) continue;
    
    const link = product.offer.offer_page_url || product.product_page_url;
    if (!link) continue;
    
    // Calculate discount
    const originalPrice = parsePrice(product.offer.original_price) || currentPrice * 1.25;
    const savings = originalPrice - currentPrice;
    const discountPercent = Math.round((savings / originalPrice) * 100);
    
    // Only keep deals with at least 10% off
    if (discountPercent < 10) continue;
    
    // Create unique ID
    const cleanBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = product.product_title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
    const uniqueId = `${cleanBrand}-${cleanTitle}-${Math.round(currentPrice * 100)}`;
    
    deals.push({
      id: uniqueId,
      brand: brandName,
      product: product.product_title,
      salePrice: Math.round(currentPrice * 100) / 100,
      originalPrice: Math.round(originalPrice * 100) / 100,
      discount: `${discountPercent}%`,
      link: link,
      image: product.product_photos?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
      retailer: product.offer.store_name || 'Online',
      rating: product.product_rating || null,
      reviewCount: product.product_num_reviews || null,
      lastUpdated: new Date().toISOString(),
      fetchedAt: new Date().toISOString()
    });
  }
  
  // Sort by discount and take top 15
  deals.sort((a, b) => parseInt(b.discount) - parseInt(a.discount));
  const topDeals = deals.slice(0, 15);
  
  console.log(`   ✅ ${topDeals.length} valid deals (${discountPercent >= 10 ? 'with 10%+ discount' : ''})`);
  
  return topDeals;
}

async function storeDealsInFirestore(deals, brandName) {
  if (deals.length === 0) return;
  
  const db = getFirestore();
  const batch = db.batch();
  
  for (const deal of deals) {
    const dealRef = db.collection('deals').doc(deal.id);
    batch.set(dealRef, deal);
  }
  
  await batch.commit();
  console.log(`💾 Stored ${deals.length} deals for ${brandName}`);
  
  // Update brand metadata
  const brandRef = db.collection('brands').doc(brandName.toLowerCase().replace(/\s+/g, '-'));
  await brandRef.set({
    name: brandName,
    dealCount: deals.length,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
}

async function cleanOldDeals() {
  const db = getFirestore();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const oldDeals = await db.collection('deals')
      .where('fetchedAt', '<', oneDayAgo)
      .get();
    
    if (oldDeals.empty) {
      console.log('🗑️  No old deals to clean');
      return;
    }
    
    const batch = db.batch();
    oldDeals.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    console.log(`🗑️  Cleaned ${oldDeals.size} old deals`);
  } catch (error) {
    console.log('⚠️  Could not clean old deals:', error.message);
  }
}

async function fetchAndStoreDeals() {
  console.log('🚀 Starting deal fetch...\n');
  const startTime = Date.now();
  
  await cleanOldDeals();
  console.log('');
  
  let totalDeals = 0;
  let successfulBrands = 0;
  
  for (const brandName of PRIORITY_BRANDS) {
    try {
      const products = await searchDealsForBrand(brandName);
      const deals = normalizeDeals(products, brandName);
      
      if (deals.length > 0) {
        await storeDealsInFirestore(deals, brandName);
        totalDeals += deals.length;
        successfulBrands++;
      }
      
      // Rate limit - wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('');
      
    } catch (error) {
      console.error(`❌ Failed: ${brandName} - ${error.message}\n`);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('='.repeat(50));
  console.log(`✅ COMPLETE`);
  console.log(`   Deals: ${totalDeals}`);
  console.log(`   Brands: ${successfulBrands}/${PRIORITY_BRANDS.length}`);
  console.log(`   Time: ${duration}s`);
  console.log('='.repeat(50));
  
  return {
    totalDeals,
    successfulBrands,
    failedBrands: PRIORITY_BRANDS.length - successfulBrands,
    duration: `${duration}s`,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  fetchAndStoreDeals,
  searchDealsForBrand,
  normalizeDeals
};
