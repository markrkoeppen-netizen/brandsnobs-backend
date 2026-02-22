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
const PRIORITY_BRANDS = [
  'Abercrombie & Fitch',
  'Adidas',
  'Alo',
  'Athleta',
  'BIRKENSTOCK',
  'Bombas',
  'Brooks Brothers',
  'Burberry',
  'Chloé',
  'Christian Louboutin',
  'Chubbies',
  'Coach',
  'Cole Haan',
  'Crocs',
  'Dolce & Gabbana',
  'Donna Karan',
  'Fendi',
  'Gucci',
  'Hermès',
  'Goyard',
  'Jimmy Choo',
  'Kate Spade',
  'Kith',
  'Lacoste',
  'Louis Vuitton',
  'Lululemon',
  'Lucchese',
  'Madewell',
  'Marc Jacobs',
  'Michael Kors',
  'Nike',
  'On Running',
  'Oscar de la Renta',
  'Peter Millar',
  'Polo Ralph Lauren',
  'Prada',
  'Rhone',
  'Saint Laurent',
  'Stuart Weitzman',
  'The Row',
  'Tom Ford',
  'Tommy Bahama',
  'Tory Burch',
  'TravisMatthew',
  'Tumi',
  'UGG',
  'Under Armour',
  'Vera Wang',
  'Vineyard Vines',
  'Vuori',
  'YoungLA',
  'Feragamo',
  'Allbirds',
  'Ray-Ban',
  'Oakley',
  'Costa',
  'Kendra Scott',
  'The North Face',
  'Columbia',
  'Yeti',
  'Thom Browne',
  'Cult Gaia',
  'Burlebo',
  'Poncho Outdoors',
  'Estée Lauder',
  'Lush',
  'Dacor',
  'Ariat',
  'Wrangler',
  'Carhartt',
  'Tecovas',
  'Corral'
];

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'real-time-product-search.p.rapidapi.com';

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
      console.log(`   ⚠️ No data for ${brandName}`);
      return [];
    }

    const products = response.data.data;
    console.log(`   Found ${products.length} products`);

    const deals = products
      .map(product => {
        if (!product || !product.product_title || !product.offer?.price) {
          return null;
        }

        const price = parseFloat(product.offer.price.replace(/[^0-9.]/g, ''));
        if (isNaN(price) || price <= 0) return null;

        return {
          brand: brandName,
          title: product.product_title,
          price: price,
          originalPrice: product.typical_price_range?.[1] ? 
            parseFloat(product.typical_price_range[1].replace(/[^0-9.]/g, '')) || price : price,
          discount: product.offer.on_sale ? 
            Math.round(((price / (product.typical_price_range?.[1] ? 
              parseFloat(product.typical_price_range[1].replace(/[^0-9.]/g, '')) : price)) - 1) * -100) : 0,
          link: product.offer.offer_page_url || product.product_page_url,
          image: product.product_photos?.[0] || '',
          store: product.offer.store_name || 'Unknown',
          category: 'Fashion',
          rating: product.product_rating || 0,
          reviews: product.product_num_reviews || 0,
          lastUpdated: new Date().toISOString()
        };
      })
      .filter(deal => deal !== null);

    console.log(`   ✅ ${deals.length} valid deals`);
    return deals;

  } catch (error) {
    console.error(`   ❌ Error fetching ${brandName}:`, error.message);
    return [];
  }
};

const fetchBrandsInBatches = async (brands, batchSize = 10) => {
  const allDeals = [];
  const totalBatches = Math.ceil(brands.length / batchSize);
  
  for (let i = 0; i < brands.length; i += batchSize) {
    const batch = brands.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} brands)...`);
    
    const batchPromises = batch.map(brand => fetchBrandDeals(brand));
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach((deals, index) => {
      if (deals.length > 0) {
        allDeals.push(...deals);
        console.log(`💾 Stored ${deals.length} deals for ${batch[index]}`);
      }
    });
    
    if (i + batchSize < brands.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return allDeals;
};

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
  return count;
};

const fetchAndStoreDeals = async () => {
  const startTime = Date.now();
  console.log(`🚀 Starting deal fetch for ${PRIORITY_BRANDS.length} brands...`);
  console.log(`⏰ Started at: ${new Date().toISOString()}\n`);

  try {
    const allDeals = await fetchBrandsInBatches(PRIORITY_BRANDS, 10);

    if (allDeals.length > 0) {
      await storeDealsInFirestore(allDeals);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const uniqueBrands = new Set(allDeals.map(d => d.brand)).size;
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ COMPLETE');
    console.log(`   Deals: ${allDeals.length}`);
    console.log(`   Brands: ${uniqueBrands}/${PRIORITY_BRANDS.length}`);
    console.log(`   Time: ${duration}s (${(duration / 60).toFixed(1)} minutes)`);
    console.log('='.repeat(50));

    return {
      totalDeals: allDeals.length,
      successfulBrands: uniqueBrands,
      failedBrands: PRIORITY_BRANDS.length - uniqueBrands,
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
};

module.exports = { fetchAndStoreDeals };
