const axios = require('axios');
const { getFirestore } = require('./firebase');

const PRIORITY_BRANDS = [
  'Abercrombie & Fitch', 'Adidas', 'Aerie', 'AG Jeans', 'Allbirds', 'Alo', 'American Eagle', 'American Giant', 'Anthropologie', 
  "Arc'teryx", 'Ariat', 'Aritzia', 'Asics', 'Athleta', 'Away', 'Banana Republic', 'BIRKENSTOCK',
  'Bombas', 'Bonobos', 'Brandy Melville', 'Brooks Brothers', 'Bubble', 'Burberry', 'Burlebo', 
  'Calvin Klein', 'Carhartt', 'Chloé', 'Christian Louboutin',
  'Chubbies', 'Cinch', 'Clarks', 'Coach', 'Cole Haan', 'Columbia', 'Comfrt', 'Converse', 'Costa', 'Crocs', 
  'Cruel Girl', 'Cult Gaia', 'Dacor', 'Dolce & Gabbana', 'Donna Karan', 'Dr. Martens', 'Estée Lauder', 
  'Everlane', 'Fear of God Essentials', 'Fendi', 'Feragamo', 'Free People', 
  'Gorjana', 'Goyard', 'Gucci', 'Gymshark', 'Havaianas', 'Hellstar', 'Hermès', 
  'Hoka', 'Hollister', 'J.Crew', 'Jimmy Choo', 'Justin Boots', 'Kate Spade', 'Kendra Scott', 'Kith', 
  'Lacoste', 'LANEIGE', "Levi's", 'Levi Strauss', 'Louis Vuitton', 'Lucchese', 'Lucky', 'Lululemon', 
  'Lush', 'Mac Weldon', 'Madewell', 'Mammut', 'Marc Jacobs', 'Michael Kors', 'New Balance', 'Nike', 
  'Oakley', 'OluKai', 'On Running', 'OOFOS', 'Oscar de la Renta', 'Outdoor Voices', 'Panhandle Slim', 
  'Patagonia', 'Pelagic', 'Peter Millar', 'Polo Ralph Lauren', 'Poncho Outdoors', 'Prada', 'Puma', 
  'Rag & Bone', 'Ray-Ban', 'Reebok', 'Reef', 'Reformation', 'REI Co-op', 'Rhone', 'RTIC Outdoors',
  'Saint Laurent', 'Salomon', 'Samsonite', 'Sanuk', 'Shade Critters', 'Spanx', 'Stetson', 
  'Stuart Weitzman', 'Supreme', 'Sweaty Betty', 'Teva', 'The North Face', 'The Row', 'Theory', 
  'Thom Browne', 'Tiffany & Co.', 'Tom Ford', 'Tommy Bahama', 'Tony Lama', 'Tory Burch', 
  'TravisMatthew', 'Trendia', 'Tumi', 'UGG', 'Under Armour', 'Untuckit', 'Vans', 'Vera Wang', 
  "Victoria's Secret", 'Vince', 'Vineyard Vines', 'Vuori', 'Warby Parker', 'Wrangler', 
  'Yeti', 'YoungLA', 'Zara',
  'H&M', 'Tommy Hilfiger', 'Veja', 'Dooney & Bourke',
  'Stüssy', 'Loewe', 'Bottega Veneta', 'Alaïa', 'Staud', 'Alice + Olivia', 'Mango',
  'Baseball Lifestyle 101', 'Dirty Mids',
  'Mizzen+Main', 'Ten Thousand', 'Redvanly', 'Chanel', "Alter'd State"
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
  'Dirty Mids':      'Dirty Mids sneakers footwear',
  'Dacor':           'Dacor appliances',
  'Mizzen+Main':     'Mizzen+Main dress shirts performance apparel',
  'Ten Thousand':    'Ten Thousand athletic training apparel',
  'Redvanly':        'Redvanly golf pants lifestyle clothing',
  "Alter'd State":   "Alter'd State women clothing boutique",
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

// ── Tiered per-brand depth ────────────────────────────────────
// Checking every one of the 20 candidates per product costs a real API call.
// Rather than spending that budget uniformly across all 158 brands (most of
// which nobody may be following), brands actually followed by at least one
// user get checked deeply; brands nobody follows yet get a small baseline
// check instead (so their page isn't totally empty), not zero.
const FOLLOWED_BRAND_CAP = 20;
const UNFOLLOWED_BRAND_CAP = 1;

// Marketplace/reseller stores excluded from deals. These are peer-to-peer or
// auction-style platforms where "sale" pricing is inconsistent, inventory is
// single-unit, and the seller isn't an authorized retailer — not a good fit
// for a brand-trust-based deal tracker. Add/remove names as needed.
const MARKETPLACE_RESELLER_BLOCKLIST = [
  'ebay', 'poshmark', 'mercari', 'stockx', 'goat', 'depop', 'thredup', 'grailed'
];

// Reads the custom_brands Firestore collection (populated by add-brand.html)
// and returns the brand names to merge into the fetch. Also registers any
// per-brand search override / blocklist / relevance data those custom
// entries provide, by merging into the existing lookup objects — the rest
// of the pipeline picks these up automatically, no other code needs to
// change. Fails safe: a Firestore error here just means no custom brands
// get merged in this run, not a crashed fetch.
async function loadCustomBrands() {
  try {
    const db = getFirestore();
    const snapshot = await db.collection('custom_brands').get();
    const brandNames = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.name) return;
      brandNames.push(data.name);

      if (data.searchOverride) {
        BRAND_SEARCH_OVERRIDES[data.name] = data.searchOverride;
      }
      if (Array.isArray(data.blocklistWords) && data.blocklistWords.length > 0) {
        BRAND_BLOCKLIST[data.name] = data.blocklistWords;
      }
      if (Array.isArray(data.relevanceRequired) && data.relevanceRequired.length > 0) {
        BRAND_RELEVANCE_REQUIRED[data.name] = data.relevanceRequired;
      }
    });

    return brandNames;
  } catch (error) {
    console.error('Error loading custom brands (continuing with hardcoded brand list only):', error.message);
    return [];
  }
}

