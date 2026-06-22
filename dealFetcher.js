const axios = require('axios');
const { getFirestore } = require('./firebase');

const PRIORITY_BRANDS = [
  'Abercrombie & Fitch', 'Adidas', 'Aerie', 'AG Jeans', 'Allbirds', 'Alo', 'American Eagle', 'American Giant', 'Anthropologie', 
  'Arc\'teryx', 'Ariat', 'Aritzia', 'Asics', 'Athleta', 'Away', 'Banana Republic', 'BIRKENSTOCK',
  'Bombas', 'Bonobos', 'Brandy Melville', 'Brooks Brothers', 'Bubble', 'Burberry', 'Burlebo', 
  'Calvin Klein', 'Carhartt', 'Chloé', 'Christian Louboutin',
  'Chubbies', 'Cinch', 'Clarks', 'Coach', 'Cole Haan', 'Columbia', 'Comfrt', 'Converse', 'Costa', 'Crocs', 
  'Cruel Girl', 'Cult Gaia', 'Dacor', 'Dolce & Gabbana', 'Donna Karan', 'Dr. Martens', 'Estée Lauder', 
  'Everlane', 'Fear of God Essentials', 'Fendi', 'Feragamo', 'Free People', 
  'Gorjana', 'Goyard', 'Gucci', 'Gymshark', 'Havaianas', 'Hellstar', 'Hermès', 
  'Hoka', 'Hollister', 'J.Crew', 'Jimmy Choo', 'Justin Boots', 'Kate Spade', 'Kendra Scott', 'Kith', 
  'Lacoste', 'LANEIGE', 'Levi\'s', 'Levi Strauss', 'Louis Vuitton', 'Lucchese', 'Lucky', 'Lululemon', 
  'Lush', 'Mac Weldon', 'Madewell', 'Mammut', 'Marc Jacobs', 'Michael Kors', 'New Balance', 'Nike', 
  'Oakley', 'OluKai', 'On Running', 'OOFOS', 'Oscar de la Renta', 'Outdoor Voices', 'Panhandle Slim', 
  'Patagonia', 'Pelagic', 'Peter Millar', 'Polo Ralph Lauren', 'Poncho Outdoors', 'Prada', 'Puma', 
  'Rag & Bone', 'Ray-Ban', 'Reebok', 'Reef', 'Reformation', 'REI Co-op', 'Rhone', 'RTIC Outdoors',
  'Saint Laurent', 'Salomon', 'Samsonite', 'Sanuk', 'Shade Critters', 'Spanx', 'Stetson', 
  'Stuart Weitzman', 'Supreme', 'Sweaty Betty', 'Teva', 'The North Face', 'The Row', 'Theory', 
  'Thom Browne', 'Tiffany & Co.', 'Tom Ford', 'Tommy Bahama', 'Tony Lama', 'Tory Burch', 
  'TravisMatthew', 'Trendia', 'Tumi', 'UGG', 'Under Armour', 'Untuckit', 'Vans', 'Vera Wang', 
  'Victoria\'s Secret', 'Vince', 'Vineyard Vines', 'Vuori', 'Warby Parker', 'Wrangler', 
  'Yeti', 'YoungLA', 'Zara',
  'H&M', 'Tommy Hilfiger', 'Veja', 'Dooney & Bourke',
  'Stüssy', 'Loewe', 'Bottega Veneta', 'Alaïa', 'Staud', 'Alice + Olivia', 'Mango',
  'Baseball Lifestyle 101', 'Dirty Mids'
];

// Brand-specific search query overrides
// Use when the brand name is ambiguous and returns wrong results
const BRAND_SEARCH_OVERRIDES = {
  'Comfrt':          'Comfrt clothing brand apparel',
  'Costa':           'Costa Del Mar sunglasses apparel',
  'Columbia':        'Columbia Sportswear outdoor clothing',
  'Bubble':          'Bubble skincare beauty',
  'Clarks':          'Clarks shoes footwear',
  'Lucky':           'Lucky Brand jeans clothing',
  'Reef':            'Reef sandals footwear',
  'Vince':           'Vince clothing fashion apparel',
  'Theory':          'Theory clothing fashion apparel',
  'Lush':            'Lush cosmetics beauty',
  'Trendia':         'Trendia fashion clothing',
  'Shade Critters':  'Shade Critters kids swimwear',
  'Baseball Lifestyle 101': 'Baseball Lifestyle 101 Dicks Sporting Goods apparel hat',
  'Dirty Mids': 'Dirty Mids sneakers footwear',
  'Dacor':           'Dacor appliances',
};

