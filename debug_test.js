// One-off diagnostic script — NOT part of the app, just for debugging.
// Run with: node debug_test.js
// Prints the raw first product from the API as a single line of JSON
// so nothing gets cut off by Railway's log filter.

const axios = require('axios');

async function main() {
  const options = {
    method: 'GET',
    url: `https://${process.env.RAPIDAPI_HOST}/search`,
    params: {
      q: 'Nike',
      country: 'us',
      language: 'en',
      page: '1',
      limit: '3',
      sort_by: 'BEST_MATCH',
      product_condition: 'ANY'
    },
    headers: {
      'x-rapidapi-host': process.env.RAPIDAPI_HOST,
      'x-rapidapi-key': process.env.RAPIDAPI_KEY
    }
  };

  try {
    console.log('HOST:', process.env.RAPIDAPI_HOST);
    const response = await axios.request(options);
    const products = response.data?.data?.products || [];
    console.log('TOTAL_PRODUCTS:', products.length);

    if (products.length > 0) {
      console.log('TOP_LEVEL_KEYS:', Object.keys(products[0]).join(', '));
      console.log('RAW_JSON_START');
      console.log(JSON.stringify(products[0]));
      console.log('RAW_JSON_END');
    } else {
      console.log('NO_PRODUCTS_RETURNED');
      console.log('FULL_RESPONSE_START');
      console.log(JSON.stringify(response.data));
      console.log('FULL_RESPONSE_END');
    }
  } catch (err) {
    console.error('ERROR_MESSAGE:', err.message);
    if (err.response) {
      console.error('ERROR_STATUS:', err.response.status);
      console.error('ERROR_DATA:', JSON.stringify(err.response.data));
    }
  }
}

main();