// Optional safety valve for testing: set TEST_BRAND_LIMIT in Railway's
// environment variables (e.g. "5") to only process the first N brands.
// Remove the env var (or set to 0) to run the full brand list normally.
async function getActiveBrandList() {
  const customBrands = await loadCustomBrands();
  if (customBrands.length > 0) {
    console.log(`📋 Merged in ${customBrands.length} custom brand(s): ${customBrands.join(', ')}`);
  }

  const allBrands = [...PRIORITY_BRANDS, ...customBrands];

  const limit = parseInt(process.env.TEST_BRAND_LIMIT || '0', 10);
  if (limit > 0) {
    console.log(`⚠️  TEST MODE: only processing first ${limit} brands (TEST_BRAND_LIMIT is set)`);
    return allBrands.slice(0, limit);
  }
  return allBrands;
}

// Counts how many users currently follow each brand, by reading every user
// document's `brands` array. This is a Firestore-only operation — it does
// NOT call the RapidAPI product-search API, so it doesn't affect API budget.
// If this fails for any reason, we fail safe: return an empty count map,
// which means every brand falls back to the unfollowed (low-cost) tier
// rather than crashing the whole fetch.
async function getFollowedBrandCounts() {
  try {
    const db = getFirestore();
    const usersSnapshot = await db.collection('users').get();
    const counts = {};

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const brands = data.brands || [];
      brands.forEach(b => {
        if (b && b.name) {
          counts[b.name] = (counts[b.name] || 0) + 1;
        }
      });
    });

    return counts;
  } catch (error) {
    console.error('Error fetching followed-brand counts (falling back to unfollowed tier for all brands):', error.message);
    return {};
  }
}

