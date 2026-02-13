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
      q: `${brandName}`,
      country: 'us',
      language: 'en',
      page: '1',
      limit: '20',
      sort_by: 'BEST_MATCH',
      product_condition: 'ANY',
      return_filters: 'true'
    },
    headers: {
      'x-rapidapi-host': process.env.RAPIDAPI_HOST,
      'x-rapidapi-key': process.env.RAPIDAPI_KEY
    }
  };

  try {
    console.log(`🔍 Searching for ${brandName}...`);
    const response = await axios.request(options);
    
    // The API returns: response.data.data.products
    const deals = response.data?.data?.products || [];
    console.log(`✅ Found ${deals.length} products in response.data.data.products`);
    
    return deals;
  } catch (error) {
    console.error(`❌ Error fetching deals for ${brandName}:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data).substring(0, 500));
    }
    return [];
  }
}

function createUniqueId(brandName, productTitle, price) {
  const cleanBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanProduct = productTitle.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
  const cleanPrice = Math.round(price * 100);
  return `${cleanBrand}-${cleanProduct}-${cleanPrice}`;
}

function normalizeDeals(rawDeals, brandName) {
  if (!Array.isArray(rawDeals)) {
    console.error(`⚠️  rawDeals is not an array for ${brandName}`);
    return [];
  }

  return rawDeals
    .filter(deal => {
      if (!deal.product_title || !deal.offer?.price) return false;
      if (!deal.product_link) return false;
      
      const price = parseFloat(deal.offer.price);
      if (price < 1 || price > 10000) return false;
      
      return true;
    })
    .map(deal => {
      const currentPrice = parseFloat(deal.offer.price);
      const originalPrice = deal.offer.original_price 
        ? parseFloat(deal.offer.original_price) 
        : currentPrice * 1.3;
      
      const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
      const uniqueId = createUniqueId(brandName, deal.product_title, currentPrice);
      
      return {
        id: uniqueId,
        brand: brandName,
        product: deal.product_title,
        originalPrice: Math.round(originalPrice * 100) / 100,
        salePrice: Math.round(currentPrice * 100) / 100,
        discount: discount > 0 ? `${discount}%` : '0%',
        image: deal.product_photo || deal.product_photos?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
        retailer: deal.offer.store_name || 'Online Store',
        link: deal.product_link,
        rating: deal.product_rating || null,
        reviewCount: deal.product_num_reviews || null,
        inStock: deal.offer.on_sale !== false,
        lastUpdated: new Date().toISOString(),
        fetchedAt: new Date().toISOString()
      };
    })
    .filter(deal => parseInt(deal.discount) >= 10)
    .sort((a, b) => parseInt(b.discount) - parseInt(a.discount))
    .slice(0, 15);
}

async function storeDealsInFirestore(deals, brandName) {
  const db = getFirestore();
  const batch = db.batch();
  
  let storedCount = 0;
  
  for (const deal of deals) {
    const dealRef = db.collection('deals').doc(deal.id);
    
    batch.set(dealRef, {
      ...deal,
      createdAt: new Date().toISOString()
    });
    
    storedCount++;
  }
  
  await batch.commit();
  console.log(`💾 Stored ${storedCount} deals for ${brandName}`);
  
  const brandRef = db.collection('brands').doc(brandName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  await brandRef.set({
    name: brandName,
    dealCount: storedCount,
    lastUpdated: new Date().toISOString()
  }, { merge: true });
  
  return storedCount;
}

async function cleanOldDeals() {
  const db = getFirestore();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const oldDealsSnapshot = await db.collection('deals')
    .where('fetchedAt', '<', oneDayAgo)
    .get();
  
  if (oldDealsSnapshot.empty) {
    console.log('No old deals to clean');
    return 0;
  }
  
  const batch = db.batch();
  oldDealsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`🗑️  Cleaned ${oldDealsSnapshot.size} old deals`);
  
  return oldDealsSnapshot.size;
}

async function fetchAndStoreDeals() {
  console.log('🔄 Starting deal fetch process...');
  const startTime = Date.now();
  
  let totalDeals = 0;
  let successfulBrands = 0;
  let failedBrands = 0;
  
  await cleanOldDeals();
  
  for (const brandName of PRIORITY_BRANDS) {
    try {
      const rawDeals = await searchDealsForBrand(brandName);
      const normalizedDeals = normalizeDeals(rawDeals, brandName);
      
      if (normalizedDeals.length > 0) {
        await storeDealsInFirestore(normalizedDeals, brandName);
        totalDeals += normalizedDeals.length;
        successfulBrands++;
      } else {
        console.log(`⚠️  No valid deals found for ${brandName}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to process ${brandName}:`, error.message);
      failedBrands++;
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  const summary = {
    totalDeals,
    successfulBrands,
    failedBrands,
    duration: `${duration}s`,
    timestamp: new Date().toISOString()
  };
  
  console.log('✅ Deal fetch completed:', summary);
  
  return summary;
}

module.exports = {
  fetchAndStoreDeals,
  searchDealsForBrand,
  normalizeDeals
};
