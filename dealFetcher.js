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
  // Try the /deals endpoint first
  const dealsOptions = {
    method: 'GET',
    url: `https://${process.env.RAPIDAPI_HOST}/deals`,
    params: {
      q: `${brandName}`,
      country: 'us',
      language: 'en',
      limit: '20'
    },
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
    }
  };

  try {
    console.log(`Searching for ${brandName} deals...`);
    const response = await axios.request(dealsOptions);
    console.log(`✅ Fetched ${response.data?.data?.length || 0} deals for ${brandName}`);
    return response.data?.data || [];
  } catch (dealsError) {
    console.error(`❌ /deals endpoint failed for ${brandName}:`, dealsError.response?.status, dealsError.message);
    
    // Fallback to /search endpoint with on_sale filter
    const searchOptions = {
      method: 'GET',
      url: `https://${process.env.RAPIDAPI_HOST}/search`,
      params: {
        q: `${brandName}`,
        country: 'us',
        language: 'en',
        limit: '20',
        sort_by: 'BEST_MATCH',
        on_sale: 'true'
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
      }
    };
    
    try {
      console.log(`Trying /search endpoint for ${brandName}...`);
      const searchResponse = await axios.request(searchOptions);
      console.log(`✅ Fetched ${searchResponse.data?.data?.length || 0} deals for ${brandName}`);
      return searchResponse.data?.data || [];
    } catch (searchError) {
      console.error(`❌ Both endpoints failed for ${brandName}`);
      console.error('Details:', searchError.response?.status, searchError.response?.data || searchError.message);
      return [];
    }
  }
}

function normalizeDeals(rawDeals, brandName) {
  return rawDeals
    .filter(deal => {
      // Filter out invalid deals
      if (!deal.product_title || !deal.offer?.price) return false;
      
      // Must have a price and link
      if (!deal.product_link) return false;
      
      // Filter out extreme prices (likely errors)
      const price = parseFloat(deal.offer.price);
      if (price < 1 || price > 10000) return false;
      
      return true;
    })
    .map(deal => {
      const currentPrice = parseFloat(deal.offer.price);
      const originalPrice = deal.offer.original_price 
        ? parseFloat(deal.offer.original_price) 
        : currentPrice * 1.3; // Assume 30% discount if no original price
      
      const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
      
      return {
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
    .filter(deal => parseInt(deal.discount) >= 10) // Only keep deals with 10%+ discount
    .sort((a, b) => parseInt(b.discount) - parseInt(a.discount)) // Best deals first
    .slice(0, 15); // Keep top 15 deals per brand
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
