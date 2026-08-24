/**
 * WebScrapper Configuration
 * 
 * Optional paid API integrations for better results.
 * Free mode uses Nominatim + web scraping (limited but functional).
 * Paid APIs provide richer data including emails from Google Maps listings.
 */

module.exports = {
  // ============================================
  // SEARCH ENGINES (choose one or combine)
  // ============================================
  
  engines: {
    // FREE: OpenStreetMap/Nominatim - basic GIS data
    nominatim: {
      enabled: true,
      rateLimit: 1000  // ms between requests (respect their policy)
    },
    
    // FREE: Web scraping via search engines
    webSearch: {
      enabled: true,
      provider: 'bing',  // 'bing' or 'duckduckgo' (ddg often blocked)
      rateLimit: 800
    },
    
    // PAID: SerpAPI - $50/month for 5000 searches
    // Get API key at: https://serpapi.com/
    serpApi: {
      enabled: false,
      apiKey: process.env.SERPAPI_KEY || '',
      // Google Maps search provides: name, address, phone, website, rating
      // Does NOT include email directly - need website enrichment
      endpoint: 'https://serpapi.com/search',
      rateLimit: 500
    },
    
    // PAID: Apify Google Maps Scraper - $1.50 per 1000 places
    // Best option for getting emails (includes website enrichment)
    // Get API key at: https://console.apify.com/settings/integrations
    apify: {
      enabled: false,
      apiKey: process.env.APIFY_KEY || '',
      actorId: 'compass/crawler-google-places',
      // Options for Apify scraper
      options: {
        scrapeContacts: true,        // Extract email from websites
        maxCrawledPlaces: 50,        // Places per search
        language: 'en'
      }
    }
  },
  
  // ============================================
  // ENRICHMENT OPTIONS
  // ============================================
  
  enrichment: {
    // Always scrape discovered websites for contact info
    websiteScraping: {
      enabled: true,
      timeout: 8000,
      followContactPages: true
    },
    
    // Skip enrichment for these domains (they don't have actual business emails)
    skipDomains: [
      'yelp.com',
      'yellowpages.com', 
      'facebook.com',
      'tripadvisor.com',
      'google.com/maps',
      'bbb.org'
    ]
  },
  
  // ============================================
  // RATE LIMITING & POLITENESS
  // ============================================
  
  limits: {
    maxLeadsPerSearch: 100,
    maxCitiesPerSearch: 5,
    delayBetweenRequests: 800,      // ms
    delayBetweenCities: 2000,       // ms
    requestTimeout: 15000           // ms
  },
  
  // ============================================
  // OUTPUT OPTIONS
  // ============================================
  
  output: {
    includeEmptyFields: false,      // Include NA fields in output
    deduplication: true,            // Merge duplicate businesses
    sortBy: 'name'                  // 'name', 'city', or 'sources'
  }
};

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. FREE MODE (default):
 *    - Uses Nominatim (OpenStreetMap) for GIS data
 *    - Uses Bing web search for additional results
 *    - Scrapes discovered websites for emails/phones
 *    - Limitation: Web search can be blocked by corporate proxies
 * 
 * 2. SERPAPI ($50/month):
 *    - Set: engines.serpApi.enabled = true
 *    - Set: SERPAPI_KEY environment variable
 *    - Benefits: Reliable Google Maps data, not blocked
 *    - Note: Still needs website enrichment for emails
 * 
 * 3. APIFY ($1.50/1000 places):
 *    - Set: engines.apify.enabled = true
 *    - Set: APIFY_KEY environment variable
 *    - Benefits: Best email extraction (scrapes websites automatically)
 *    - Includes company contacts enrichment addon
 * 
 * FACEBOOK/GOOGLE DIRECT SCRAPING:
 *    - Facebook: NOT POSSIBLE - blocked and against TOS
 *    - Google Maps: Use SerpAPI or Apify (direct scraping blocked)
 */
