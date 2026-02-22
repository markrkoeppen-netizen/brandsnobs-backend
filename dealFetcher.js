// dealFetcher.js - Optimized parallel batch fetching
const axios = require('axios');
const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// 83 BRANDS - Updated with Peter Millar and Goyard
const BRANDS = [
  // Luxury Fashion Icons
  { name: 'Gucci', category: 'Fashion' },
  { name: 'Prada', category: 'Fashion' },
  { name: 'Louis Vuitton', category: 'Fashion' },
  { name: 'Hermès', category: 'Fashion' },
  { name: 'Goyard', category: 'Accessories' },  // NEW
  { name: 'Fendi', category: 'Fashion' },
  { name: 'Saint Laurent', category: 'Fashion' },
  { name: 'Chloé', category: 'Fashion' },
  { name: 'The Row', category: 'Fashion' },
  { name: 'Burberry', category: 'Fashion' },
  { name: 'Dolce & Gabbana', category: 'Fashion' },
  
  // Designer Shoes & Accessories
  { name: 'Christian Louboutin', category: 'Footwear' },
  { name: 'Jimmy Choo', category: 'Footwear' },
  { name: 'Stuart Weitzman', category: 'Footwear' },
  { name: 'Cole Haan', category: 'Footwear' },
  { name: 'Feragamo', category: 'Footwear' },
  { name: 'Lucchese', category: 'Footwear' },
  { name: 'Tumi', category: 'Accessories' },
  { name: 'Coach', category: 'Accessories' },
  
  // Athletic & Athleisure
  { name: 'Nike', category: 'Footwear' },
  { name: 'Adidas', category: 'Footwear' },
  { name: 'Lululemon', category: 'Fashion' },
  { name: 'Alo', category: 'Fashion' },
  { name: 'Vuori', category: 'Fashion' },
  { name: 'On Running', category: 'Footwear' },
  { name: 'Athleta', category: 'Fashion' },
  { name: 'Under Armour', category: 'Fashion' },
  { name: 'YoungLA', category: 'Fashion' },
  
  // Contemporary American
  { name: 'Michael Kors', category: 'Fashion' },
  { name: 'Tory Burch', category: 'Fashion' },
  { name: 'Kate Spade', category: 'Accessories' },
  { name: 'Marc Jacobs', category: 'Fashion' },
  { name: 'Donna Karan', category: 'Fashion' },
  { name: 'Vera Wang', category: 'Fashion' },
  { name: 'Oscar de la Renta', category: 'Fashion' },
  { name: 'Tom Ford', category: 'Fashion' },
  
  // Casual & Lifestyle
  { name: 'Polo Ralph Lauren', category: 'Fashion' },
  { name: 'Peter Millar', category: 'Fashion' },  // NEW
  { name: 'Tommy Bahama', category: 'Fashion' },
  { name: 'Vineyard Vines', category: 'Fashion' },
  { name: 'Lacoste', category: 'Fashion' },
  { name: 'Abercrombie & Fitch', category: 'Fashion' },
  { name: 'Madewell', category: 'Fashion' },
  { name: 'Kith', category: 'Fashion' },
  { name: 'Brooks Brothers', category: 'Fashion' },
  { name: 'Chubbies', category: 'Fashion' },
  { name: 'TravisMatthew', category: 'Fashion' },
  { name: 'Rhone', category: 'Fashion' },
  
  // Footwear & Comfort
  { name: 'UGG', category: 'Footwear' },
  { name: 'BIRKENSTOCK', category: 'Footwear' },
  { name: 'Crocs', category: 'Footwear' },
  { name: 'Allbirds', category: 'Footwear' },
  { name: 'Bombas', category: 'Accessories' },
  
  // Eyewear & Accessories
  { name: 'Ray-Ban', category: 'Accessories' },
  { name: 'Oakley', category: 'Accessories' },
  { name: 'Costa', category: 'Accessories' },
  { name: 'Kendra Scott', category: 'Jewelry' },
  
  // Outdoor & Technical
  { name: 'The North Face', category: 'Outdoor' },
  { name: 'Columbia', category: 'Outdoor' },
  { name: 'Yeti', category: 'Outdoor' },
  
  // Avant-Garde & Modern
  { name: 'Thom Browne', category: 'Fashion' },
  { name: 'Cult Gaia', category: 'Accessories' },
  { name: 'Burlebo', category: 'Fashion' },
  { name: 'Poncho Outdoors', category: 'Fashion' },
  
  // Beauty & Home
  { name: 'Estée Lauder', category: 'Cosmetics' },
  { name: 'Lush', category: 'Cosmetics' },
  { name: 'Dacor', category: 'Home' },
  
  // Western & Country
  { name: 'Ariat', category: 'Footwear' },
  { name: 'Wrangler', category: 'Fashion' },
  { name: 'Carhartt', category: 'Fashion' },
  { name: 'Tecovas', category: 'Footwear' },
  { name: 'Corral', category: 'Footwear' }
];

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'real-time-product-search.p.rapidapi.com';