// Brand-specific keyword blocklists
// If a product title contains ANY of these words, the deal is rejected
const BRAND_BLOCKLIST = {
  'Comfrt':  ['softener', 'fabric', 'whiskey', 'whisky', 'bourbon', 'liquor', 'coffee', 'detergent', 'cleaner'],
  'Costa':   ['coffee', 'cafe', 'espresso', 'latte', 'cappuccino', 'drink', 'beverage'],
  'Columbia': ['university', 'records', 'pictures', 'film', 'movie', 'school'],
  'Bubble':  ['wrap', 'bath', 'gum', 'tea', 'drink', 'beverage', 'soda'],
  'Clarks':  ['candy', 'shoe polish'],
  'Lucky':   ['charms', 'strike', 'dip', 'tobacco'],
  'Reef':    ['fish', 'aquarium', 'tank', 'supplement', 'vitamin'],
  'Lush':    ['plant', 'lawn', 'grass', 'garden', 'fertilizer'],
  'Baseball Lifestyle 101': ['field maintenance', 'pitching machine', 'batting cage', 'dugout'],
  'Dirty Mids': ['dirty', 'used', 'worn', 'vintage', 'damaged'],
};

// Keywords that MUST appear in product title or retailer for the brand to be valid
// Leave empty to skip this check for a brand
const BRAND_RELEVANCE_REQUIRED = {
  'Comfrt':  ['comfrt'],
  'Costa':   ['costa del mar', 'costa sunglasses', 'costa'],
};

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

  // Use brand-specific search query if defined
  if (BRAND_SEARCH_OVERRIDES[brandName]) {
    options.params.q = BRAND_SEARCH_OVERRIDES[brandName];
  }

  try {
    console.log(`🔍 Fetching ${brandName} (query: "${options.params.q}")...`);
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
  const cleaned = String(priceString).replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Brands that are TRULY unisex — only sell gender-neutral products
// Do NOT include brands that sell both men's and women's clothing/footwear
const UNISEX_BRANDS = [
  'Yeti', 'RTIC Outdoors', 'Pelagic',
  'Costa', 'Oakley', 'Ray-Ban', 'Warby Parker',
  'Tumi', 'Samsonite', 'Away',
  'Gorjana', 'Kendra Scott',
  'Estée Lauder', 'Lush', 'Bubble', 'LANEIGE', 'Dacor',
  'Bombas',
];

function detectGender(productTitle, brandName) {
  const title = productTitle.toLowerCase();

  // If the brand is inherently unisex, return unisex immediately
  if (brandName && UNISEX_BRANDS.includes(brandName)) return 'unisex';

  // Check women FIRST and broadly — before men, to avoid "women" being missed
  const womenKeywords = [
    "women's", "womens", "woman's", "womans", "women ", "women-",
    "ladies", "lady's", "ladys", "feminine", "female",
    "girls'", "girls ", "girl's", "girls-", "junior girls",
    // Gendered product types
    "bra", "bralette", "bikini top", "tankini", "one-piece swimsuit",
    "dress", "skirt", "blouse", "camisole", "cami", "lingerie",
    "maternity", "nursing", "midi", "maxi skirt", "mini skirt",
    "bodysuit", "jumpsuit for women", "romper for women"
  ];

  const menKeywords = [
    "men's", "mens", "man's", "mans", "men ", "men-",
    "boys'", "boys ", "boy's", "boys-", "junior boys",
    "masculine", "male ",
    // Gendered product types
    "beard", "necktie", "bow tie", "cufflinks",
    "boxer", "brief for men", "jockstrap",
    "tuxedo", "suit jacket for men"
  ];

  const kidsKeywords = [
    "kids'", "kids ", "kid's", "children's", "childrens",
    "toddler", "infant", "baby ", "youth ", "juvenile",
    "little kids", "big kids", "grade school"
  ];

  const unisexKeywords = [
    "unisex", "gender neutral", "gender-neutral",
    "all genders", "everyone", "adult "
  ];

  // Check for explicit unisex first
  if (unisexKeywords.some(kw => title.includes(kw))) return 'unisex';

  // Check kids (separate from boys/girls)
  if (kidsKeywords.some(kw => title.includes(kw))) {
    // Try to determine if boys or girls kids
    if (womenKeywords.some(kw => title.includes(kw))) return 'girls';
    if (menKeywords.some(kw => title.includes(kw))) return 'boys';
    return 'kids'; // generic kids — shown under boys AND girls filters
  }

  // Check women before men to avoid partial matches
  if (womenKeywords.some(kw => title.includes(kw))) return 'women';
  if (menKeywords.some(kw => title.includes(kw))) return 'men';

  // Return null for truly untagged items — frontend will show these
  // only when NO gender filter is active, not under all filters
  return null;
}

function normalizeDeals(products, brandName) {
  console.log(`📝 Normalizing ${products.length} products for ${brandName}...`);
  
  const deals = [];
  
  const blocklist = BRAND_BLOCKLIST[brandName] || [];
  const relevanceRequired = BRAND_RELEVANCE_REQUIRED[brandName] || [];

  for (const product of products) {
    if (!product.product_title) continue;
    if (!product.offer) continue;

    const titleLower = (product.product_title || '').toLowerCase();
    const retailerLower = (product.offer.store_name || '').toLowerCase();
    const combinedText = `${titleLower} ${retailerLower}`;

    // Reject if any blocklist word appears in the product title
    if (blocklist.some(word => titleLower.includes(word))) {
      console.log(`   ⛔ Blocked: "${product.product_title}" (matched blocklist)`);
      continue;
    }

    // Reject if none of the required relevance keywords appear
    if (relevanceRequired.length > 0 && !relevanceRequired.some(kw => combinedText.includes(kw))) {
      console.log(`   ⛔ Rejected: "${product.product_title}" (failed relevance check)`);
      continue;
    }

    // General relevance check — only apply to brands that are highly ambiguous
    const AMBIGUOUS_BRANDS = ['Bubble', 'Clarks', 'Lucky', 'Reef', 'Lush', 'Vince', 'Theory', 'Mango'];

    // TRUSTED_BRANDS: well-known brands whose products often don't include brand name in title
    const TRUSTED_BRANDS = [
      'Lululemon', 'Yeti', 'Patagonia', 'The North Face', 'Nike', 'Adidas', 'Puma',
      'Alo', 'Vuori', 'Gymshark', 'Athleta', 'Sweaty Betty', 'Outdoor Voices',
      'Mammut', 'Salomon', 'Hoka', 'On Running', 'Allbirds', 'Veja',
      'BIRKENSTOCK', 'Teva', 'UGG', 'Crocs', 'Converse', 'Vans',
      'Polo Ralph Lauren', 'Tommy Hilfiger', 'Calvin Klein', 'Lacoste',
      'Vineyard Vines', 'Peter Millar', 'Tommy Bahama', 'TravisMatthew',
      'Rhone', 'Mac Weldon', 'Bonobos', 'Untuckit',
    ];

    if (!TRUSTED_BRANDS.includes(brandName) && relevanceRequired.length === 0 && AMBIGUOUS_BRANDS.includes(brandName)) {
      const brandWords = brandName.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(' ')
        .filter(w => w.length > 2);
      const brandAppears = brandWords.some(word => combinedText.includes(word));
      if (!brandAppears) {
        console.log(`   ⛔ Rejected: "${product.product_title}" (brand name not found)`);
        continue;
      }
    }
    
    const currentPrice = parsePrice(product.offer.price);
    if (!currentPrice || currentPrice < 1) continue;
    
    const link = product.offer.offer_page_url || product.product_page_url;
    if (!link) continue;
    
    // ── FEATURE FLAG ─────────────────────────────────────────────
    // REQUIRE_VERIFIED_PRICE = true  → only deals with a real original price from the API
    // REQUIRE_VERIFIED_PRICE = false → estimates original price when missing (more deals)
    const REQUIRE_VERIFIED_PRICE = false;
    // ─────────────────────────────────────────────────────────────

    const originalPrice = REQUIRE_VERIFIED_PRICE
      ? parsePrice(product.offer.original_price)
      : (parsePrice(product.offer.original_price) || currentPrice * 1.25);

    if (!originalPrice || originalPrice <= currentPrice) continue;

    const savings = originalPrice - currentPrice;
    const discountPercent = Math.round((savings / originalPrice) * 100);

    if (discountPercent < 10) continue;
    
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
      gender: detectGender(product.product_title, brandName),
      lastUpdated: new Date().toISOString(),
      fetchedAt: new Date().toISOString()
    });
  }
  
  deals.sort((a, b) => parseInt(b.discount) - parseInt(a.discount));
  const topDeals = deals.slice(0, 15);
  
  console.log(`   ✅ ${topDeals.length} valid deals with 10%+ discount`);
  
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

  // Process brands ONE AT A TIME with a delay between each
  // This prevents hitting RapidAPI rate limits (429 errors)
  for (let i = 0; i < PRIORITY_BRANDS.length; i++) {
    const brandName = PRIORITY_BRANDS[i];
    console.log(`📦 Processing brand ${i + 1}/${PRIORITY_BRANDS.length}: ${brandName}`);

    try {
      const products = await searchDealsForBrand(brandName);
      const deals = normalizeDeals(products, brandName);

      if (deals.length > 0) {
        await storeDealsInFirestore(deals, brandName);
        totalDeals += deals.length;
      }
      successfulBrands++;
    } catch (error) {
      console.error(`❌ Failed: ${brandName} - ${error.message}`);
    }

    // Wait 3 seconds between each brand to stay within RapidAPI rate limits
    if (i < PRIORITY_BRANDS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('='.repeat(50));
  console.log(`✅ COMPLETE`);
  console.log(`   Deals: ${totalDeals}`);
  console.log(`   Brands: ${successfulBrands}/${PRIORITY_BRANDS.length}`);
  console.log(`   Time: ${duration}s (${(duration / 60).toFixed(1)} minutes)`);
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
