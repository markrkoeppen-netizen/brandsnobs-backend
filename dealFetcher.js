const axios = require('axios');
const { getFirestore } = require('./firebase');

// Priority brands to fetch first (based on your current app)
const PRIORITY_BRANDS = [
  'Nike', 'Adidas', 'Lululemon', 'Apple', 'Yeti', 
  'The North Face', 'Coach', 'On Running', 'Columbia',
  'Alo', 'Samsung', 'Sony', 'Vuori', 'Tumi', 'UGG'
];

// All brands from your app
const ALL_BRANDS = [
  'Abercrombie & Fitch', 'Adidas', 'Allbirds', 'Alo', 'Apple',
  'Birkenstock', 'Bombas', 'Brooks Brothers', 'Burberry', 'Burlebo',
  'Chubbies', 'Columbia', 'Cole Haan', 'Costa', 'Crocs',
  'Dolce & Gabbana', 'Gap', 'Kendra Scott', 'Lush', 'Nike',
  'Oakley', 'Omega', 'On Running', 'Poncho', 'Ray-Ban',
  'Restoration Hardware', 'Rhone', 'Rolex', 'Samsung', 'Sony',
  'Sun Bum', 'Tag Heuer', 'The North Face', 'TravisMatthew', 'Tommy Bahama',
  'Tumi', 'Ugg', 'Vera Wang', 'Vineyard Vines', 'Vuori',
  'Yeti', 'Montblanc', 'Madewell', 'J.Crew', 'Spanx',
  'Lululemon', 'Coach', 'Lucchese', 'Young LA', 'Baseball 101'
];

async function searchDealsForBrand(brandName) {
  // Use the correct /deals/deals-v2 endpoint
  const options = {
    method: 'GET',
    url: `https://${process.env.RAPIDAPI_HOST}/deals/deals-v2`,
    params: {
      q: `deals ${brandName} Shoes`,
      country: 'us',
      language: 'en',
      limit: '20',
      sort_by: 'BEST_MATCH'
    },
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
    }
  };

  try {
    console.log(`🔍 Searching for ${brandName}...`);
    console.log(`API URL: https://${process.env.RAPIDAPI_HOST}/deals/deals-v2`);
    console.log(`Query: deals ${brandName} Shoes`);
    
    const response = await axios.request(options);
    
    console.log(`📊 API Response Status: ${response.status}`);
    console.log(`📦 Raw data structure:`, JSON.stringify(response.data).substring(0, 200));
    
    // Handle different possible response structures
    const deals = response.data?.data?.products || response.data?.products || response.data?.data || [];
    
    console.log(`✅ Found ${deals.length} results for ${brandName}`);
    
    return deals;
  } catch (error) {
    console.error(`❌ Error fetching deals for ${brandName}:`);
    console.error(`Status: ${error.response?.status}`);
    console.error(`Status Text: ${error.response?.statusText}`);
    console.error(`Error Message: ${error.message}`);
    console.error(`Response Data:`, error.response?.data);
    return [];
  }
}

function normalizeDeals(rawDeals, brandName) {
  console.log(`🔧 Normalizing ${rawDeals.length} deals for ${brandName}`);
  
  const normalized = rawDeals
    .filter(deal => {
      // Filter out invalid deals
      if (!deal.product_title || !deal.offer?.price) {
        console.log(`⚠️  Skipping deal - missing title or price`);
        return false;
      }
      
      // Must have a link
      if (!deal.offer?.offer_page_url && !deal.product_page_url) {
        console.log(`⚠️  Skipping deal - no link`);
        return false;
      }
      
      // Filter out extreme prices (likely errors)
      const priceStr = deal.offer.price.replace(/[^0-9.]/g, '');
      const price = parseFloat(priceStr);
      if (price < 1 || price > 10000) {
        console.log(`⚠️  Skipping deal - invalid price: ${price}`);
        return false;
      }
      
      return true;
    })
    .map(deal => {
      const priceStr = deal.offer.price.replace(/[^0-9.]/g, '');
      const currentPrice = parseFloat(priceStr);
      
      let originalPrice = currentPrice;
      if (deal.offer.original_price) {
        const origPriceStr = deal.offer.original_price.replace(/[^0-9.]/g, '');
        originalPrice = parseFloat(origPriceStr);
      } else {
        // Assume 30% discount if no original price
        originalPrice = currentPrice * 1.3;
      }
      
      const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
      
      // Get first photo
      const image = deal.product_photos?.[0] || 
                   deal.product_photo || 
                   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop';
      
      return {
        brand: brandName,
        product: deal.product_title,
        originalPrice: Math.round(originalPrice * 100) / 100,
        salePrice: Math.round(currentPrice * 100) / 100,
        discount: discount > 0 ? `${discount}%` : '0%',
        image: image,
        retailer: deal.offer?.store_name || 'Online Store',
        link: deal.offer?.offer_page_url || deal.product_page_url,
        rating: deal.product_rating || null,
        reviewCount: deal.product_num_reviews || null,
        inStock: deal.offer?.on_sale !== false,
        lastUpdated: new Date().toISOString(),
        fetchedAt: new Date().toISOString()
      };
    })
    .filter(deal => parseInt(deal.discount) >= 10) // Only keep deals with 10%+ discount
    .sort((a, b) => parseInt(b.discount) - parseInt(a.discount)) // Best deals first
    .slice(0, 15); // Keep top 15 deals per brand
  
  console.log(`✅ Normalized to ${normalized.length} quality deals for ${brandName}`);
  return normalized;
}

async function storeDealsInFirestore(deals, brandName) {
  const db = getFirestore();
  const batch = db.batch();
  
  let storedCount = 0;
  
  for (const deal of deals) {
    const dealId = `${brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}-${storedCount}`;
    const dealRef = db.collection('deals').doc(dealId);
    
    batch.set(dealRef, {
      ...deal,
      id: dealId,
      createdAt: new Date().toISOString()
    });
    
    storedCount++;
  }
  
  // Commit the batch
  await batch.commit();
  
  console.log(`💾 Stored ${storedCount} deals for ${brandName}`);
  
  // Update brand metadata
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
  
  // Delete deals older than 24 hours
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
  
  // Clean old deals first
  await cleanOldDeals();
  
  // Fetch priority brands first
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
      
      // Rate limiting: wait 1 second between requests
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
