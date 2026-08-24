/**
 * Paid API Integrations for Enhanced Business Data
 * 
 * These engines provide better data quality and reliability than free web scraping.
 * Enable them by setting API keys in config.js or environment variables.
 */

const axios = require('axios');
const https = require('https');
const config = require('./config');

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

/**
 * SerpAPI Google Maps Search
 * Returns: name, address, phone, website, rating, reviews
 * Does NOT return: email (need website enrichment)
 * 
 * Cost: ~$0.01 per search (included in $50/month plan)
 * Docs: https://serpapi.com/google-maps-api
 */
async function searchSerpApi(keyword, target) {
  const leads = [];
  
  if (!config.engines.serpApi.enabled || !config.engines.serpApi.apiKey) {
    console.log('[SERPAPI] Disabled or no API key');
    return leads;
  }
  
  const location = [target.city, target.region].filter(Boolean).join(', ');
  
  try {
    console.log(`[SERPAPI] Searching: ${keyword} in ${location}`);
    
    const params = new URLSearchParams({
      api_key: config.engines.serpApi.apiKey,
      engine: 'google_maps',
      q: keyword,
      location: location,
      hl: 'en',
      type: 'search'
    });
    
    const res = await axiosInstance.get(`${config.engines.serpApi.endpoint}?${params}`, {
      timeout: 20000
    });
    
    if (res.data && res.data.local_results) {
      for (const place of res.data.local_results) {
        leads.push({
          id: `serpapi-${place.place_id || Math.random().toString(36).slice(2)}`,
          name: place.title || 'Unknown',
          location: place.address || location,
          city: target.city || '',
          zipcode: target.zipcode || '',
          phone: place.phone || 'NA',
          email: 'NA',  // SerpAPI doesn't provide email
          website: place.website || 'NA',
          rating: place.rating || null,
          reviews: place.reviews || null,
          sources: ['SerpAPI Google Maps'],
          socials: { facebook: 'NA', instagram: 'NA', tiktok: 'NA' }
        });
      }
    }
    
    console.log(`[SERPAPI] Found ${leads.length} places`);
    
  } catch (e) {
    console.log(`[SERPAPI] Error: ${e.message}`);
    if (e.response?.status === 401) {
      console.log('[SERPAPI] Invalid API key - check your SERPAPI_KEY');
    }
  }
  
  return leads;
}

/**
 * Apify Google Maps Scraper
 * Returns: name, address, phone, website, email (via enrichment), social profiles
 * 
 * Cost: $1.50 per 1000 places (with contact enrichment addon)
 * Docs: https://apify.com/compass/crawler-google-places
 */
async function searchApify(keyword, target) {
  const leads = [];
  
  if (!config.engines.apify.enabled || !config.engines.apify.apiKey) {
    console.log('[APIFY] Disabled or no API key');
    return leads;
  }
  
  const location = [target.city, target.region].filter(Boolean).join(', ');
  
  try {
    console.log(`[APIFY] Starting actor for: ${keyword} in ${location}`);
    
    // Start the actor run
    const runRes = await axiosInstance.post(
      `https://api.apify.com/v2/acts/${config.engines.apify.actorId}/runs`,
      {
        searchStringsArray: [keyword],
        locationQuery: location,
        maxCrawledPlacesPerSearch: config.engines.apify.options.maxCrawledPlaces || 50,
        language: config.engines.apify.options.language || 'en',
        scrapeContacts: config.engines.apify.options.scrapeContacts || true
      },
      {
        headers: {
          'Authorization': `Bearer ${config.engines.apify.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    const runId = runRes.data?.data?.id;
    if (!runId) {
      console.log('[APIFY] Failed to start actor run');
      return leads;
    }
    
    console.log(`[APIFY] Run started: ${runId}`);
    
    // Poll for completion (max 5 minutes)
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 60;
    
    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
      
      const statusRes = await axiosInstance.get(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        {
          headers: { 'Authorization': `Bearer ${config.engines.apify.apiKey}` }
        }
      );
      
      status = statusRes.data?.data?.status;
      attempts++;
      
      if (attempts % 6 === 0) {
        console.log(`[APIFY] Still running... (${attempts * 5}s)`);
      }
    }
    
    if (status !== 'SUCCEEDED') {
      console.log(`[APIFY] Run ended with status: ${status}`);
      return leads;
    }
    
    // Fetch results from dataset
    const datasetId = runRes.data?.data?.defaultDatasetId;
    if (!datasetId) {
      console.log('[APIFY] No dataset ID found');
      return leads;
    }
    
    const dataRes = await axiosInstance.get(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: { 'Authorization': `Bearer ${config.engines.apify.apiKey}` }
      }
    );
    
    if (dataRes.data && Array.isArray(dataRes.data)) {
      for (const place of dataRes.data) {
        // Extract email from website scraping results
        let email = 'NA';
        if (place.emails && place.emails.length > 0) {
          email = place.emails[0];
        } else if (place.contactInfo?.email) {
          email = place.contactInfo.email;
        }
        
        leads.push({
          id: `apify-${place.placeId || Math.random().toString(36).slice(2)}`,
          name: place.title || 'Unknown',
          location: place.address || location,
          city: place.city || target.city || '',
          zipcode: place.postalCode || target.zipcode || '',
          phone: place.phone || 'NA',
          email: email,
          website: place.website || 'NA',
          rating: place.totalScore || null,
          reviews: place.reviewsCount || null,
          sources: ['Apify Google Maps'],
          socials: {
            facebook: place.facebooks?.[0] || 'NA',
            instagram: place.instagrams?.[0] || 'NA',
            tiktok: place.tiktoks?.[0] || 'NA'
          }
        });
      }
    }
    
    console.log(`[APIFY] Found ${leads.length} places with contacts`);
    
  } catch (e) {
    console.log(`[APIFY] Error: ${e.message}`);
    if (e.response?.status === 401) {
      console.log('[APIFY] Invalid API key - check your APIFY_KEY');
    }
  }
  
  return leads;
}

/**
 * Check if paid APIs are available
 */
function hasPaidApiEnabled() {
  return (config.engines.serpApi.enabled && config.engines.serpApi.apiKey) ||
         (config.engines.apify.enabled && config.engines.apify.apiKey);
}

module.exports = {
  searchSerpApi,
  searchApify,
  hasPaidApiEnabled
};