// Normalize deal data
const normalizeDeal = (product, brandName) => {
  if (!product || !product.product_title || !product.offer?.price) {
    return null;
  }

  const price = parseFloat(product.offer.price.replace(/[^0-9.]/g, ''));
  if (isNaN(price) || price <= 0) {
    return null;
  }

  return {
    brand: brandName,
    title: product.product_title,
    price: price,
    originalPrice: product.typical_price_range ? 
      parseFloat(product.typical_price_range[1]?.replace(/[^0-9.]/g, '')) || price :
      price,
    discount: product.offer.on_sale ? 
      Math.round(((price / (product.typical_price_range?.[1] ? parseFloat(product.typical_price_range[1].replace(/[^0-9.]/g, '')) : price)) - 1) * -100) :
      0,
    link: product.offer.offer_page_url || product.product_page_url,
    image: product.product_photos?.[0] || '',
    store: product.offer.store_name || 'Unknown',
    category: BRANDS.find(b => b.name === brandName)?.category || 'Fashion',
    rating: product.product_rating || 0,
    reviews: product.product_num_reviews || 0,
    lastUpdated: new Date().toISOString()
  };
};

// Fetch deals for a single brand
const fetchBrandDeals = async (brandName) => {
  try {
    console.log(`🔍 Fetching ${brandName}...`);
    
    const response = await axios.get('https://real-time-product-search.p.rapidapi.com/search', {
      params: {
        q: brandName,
        country: 'us',
        language: 'en',
        limit: '20',
        sort_by: 'BEST_MATCH',
        product_condition: 'ANY'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      },
      timeout: 30000
    });

    if (!response.data || !response.data.data) {
      console.log(`   ⚠️ No data returned for ${brandName}`);
      return { brand: brandName, deals: [], error: null };
    }

    const products = response.data.data;
    console.log(`   Found ${products.length} products`);

    console.log(`📝 Normalizing ${products.length} products for ${brandName}...`);
    const deals = products
      .map(product => normalizeDeal(product, brandName))
      .filter(deal => deal !== null);

    console.log(`   ✅ ${deals.length} valid deals`);
    return { brand: brandName, deals, error: null };

  } catch (error) {
    console.error(`   ❌ Error fetching ${brandName}:`, error.message);
    return { brand: brandName, deals: [], error: error.message };
  }
};

// Process brands in parallel batches
const fetchBrandsInBatches = async (brands, batchSize = 10) => {
  const results = [];
  const totalBatches = Math.ceil(brands.length / batchSize);
  
  for (let i = 0; i < brands.length; i += batchSize) {
    const batch = brands.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} brands)...`);
    
    const batchPromises = batch.map(brand => fetchBrandDeals(brand.name));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < brands.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
};

// Store deals in Firestore
const storeDealsInFirestore = async (allDeals) => {
  const batch = db.batch();
  let count = 0;

  for (const deal of allDeals) {
    const dealId = `${deal.brand}_${Date.now()}_${count}`;
    const dealRef = db.collection('deals').doc(dealId);
    batch.set(dealRef, deal);
    count++;
  }

  await batch.commit();
  console.log(`💾 Stored ${count} deals for ${new Set(allDeals.map(d => d.brand)).size} brands`);
  return count;
};

// Main function
const fetchAndStoreDeals = async () => {
  const startTime = Date.now();
  console.log('🚀 Starting deal fetch for 83 brands...');
  console.log(`⏰ Started at: ${new Date().toISOString()}\n`);

  try {
    // Fetch all brands in parallel batches
    const results = await fetchBrandsInBatches(BRANDS, 10);

    // Collect all deals
    const allDeals = [];
    let successfulBrands = 0;
    let failedBrands = 0;

    for (const result of results) {
      if (result.deals.length > 0) {
        allDeals.push(...result.deals);
        successfulBrands++;
        console.log(`💾 Stored ${result.deals.length} deals for ${result.brand}`);
      } else if (result.error) {
        failedBrands++;
        console.log(`❌ Failed: ${result.brand} - ${result.error}`);
      } else {
        failedBrands++;
        console.log(`⚠️ No deals found for ${result.brand}`);
      }
    }

    // Store in Firestore
    if (allDeals.length > 0) {
      await storeDealsInFirestore(allDeals);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ COMPLETE');
    console.log(`   Deals: ${allDeals.length}`);
    console.log(`   Brands: ${successfulBrands}/${BRANDS.length}`);
    console.log(`   Time: ${duration}s (${(duration / 60).toFixed(1)} minutes)`);
    console.log('='.repeat(50));

    return {
      totalDeals: allDeals.length,
      successfulBrands,
      failedBrands,
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Fatal error in fetchAndStoreDeals:', error);
    throw error;
  }
};

module.exports = { fetchAndStoreDeals };