async function searchDealsForBrand(brandName) {
  // NOTE: We use /deals for DISCOVERY (not /search). /deals is purpose-built
  // to return already-on-sale items — nearly everything it returns is a
  // genuine deal. /search is a general product search where only a small
  // fraction of results happen to be on sale, which was starving us of
  // candidates (e.g. Alo returning 0). /deals' own link field is still a
  // useless Google Shopping URL, so we still fetch the real retailer link
  // separately via /product-details using product_id — same as before,
  // just swapping which endpoint feeds the candidate list.
  const options = {
    method: 'GET',
    url: `https://${process.env.RAPIDAPI_HOST}/deals`,
    params: {
      q: `deals ${brandName}`,
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
    options.params.q = `deals ${BRAND_SEARCH_OVERRIDES[brandName]}`;
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

// Fetches the real merchant offers (with direct retailer URLs) for a single
// product using its product_id. This is the ONLY way to get a real store
// link — /search never returns one.
async function fetchOffersForProduct(productId, retryOn429 = true) {
  const options = {
    method: 'GET',
    url: `https://${process.env.RAPIDAPI_HOST}/product-details`,
    params: {
      product_id: productId,
      country: 'us',
      language: 'en'
    },
    headers: {
      'x-rapidapi-host': process.env.RAPIDAPI_HOST,
      'x-rapidapi-key': process.env.RAPIDAPI_KEY
    }
  };

  try {
    const response = await axios.request(options);
    return response.data?.data?.offers || [];
  } catch (error) {
    const status = error.response?.status;
    if (status === 429 && retryOn429) {
      // Rate limited — wait longer and try once more before giving up
      console.log(`      ⏳ Rate limited on product-details, waiting 5s to retry...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return fetchOffersForProduct(productId, false);
    }
    console.error(`      OFFERS ERROR for product ${productId}: ${error.message}`);
    return [];
  }
}


function parsePrice(priceString) {
  if (!priceString) return null;
  const cleaned = String(priceString).replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parses a percent-off string like "29% off" or "29% OFF" into 29
function parsePercentOff(percentString) {
  if (!percentString) return null;
  const match = String(percentString).match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
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

  if (brandName && UNISEX_BRANDS.includes(brandName)) return 'unisex';

  const womenKeywords = [
    "women's", "womens", "woman's", "womans", "women ", "women-",
    "ladies", "lady's", "ladys", "feminine", "female",
    "girls'", "girls ", "girl's", "girls-", "junior girls",
    "bra", "bralette", "bikini top", "tankini", "one-piece swimsuit",
    "dress", "skirt", "blouse", "camisole", "cami", "lingerie",
    "maternity", "nursing", "midi", "maxi skirt", "mini skirt",
    "bodysuit", "jumpsuit for women", "romper for women"
  ];

  const menKeywords = [
    "men's", "mens", "man's", "mans", "men ", "men-",
    "boys'", "boys ", "boy's", "boys-", "junior boys",
    "masculine", "male ",
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

  if (unisexKeywords.some(kw => title.includes(kw))) return 'unisex';

  if (kidsKeywords.some(kw => title.includes(kw))) {
    if (womenKeywords.some(kw => title.includes(kw))) return 'girls';
    if (menKeywords.some(kw => title.includes(kw))) return 'boys';
    return 'kids';
  }

  if (womenKeywords.some(kw => title.includes(kw))) return 'women';
  if (menKeywords.some(kw => title.includes(kw))) return 'men';

  return null;
}

// STEP 1 of normalization: filter the /search results down to a short list
// of relevant, on-sale candidates worth spending a second API call on.
function filterCandidateProducts(products, brandName, perBrandCap) {
  const blocklist = BRAND_BLOCKLIST[brandName] || [];
  const relevanceRequired = BRAND_RELEVANCE_REQUIRED[brandName] || [];

  const AMBIGUOUS_BRANDS = ['Bubble', 'Clarks', 'Lucky', 'Reef', 'Lush', 'Vince', 'Theory', 'Mango'];
  const TRUSTED_BRANDS = [
    'Lululemon', 'Yeti', 'Patagonia', 'The North Face', 'Nike', 'Adidas', 'Puma',
    'Alo', 'Vuori', 'Gymshark', 'Athleta', 'Sweaty Betty', 'Outdoor Voices',
    'Mammut', 'Salomon', 'Hoka', 'On Running', 'Allbirds', 'Veja',
    'BIRKENSTOCK', 'Teva', 'UGG', 'Crocs', 'Converse', 'Vans',
    'Polo Ralph Lauren', 'Tommy Hilfiger', 'Calvin Klein', 'Lacoste',
    'Vineyard Vines', 'Peter Millar', 'Tommy Bahama', 'TravisMatthew',
    'Rhone', 'Mac Weldon', 'Bonobos', 'Untuckit',
  ];

  const candidates = [];

  for (const product of products) {
    if (!product.product_title || !product.product_id) continue;

    const titleLower = product.product_title.toLowerCase();
    const retailerLower = (product.store_name || '').toLowerCase();
    const combinedText = `${titleLower} ${retailerLower}`;

    if (blocklist.some(word => titleLower.includes(word))) continue;

    if (relevanceRequired.length > 0 && !relevanceRequired.some(kw => combinedText.includes(kw))) continue;

    if (!TRUSTED_BRANDS.includes(brandName) && relevanceRequired.length === 0 && AMBIGUOUS_BRANDS.includes(brandName)) {
      const brandWords = brandName.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(' ')
        .filter(w => w.length > 2);
      const brandAppears = brandWords.some(word => combinedText.includes(word));
      if (!brandAppears) continue;
    }

    // Only care about products the /search summary already marks on-sale
    if (!product.on_sale) continue;

    const discountPercent = parsePercentOff(product.discount_percent);
    if (!discountPercent || discountPercent < 10) continue;

    candidates.push({ product, discountPercent });
  }

  // Highest discount first, then cap to keep API usage bounded
  candidates.sort((a, b) => b.discountPercent - a.discountPercent);
  return candidates.slice(0, perBrandCap).map(c => c.product);
}

// STEP 2 of normalization: for each candidate, fetch its real offers and
// pick the best on-sale one with a direct retailer URL.
async function normalizeDeals(products, brandName, perBrandCap) {
  console.log(`📝 Normalizing ${products.length} products for ${brandName}...`);

  const candidates = filterCandidateProducts(products, brandName, perBrandCap);
  console.log(`   ${candidates.length} candidate(s) worth checking for real offers`);

  const deals = [];

  // Fetch offer details in small concurrent batches instead of one at a time.
  // Sequential fetching (with a delay after each) was the main cause of runs
  // taking hours — we saw no 429/rate-limit errors even at full volume, so
  // there's real room to parallelize safely. If 429s start appearing in the
  // logs after this change, lower BATCH_SIZE back down.
  const BATCH_SIZE = 4;
  const productOfferPairs = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (product) => {
        const offers = await fetchOffersForProduct(product.product_id);
        return { product, offers };
      })
    );
    productOfferPairs.push(...batchResults);

    // Brief pause between batches (not between every single call)
    if (i + BATCH_SIZE < candidates.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Process each fetched result — this part is pure local logic, no network
  // calls, so it doesn't need to be batched/delayed at all.
  for (const { product, offers } of productOfferPairs) {
    if (!offers || offers.length === 0) continue;

    // Exclude marketplace/reseller offers (eBay, Poshmark, StockX, etc.) —
    // these aren't authorized retailers and their pricing isn't reliable
    // "sale" pricing the way a brand's own site or an authorized reseller is.
    const legitOffers = offers.filter(o => {
      const store = (o.store_name || '').toLowerCase();
      return o.offer_page_url && !MARKETPLACE_RESELLER_BLOCKLIST.some(bad => store.includes(bad));
    });

    if (legitOffers.length === 0) continue;

    // Best offer selection, in priority order:
    // 1. An offer the API itself flags as "Best price"
    // 2. The lowest-priced on-sale offer
    // 3. The lowest-priced offer overall (fallback, rare)
    const onSaleOffers = legitOffers.filter(o => o.on_sale);
    const badgedBest = legitOffers.find(o => (o.offer_badge || '').toLowerCase().includes('best price'));

    let bestOffer;
    if (badgedBest) {
      bestOffer = badgedBest;
    } else if (onSaleOffers.length > 0) {
      bestOffer = onSaleOffers.reduce((lowest, o) => {
        const p = parsePrice(o.price);
        const lowestP = parsePrice(lowest.price);
        return (p !== null && (lowestP === null || p < lowestP)) ? o : lowest;
      });
    } else {
      continue; // no on-sale, non-badged offer — skip rather than guess
    }

    const currentPrice = parsePrice(bestOffer.price);
    if (!currentPrice || currentPrice < 1) continue;

    // Only trust a REAL original_price from the offer. If it's missing,
    // we don't fabricate a discount — that would show users a fake number.
    const originalPrice = parsePrice(bestOffer.original_price);
    if (!originalPrice || originalPrice <= currentPrice) continue;

    const discountPercent = parsePercentOff(bestOffer.percent_off)
      || Math.round(((originalPrice - currentPrice) / originalPrice) * 100);

    if (discountPercent < 10) continue;

    const cleanBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = product.product_title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
    const uniqueId = `${cleanBrand}-${cleanTitle}-${Math.round(currentPrice * 100)}`;

    deals.push({
      id: uniqueId,
      brand: brandName,
      // Always use the clean product-level title for display — offer_title
      // is often a messy SKU string like "...Shoes in Black, Size: 8 | DZ4857-001"
      product: product.product_title,
      salePrice: Math.round(currentPrice * 100) / 100,
      originalPrice: Math.round(originalPrice * 100) / 100,
      discount: `${discountPercent}%`,
      link: bestOffer.offer_page_url,
      image: product.product_photos?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
      retailer: bestOffer.store_name || 'Online',
      rating: product.product_rating || null,
      reviewCount: product.product_num_reviews || null,
      gender: detectGender(product.product_title, brandName),
      lastUpdated: new Date().toISOString(),
      fetchedAt: new Date().toISOString()
    });
  }

  deals.sort((a, b) => parseInt(b.discount) - parseInt(a.discount));
  const topDeals = deals.slice(0, 20);

  console.log(`   ✅ ${topDeals.length} valid deals with real retailer links`);

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

    // Firestore batches are capped at 500 operations — chunk deletes
    // so a large backlog doesn't fail the whole operation.
    const docs = oldDeals.docs;
    const CHUNK_SIZE = 450; // margin under the 500 limit
    let deletedCount = 0;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deletedCount += chunk.length;
    }
    
    console.log(`🗑️  Cleaned ${deletedCount} old deals`);
  } catch (error) {
    console.log('⚠️  Could not clean old deals:', error.message);
  }
}

// ── Resume support ────────────────────────────────────────────
// A full fetch now takes 40-60+ minutes. Any Railway restart (a deploy,
// a manual restart, infra maintenance) sends SIGTERM and kills the
// process mid-run. Without this, every interruption meant starting
// over from brand 1, wasting whatever API calls were already spent.
// This tracks progress in Firestore so an interrupted run resumes
// instead of restarting.
const RESUME_STALE_AFTER_HOURS = 24; // abandon very old partial runs, start fresh instead

async function getResumeState() {
  try {
    const db = getFirestore();
    const doc = await db.collection('system').doc('fetch_progress').get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (!data.runStartedAt || typeof data.lastCompletedBrandIndex !== 'number') return null;

    const hoursSinceStart = (Date.now() - new Date(data.runStartedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceStart > RESUME_STALE_AFTER_HOURS) {
      console.log(`   (found a stale partial run from ${hoursSinceStart.toFixed(1)}h ago — starting fresh instead of resuming)`);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error checking resume state:', error.message);
    return null;
  }
}

async function saveProgress(runStartedAt, brandIndex, totalDeals, successfulBrands) {
  try {
    const db = getFirestore();
    await db.collection('system').doc('fetch_progress').set({
      runStartedAt,
      lastCompletedBrandIndex: brandIndex,
      totalDeals,
      successfulBrands
    });
  } catch (error) {
    console.error('Error saving progress:', error.message);
  }
}

async function clearProgress() {
  try {
    const db = getFirestore();
    await db.collection('system').doc('fetch_progress').delete();
  } catch (error) {
    console.error('Error clearing progress:', error.message);
  }
}

async function fetchAndStoreDeals() {
  console.log('🚀 Starting deal fetch...\n');
  const startTime = Date.now();

  const activeBrands = await getActiveBrandList();

  // Fetch once per run (not per brand) — this is a Firestore read, not an
  // API call, so it doesn't affect RapidAPI budget. Determines which brands
  // get deep checking (FOLLOWED_BRAND_CAP) vs a light baseline check
  // (UNFOLLOWED_BRAND_CAP). Falls back to empty (= everyone unfollowed-tier)
  // if this fails for any reason, so a Firestore hiccup can't crash the run.
  const followedCounts = await getFollowedBrandCounts();
  const followedBrandNames = Object.keys(followedCounts).filter(name => followedCounts[name] > 0);
  console.log(`📊 ${followedBrandNames.length} brand(s) are followed by at least one user — those get deeper checking this run\n`);

  // Check for an interrupted previous run to resume instead of restarting
  const resumeState = await getResumeState();

  let startIndex = 0;
  let totalDeals = 0;
  let successfulBrands = 0;
  let runStartedAt = new Date().toISOString();

  if (resumeState) {
    startIndex = resumeState.lastCompletedBrandIndex + 1;
    totalDeals = resumeState.totalDeals || 0;
    successfulBrands = resumeState.successfulBrands || 0;
    runStartedAt = resumeState.runStartedAt;
    console.log(`▶️  Resuming interrupted run from brand ${startIndex + 1}/${activeBrands.length} (started ${runStartedAt})`);
  } else {
    // Only clean old deals at the start of a genuinely NEW run —
    // not on every resume, to avoid redundant Firestore work.
    await cleanOldDeals();
    console.log('');
  }

  if (startIndex >= activeBrands.length) {
    console.log('✅ Resumed run was already complete — nothing left to do');
    await clearProgress();
    return {
      totalDeals,
      successfulBrands,
      failedBrands: activeBrands.length - successfulBrands,
      duration: '0s',
      timestamp: new Date().toISOString()
    };
  }

  for (let i = startIndex; i < activeBrands.length; i++) {
    const brandName = activeBrands[i];
    const isFollowed = (followedCounts[brandName] || 0) > 0;
    const perBrandCap = isFollowed ? FOLLOWED_BRAND_CAP : UNFOLLOWED_BRAND_CAP;
    console.log(`📦 Processing brand ${i + 1}/${activeBrands.length}: ${brandName} (${isFollowed ? 'followed' : 'not yet followed'}, checking up to ${perBrandCap})`);

    try {
      const products = await searchDealsForBrand(brandName);
      const deals = await normalizeDeals(products, brandName, perBrandCap);

      if (deals.length > 0) {
        await storeDealsInFirestore(deals, brandName);
        totalDeals += deals.length;
      }
      successfulBrands++;
    } catch (error) {
      console.error(`❌ Failed: ${brandName} - ${error.message}`);
    }

    // Save progress after every brand so an interruption can resume here
    await saveProgress(runStartedAt, i, totalDeals, successfulBrands);

    // Wait between brands to stay within RapidAPI rate limits
    if (i < activeBrands.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Full run completed — clear the resume marker so the next run starts fresh
  await clearProgress();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('='.repeat(50));
  console.log(`✅ COMPLETE`);
  console.log(`   Deals: ${totalDeals}`);
  console.log(`   Brands: ${successfulBrands}/${activeBrands.length}`);
  console.log(`   Time: ${duration}s (${(duration / 60).toFixed(1)} minutes)`);
  console.log('='.repeat(50));

  return {
    totalDeals,
    successfulBrands,
    failedBrands: activeBrands.length - successfulBrands,
    duration: `${duration}s`,
    timestamp: new Date().toISOString()
  };
}

// ── Run guard ──────────────────────────────────────────────────
// Prevents fetchAndStoreDeals from running more than once every
// MIN_HOURS_BETWEEN_FETCHES hours, no matter what triggers it —
// cron, a Railway restart, or a redeploy. This is what actually
// enforces "every ~3 days" rather than relying on cron timing alone,
// since Railway restarts (deploys, crashes, infra maintenance) can
// otherwise trigger extra full-cost fetches outside the schedule.
const MIN_HOURS_BETWEEN_FETCHES = 71; // just under 72h so the daily cron check reliably triggers it

async function shouldRunFetch() {
  try {
    const db = getFirestore();
    const statusDoc = await db.collection('system').doc('fetch_status').get();
    if (!statusDoc.exists) return true;

    const lastCompletedAt = statusDoc.data().lastCompletedAt;
    if (!lastCompletedAt) return true;

    const hoursSince = (Date.now() - new Date(lastCompletedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < MIN_HOURS_BETWEEN_FETCHES) {
      console.log(`⏭️  Skipping fetch — last one completed ${hoursSince.toFixed(1)}h ago (minimum: ${MIN_HOURS_BETWEEN_FETCHES}h)`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking fetch guard, allowing fetch to proceed:', error.message);
    return true; // fail open — better to run than to silently never run due to a Firestore hiccup
  }
}

async function markFetchCompleted() {
  try {
    const db = getFirestore();
    await db.collection('system').doc('fetch_status').set({
      lastCompletedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('Error marking fetch completed:', error.message);
  }
}

// This is what cron.js and the startup block should call — it's the
// guarded, budget-safe entry point. fetchAndStoreDeals() itself is left
// unguarded and unchanged so manual-trigger.html and TEST_BRAND_LIMIT
// testing can still force an immediate run when you genuinely want one.
async function runScheduledFetch() {
  const allowed = await shouldRunFetch();
  if (!allowed) {
    return { skipped: true, reason: 'ran too recently' };
  }
  const result = await fetchAndStoreDeals();
  await markFetchCompleted();
  return result;
}

module.exports = {
  fetchAndStoreDeals,
  runScheduledFetch,
  searchDealsForBrand,
  normalizeDeals
};
