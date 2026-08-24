/**
 * Multi-Platform Concatenator & Deep Research Engine
 * Queries and concatenates business records across Overpass GIS, Search Snippets, Directories, and Maps.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { URL } = require('url');
const { mergeAndConcatenateLeads } = require('./entityMerger');

// Optional: Load paid engines if available
let paidEngines = null;
try {
  paidEngines = require('./paidEngines');
} catch (e) {
  // Paid engines not configured
}

// Create axios instance that ignores SSL certificate errors (for corporate proxies)
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/gi;
// Stricter phone regex: must have area code pattern, not coordinates
const PHONE_REGEX = /(?:(?:\+1|1)?[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const GENERIC_EMAIL_PREFIXES = new Set([
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'example', 'test', 'sample', 'admin', 'support'
]);

function defaultDetails() {
  return { email: 'NA', phone: 'NA', socials: { facebook: 'NA', instagram: 'NA', tiktok: 'NA' } };
}

function sanitize(str) {
  if (!str) return "NA";
  const cleaned = str.trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : "NA";
}

function normalizeUrl(rawUrl, baseUrl = null) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    if (baseUrl) return new URL(rawUrl, baseUrl).toString();
    return new URL(rawUrl).toString();
  } catch (_) {
    return null;
  }
}

function decodeDuckDuckGoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return 'NA';
  const normalized = normalizeUrl(rawUrl, 'https://duckduckgo.com');
  if (!normalized) return 'NA';

  try {
    const parsed = new URL(normalized);
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) {
      const decoded = decodeURIComponent(uddg);
      return normalizeUrl(decoded) || 'NA';
    }
    return normalized;
  } catch (_) {
    return 'NA';
  }
}

/**
 * Decode Bing tracking URLs to get actual destination
 * Bing uses base64 encoding with 'a1' prefix
 */
function decodeBingUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return 'NA';
  
  try {
    // Check if it's a Bing tracking URL
    if (rawUrl.includes('bing.com/ck/a')) {
      const parsed = new URL(rawUrl);
      const encodedUrl = parsed.searchParams.get('u');
      if (encodedUrl) {
        let decoded = encodedUrl;
        // Remove 'a1' prefix if present
        if (decoded.startsWith('a1')) {
          decoded = decoded.substring(2);
        }
        // Decode base64
        try {
          decoded = Buffer.from(decoded, 'base64').toString('utf-8');
        } catch (_) {
          // If base64 fails, try URL decode
          decoded = decodeURIComponent(decoded);
        }
        return decoded.startsWith('http') ? decoded : 'NA';
      }
    }
    // Regular URL
    return rawUrl.startsWith('http') ? rawUrl : 'NA';
  } catch (_) {
    return rawUrl.startsWith('http') ? rawUrl : 'NA';
  }
}

function isLikelyValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) return false;
  if (trimmed.includes('..')) return false;
  const [local, domain] = trimmed.split('@');
  if (!local || !domain || !domain.includes('.')) return false;
  if (GENERIC_EMAIL_PREFIXES.has(local)) return false;
  if (/\d{4,}$/.test(local)) return false;
  if (/(example|invalid|domain\.com)$/.test(domain)) return false;
  return true;
}

function normalizePhoneCandidate(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  // Must be 10-11 digits (US format, with or without country code)
  if (digits.length < 10 || digits.length > 11) return null;
  // First digit of area code must be 2-9 (not 0 or 1)
  const areaCodeStart = digits.length === 11 ? 1 : 0;
  if (digits[areaCodeStart] === '0' || digits[areaCodeStart] === '1') return null;
  // Format as (XXX) XXX-XXXX
  const normalized = digits.slice(-10);
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function pickBestEmail(candidates, siteHost = '') {
  if (!Array.isArray(candidates) || candidates.length === 0) return 'NA';
  const cleaned = [...new Set(candidates.map(e => e.toLowerCase().trim()))].filter(isLikelyValidEmail);
  if (cleaned.length === 0) return 'NA';

  if (siteHost) {
    const hostMatch = cleaned.find(e => e.split('@')[1] === siteHost.replace(/^www\./, ''));
    if (hostMatch) return hostMatch;
  }

  const preferred = cleaned.find(e => /^(info|contact|sales|hello|support)@/.test(e));
  return preferred || cleaned[0];
}

function extractEmail(htmlText) {
  if (!htmlText) return "NA";
  const matches = htmlText.match(EMAIL_REGEX);
  if (matches && matches.length > 0) {
    const valid = matches
      .map(e => e.toLowerCase().trim())
      .filter(e => !e.match(/\.(png|jpg|jpeg|gif|svg|css|js)$/i))
      .filter(isLikelyValidEmail);
    if (valid.length > 0) return valid[0].toLowerCase();
  }
  return "NA";
}

function extractPhone(text) {
  if (!text) return "NA";
  const matches = text.match(PHONE_REGEX);
  if (matches && matches.length > 0) {
    const valid = matches.map(normalizePhoneCandidate).find(Boolean);
    if (valid) return valid.trim();
  }
  return "NA";
}

function collectSocials($, baseUrl) {
  let facebook = 'NA';
  let instagram = 'NA';
  let tiktok = 'NA';

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const resolved = normalizeUrl(href, baseUrl);
    if (!resolved) return;
    if (resolved.includes('facebook.com') && facebook === 'NA') facebook = resolved;
    if (resolved.includes('instagram.com') && instagram === 'NA') instagram = resolved;
    if (resolved.includes('tiktok.com') && tiktok === 'NA') tiktok = resolved;
  });

  return { facebook, instagram, tiktok };
}

function collectContactPageCandidates($, baseUrl) {
  const candidates = [];
  const keywords = ['contact', 'about', 'support', 'customer-service', 'locations'];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const lower = href.toLowerCase();
    if (!keywords.some(k => lower.includes(k))) return;
    const resolved = normalizeUrl(href, baseUrl);
    if (resolved && !candidates.includes(resolved)) candidates.push(resolved);
  });

  return candidates.slice(0, 4);
}

async function fetchPage(url) {
  const response = await axiosInstance.get(url, {
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  return response.data;
}

async function extractDetailsFromPage(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const bodyText = $('body').text();
  const pageHost = new URL(url).hostname.replace(/^www\./, '');

  const emailCandidates = [];
  const directEmail = extractEmail(html);
  if (directEmail !== 'NA') emailCandidates.push(directEmail);

  $('a[href^="mailto:"]').each((_, el) => {
    const mailto = ($(el).attr('href') || '').replace('mailto:', '').split('?')[0].trim().toLowerCase();
    if (mailto) emailCandidates.push(mailto);
  });

  const phoneCandidates = [];
  const directPhone = extractPhone(bodyText);
  if (directPhone !== 'NA') phoneCandidates.push(directPhone);

  $('a[href^="tel:"]').each((_, el) => {
    const tel = ($(el).attr('href') || '').replace('tel:', '').trim();
    const normalized = normalizePhoneCandidate(tel);
    if (normalized) phoneCandidates.push(normalized);
  });

  return {
    email: pickBestEmail(emailCandidates, pageHost),
    phone: phoneCandidates.length ? phoneCandidates[0] : 'NA',
    socials: collectSocials($, url),
    contactPages: collectContactPageCandidates($, url)
  };
}

// Scrape deep contact info from website
async function scrapeWebsiteDetails(websiteUrl) {
  if (!websiteUrl || websiteUrl === "NA" || !websiteUrl.startsWith('http')) {
    return defaultDetails();
  }

  try {
    const rootDetails = await extractDetailsFromPage(websiteUrl);

    let bestEmail = rootDetails.email;
    let bestPhone = rootDetails.phone;
    const socials = {
      facebook: sanitize(rootDetails.socials.facebook),
      instagram: sanitize(rootDetails.socials.instagram),
      tiktok: sanitize(rootDetails.socials.tiktok)
    };

    if (bestEmail === 'NA' || bestPhone === 'NA') {
      for (const pageUrl of rootDetails.contactPages) {
        try {
          const details = await extractDetailsFromPage(pageUrl);
          if (bestEmail === 'NA' && details.email !== 'NA') bestEmail = details.email;
          if (bestPhone === 'NA' && details.phone !== 'NA') bestPhone = details.phone;
          if (socials.facebook === 'NA' && details.socials.facebook !== 'NA') socials.facebook = details.socials.facebook;
          if (socials.instagram === 'NA' && details.socials.instagram !== 'NA') socials.instagram = details.socials.instagram;
          if (socials.tiktok === 'NA' && details.socials.tiktok !== 'NA') socials.tiktok = details.socials.tiktok;
          if (bestEmail !== 'NA' && bestPhone !== 'NA') break;
        } catch (_) {
          // Ignore bad contact pages and continue.
        }
      }
    }

    return {
      email: sanitize(bestEmail),
      phone: sanitize(bestPhone),
      socials
    };
  } catch (err) {
    return defaultDetails();
  }
}

/**
 * ENGINE 1: Overpass GIS API Search (Extracts exact mapped nodes, shop coordinates, and tags)
 */
async function searchOverpassGIS(keyword, target) {
  const leads = [];
  const seenNames = new Set();
  
  try {
    // Build search query - use city and state
    const locationParts = [target.city, target.region].filter(Boolean);
    const searchQuery = `${keyword} ${locationParts.join(' ')}`.trim();
    
    // Nominatim search
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&extratags=1&limit=20`;
    
    console.log(`[GIS] Querying: ${searchQuery}`);
    
    const res = await axiosInstance.get(nomUrl, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'WebScrapperTest/1.0',
        'Accept': 'application/json'
      }
    });

    console.log(`[GIS] Got ${res.data?.length || 0} results`);

    if (res.data && Array.isArray(res.data)) {
      for (const place of res.data) {
        const tags = place.extratags || {};
        const addr = place.address || {};
        const house = addr.house_number || "";
        const road = addr.road || addr.pedestrian || "";
        const city = addr.city || addr.town || addr.village || target.city;
        const postcode = addr.postcode || target.zipcode || '';
        const state = addr.state || target.region;

        // Get name from multiple possible sources
        const name = place.name || tags.name || place.namedetails?.name || place.display_name.split(',')[0] || keyword;
        
        // Skip duplicates by name
        const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seenNames.has(normName)) continue;
        seenNames.add(normName);
        
        const fullAddr = `${house} ${road}, ${city}, ${state} ${postcode}`.trim().replace(/^,\s*/, '').replace(/,\s*,/g, ',');
        const phone = tags.phone || tags['contact:phone'] || "NA";
        const email = tags.email || tags['contact:email'] || "NA";
        const website = tags.website || tags['contact:website'] || "NA";

        leads.push({
          id: `osm-${place.place_id}`,
          name: sanitize(name),
          location: sanitize(fullAddr.length > 6 ? fullAddr : place.display_name),
          city: sanitize(city),
          zipcode: sanitize(postcode),
          phone: sanitize(phone),
          email: sanitize(email),
          website: sanitize(website),
          sources: ["OpenStreetMap GIS"],
          socials: { facebook: "NA", instagram: "NA", tiktok: "NA" }
        });
      }
    }
  } catch (e) {
    console.log(`[GIS] Error: ${e.message}`);
  }
  return leads;
}

// Domains to exclude from results (generic info sites, not businesses)
const EXCLUDED_DOMAINS = [
  'wikipedia.org', 'britannica.com', 'dictionary.com', 'merriam-webster.com',
  'reddit.com', 'quora.com', 'pinterest.com', 'twitter.com', 'x.com',
  'youtube.com', 'tiktok.com', 'amazon.com', 'ebay.com', 'etsy.com',
  'news.google.com', 'crazygames.com', 'tripadvisor.com/Tourism',
  'thehindu.com', 'hinduismtoday.com', 'history.com', 'hinduismfacts.org',
  'bbc.com', 'cnn.com', 'nytimes.com', 'washingtonpost.com',
  'learnenglish.britishcouncil.org', 'khanacademy.org', 'coursera.org',
  'about.com', 'thoughtco.com', 'livescience.com', 'nationalgeographic.com',
  'smithsonianmag.com', 'pbs.org', 'howstuffworks.com'
];

/**
 * Keyword-based directory detection
 * Returns relevant directory domains to search for specific business types
 */
function getKeywordDirectories(keyword) {
  const keywordLower = keyword.toLowerCase();
  const directories = [];
  
  // Religious/Spiritual
  if (/gurdwara|gurudwara|sikh/i.test(keywordLower)) {
    directories.push('sikhscholarhub.com', 'gurdwaras.com', 'worldgurudwaras.com');
  }
  if (/temple|hindu|mandir/i.test(keywordLower)) {
    directories.push('hindutempleofamerica.com', 'templedirectory.com');
  }
  if (/mosque|masjid|islamic/i.test(keywordLower)) {
    directories.push('islamicfinder.org', 'salatomatic.com');
  }
  if (/church|christian/i.test(keywordLower)) {
    directories.push('churchfinder.com', 'usachurches.org');
  }
  if (/synagogue|jewish/i.test(keywordLower)) {
    directories.push('jewishfederations.org', 'synagoguedirectory.com');
  }
  
  // Food & Dining
  if (/restaurant|food|cafe|diner|bistro|eatery/i.test(keywordLower)) {
    directories.push('yelp.com', 'opentable.com', 'tripadvisor.com');
  }
  if (/pizza/i.test(keywordLower)) {
    directories.push('pizzatoday.com');
  }
  if (/indian.*restaurant|indian.*food/i.test(keywordLower)) {
    directories.push('indianrestaurantsus.com');
  }
  
  // Healthcare
  if (/doctor|physician|clinic|medical|healthcare/i.test(keywordLower)) {
    directories.push('healthgrades.com', 'zocdoc.com', 'vitals.com', 'webmd.com/physician-directory');
  }
  if (/dentist|dental/i.test(keywordLower)) {
    directories.push('1800dentist.com', 'asda.org');
  }
  if (/veterinar|vet|animal.hospital/i.test(keywordLower)) {
    directories.push('avma.org', 'vetstreet.com');
  }
  
  // Legal
  if (/lawyer|attorney|law.firm|legal/i.test(keywordLower)) {
    directories.push('avvo.com', 'lawyers.com', 'martindale.com', 'justia.com');
  }
  
  // Real Estate
  if (/realtor|real.estate|property/i.test(keywordLower)) {
    directories.push('realtor.com', 'zillow.com', 'redfin.com');
  }
  
  // Automotive
  if (/mechanic|auto.repair|car.service/i.test(keywordLower)) {
    directories.push('repairpal.com', 'carfax.com');
  }
  if (/car.dealer|auto.dealer/i.test(keywordLower)) {
    directories.push('cars.com', 'autotrader.com', 'cargurus.com');
  }
  
  // Home Services
  if (/plumber|plumbing/i.test(keywordLower)) {
    directories.push('homeadvisor.com', 'angieslist.com', 'thumbtack.com');
  }
  if (/electrician|electrical/i.test(keywordLower)) {
    directories.push('homeadvisor.com', 'angieslist.com');
  }
  if (/contractor|construction|remodel/i.test(keywordLower)) {
    directories.push('houzz.com', 'buildzoom.com', 'homeadvisor.com');
  }
  
  // Beauty & Personal Care
  if (/salon|hair|beauty|spa/i.test(keywordLower)) {
    directories.push('salontoday.com', 'vagaro.com', 'styleseat.com');
  }
  if (/gym|fitness|yoga/i.test(keywordLower)) {
    directories.push('gymsearch.com', 'classpass.com');
  }
  
  // Education
  if (/school|academy|tutor/i.test(keywordLower)) {
    directories.push('greatschools.org', 'niche.com', 'privateschoolreview.com');
  }
  if (/daycare|childcare|preschool/i.test(keywordLower)) {
    directories.push('care.com', 'winnie.com');
  }
  
  // Always include general business directories
  directories.push('yellowpages.com', 'bbb.org', 'manta.com');
  
  return [...new Set(directories)]; // Dedupe
}

/**
 * Get keyword-specific indicators for filtering results
 */
function getKeywordIndicators(keyword) {
  const keywordLower = keyword.toLowerCase();
  const indicators = [];
  
  // Religious
  if (/gurdwara|gurudwara|sikh/i.test(keywordLower)) {
    indicators.push('gurdwara', 'gurudwara', 'sikh', 'singh sabha', 'nanaksar', 'centre', 'sahib');
  }
  if (/temple|hindu|mandir/i.test(keywordLower)) {
    indicators.push('temple', 'mandir', 'hindu', 'cultural center', 'society');
  }
  if (/church/i.test(keywordLower)) {
    indicators.push('church', 'chapel', 'cathedral', 'parish', 'ministry');
  }
  if (/mosque|masjid/i.test(keywordLower)) {
    indicators.push('mosque', 'masjid', 'islamic center', 'muslim');
  }
  
  // Generic business indicators
  indicators.push('contact', 'location', 'address', 'phone', 'email', 'about us');
  
  return indicators;
}

function isExcludedDomain(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return EXCLUDED_DOMAINS.some(domain => lower.includes(domain));
}

function isLikelyBusinessResult(title, url, snippet, keyword) {
  if (!title || !url) return false;
  if (isExcludedDomain(url)) return false;
  
  const titleLower = title.toLowerCase();
  const urlLower = url.toLowerCase();
  const snippetLower = (snippet || '').toLowerCase();
  const keywordLower = keyword.toLowerCase().replace(/s$/, ''); // Remove trailing 's'
  
  // Good indicators - directories, official sites, contact info
  const baseIndicators = [
    'yelp.com', 'yellowpages.com', 'facebook.com', 'google.com/maps',
    '.org', 'contact', 'location', 'address', 'phone', 'email'
  ];
  
  // Add keyword-specific indicators
  const keywordIndicators = getKeywordIndicators(keyword);
  const goodIndicators = [...baseIndicators, ...keywordIndicators];
  
  const hasGoodIndicator = goodIndicators.some(ind => 
    urlLower.includes(ind) || titleLower.includes(ind) || snippetLower.includes(ind)
  );
  
  // Check if title/url contains something related to the keyword
  const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 3);
  const hasKeywordMatch = keywordWords.some(word => 
    titleLower.includes(word) || urlLower.includes(word)
  );
  
  // Check for location indicators (zip code or state)
  const hasLocationIndicator = snippetLower.match(/\d{5}/) || // Zip code
    snippetLower.match(/,\s*[a-z]{2}\s/i); // State abbreviation
  
  return hasGoodIndicator || hasKeywordMatch || hasLocationIndicator;
}

/**
 * Extract potential acronym from a business name
 * "Hindu Temple & Cultural Center" -> "HTCC"
 */
function extractAcronym(name) {
  if (!name || name.length < 5) return null;
  // Get first letter of each significant word
  const words = name.split(/[\s&]+/).filter(w => w.length > 2 && !/^(the|and|of|in|at|for)$/i.test(w));
  if (words.length < 2) return null;
  const acronym = words.map(w => w[0].toUpperCase()).join('');
  return acronym.length >= 2 && acronym.length <= 6 ? acronym : null;
}

/**
 * ENGINE 2: Intelligent Business Search via Bing
 * Uses multiple search strategies to find actual businesses
 */
async function searchEngineSnippets(keyword, target, gisNames = []) {
  const leads = [];
  const locationParts = [target.city, target.region].filter(Boolean);
  const location = locationParts.join(' ');
  const city = target.city || '';
  
  // Build smart queries - focus on finding actual business listings
  const queries = [];
  
  // For each GIS name, try both full name and acronym searches
  for (const name of gisNames.slice(0, 2)) {
    const acronym = extractAcronym(name);
    if (acronym) {
      queries.push(`${acronym} ${city} ${keyword}`);
    }
    queries.push(`"${name}" ${city} contact`);
  }
  
  // Focused queries for finding actual businesses
  queries.push(`${keyword} ${city} ${target.region || ''} address phone`);
  queries.push(`${keyword} near ${city} official website`);
  
  // Add keyword-specific directory searches
  const directories = getKeywordDirectories(keyword);
  for (const dir of directories.slice(0, 3)) { // Top 3 relevant directories
    queries.push(`site:${dir} ${keyword} ${target.region || ''}`);
  }
  
  // Dedupe queries
  const uniqueQueries = [...new Set(queries)].slice(0, 6);
  
  for (const query of uniqueQueries) {
    if (leads.length >= 15) break;
    
    try {
      // Use Bing search (DuckDuckGo is blocked in some corporate environments)
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`;
      console.log(`[SEARCH] Querying: ${query}`);
      
      const res = await axiosInstance.get(searchUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      const $ = cheerio.load(res.data);
      
      // Parse Bing results
      $('li.b_algo').each((i, el) => {
        if (leads.length >= 20) return;
        
        const titleEl = $(el).find('h2 a');
        const title = titleEl.text().trim();
        const rawLink = titleEl.attr('href') || '';
        const link = decodeBingUrl(rawLink);
        const snippet = $(el).find('.b_caption p, .b_caption .b_paractl').text().trim();

        // Filter out non-business results
        if (!isLikelyBusinessResult(title, link, snippet, keyword)) return;
        if (link === 'NA' || !link.startsWith('http')) return;
        
        // Check if we already have this URL
        if (leads.some(l => l.website === link)) return;

        const phone = extractPhone(snippet);
        const email = extractEmail(snippet);
        
        // Extract better business name from title
        let businessName = title
          .replace(/\s*[-|·•]\s*Yelp.*$/i, '')
          .replace(/\s*[-|·•]\s*Facebook.*$/i, '')
          .replace(/\s*[-|·•]\s*Yellow\s*Pages.*$/i, '')
          .replace(/THE BEST \d+ /i, '')
          .replace(/ in .*$/i, '')
          .split(/[-|·•]/)[0]
          .trim();

        leads.push({
          id: `web-${leads.length}-${Math.random().toString(36).substr(2, 5)}`,
          name: sanitize(businessName),
          location: `${target.city || ''}, ${target.region || ''}`.replace(/^,\s*/, '').trim(),
          city: target.city || '',
          zipcode: target.zipcode || '',
          phone: sanitize(phone),
          email: sanitize(email),
          website: link,
          sources: ["Web Search"],
          socials: {
            facebook: link.includes('facebook.com') ? link : "NA",
            instagram: link.includes('instagram.com') ? link : "NA",
            tiktok: "NA"
          }
        });
      });
      
      // Delay between queries
      await new Promise(r => setTimeout(r, 800));
      
    } catch (e) {
      console.log(`[SEARCH] Error: ${e.message}`);
    }
  }
  
  console.log(`[DDG] Found ${leads.length} business results`);
  return leads;
}

/**
 * ENGINE 3: Targeted Directory Search using DuckDuckGo
 */
async function searchDirectoryExpansion(keyword, target, gisNames = []) {
  const leads = [];
  const locationParts = [target.city, target.region].filter(Boolean);
  const location = locationParts.join(' ');
  const city = target.city || '';
  
  // Queries focused on finding business directory listings and official sites
  const queries = [
    // Search for GIS-found business names
    ...gisNames.slice(0, 2).map(name => `"${name}" contact email`),
    // Directory and official site searches
    `${keyword} ${city} ${target.region || ''} directory`,
    `${keyword} ${location} official website`
  ].filter(q => q.trim());
  
  for (const query of queries) {
    if (leads.length >= 10) break;
    
    try {
      // Use Bing for directory searches
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=15`;
      console.log(`[DIR] Querying: ${query}`);
      
      const res = await axiosInstance.get(searchUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html'
        }
      });

      const $ = cheerio.load(res.data);
      
      $('li.b_algo').each((i, el) => {
        if (leads.length >= 15) return;
        
        const titleEl = $(el).find('h2 a');
        const title = titleEl.text().trim();
        const rawWebsite = titleEl.attr('href') || '';
        const website = decodeBingUrl(rawWebsite);
        const snippet = $(el).find('.b_caption p').text().trim();
        
        if (!title || website === 'NA' || !website.startsWith('http')) return;
        if (isExcludedDomain(website)) return;
        if (leads.some(l => l.website === website)) return;

        // Clean up business name
        let businessName = title
          .replace(/\s*[-|·•]\s*Yelp.*$/i, '')
          .replace(/\s*[-|·•]\s*Yellow\s*Pages.*$/i, '')
          .replace(/THE BEST \d+ /i, '')
          .split(/[-|·•]/)[0]
          .trim();

        leads.push({
          id: `dir-${leads.length}-${Math.random().toString(36).slice(2, 7)}`,
          name: sanitize(businessName),
          location: `${target.city || ''}, ${target.region || ''}`.replace(/^,\s*/, '').trim(),
          city: target.city || '',
          zipcode: target.zipcode || '',
          phone: sanitize(extractPhone(snippet)),
          email: sanitize(extractEmail(snippet)),
          website,
          sources: ['Directory Search'],
          socials: { facebook: 'NA', instagram: 'NA', tiktok: 'NA' }
        });
      });
      
      await new Promise(r => setTimeout(r, 800));
      
    } catch (e) {
      console.log(`[DIR] Error: ${e.message}`);
    }
  }
  
  console.log(`[DIR] Found ${leads.length} directory results`);
  return leads;
}

/**
 * Main Concatenating Search Orchestrator
 * Runs all engines in parallel and merges/concatenates results.
 */
async function searchTargetLocation(keyword, target, options = {}) {
  console.log(`\n[ORCHESTRATOR] Starting search for "${keyword}" in "${target.queryArea}"`);
  
  // Collect all leads from various engines
  const allLeads = [];
  
  // ENGINE: Paid APIs (if configured) - most reliable
  if (paidEngines && paidEngines.hasPaidApiEnabled()) {
    console.log('[ORCHESTRATOR] Using paid API engines for better results');
    
    const [serpApiLeads, apifyLeads] = await Promise.all([
      paidEngines.searchSerpApi(keyword, target).catch(() => []),
      paidEngines.searchApify(keyword, target).catch(() => [])
    ]);
    
    allLeads.push(...serpApiLeads, ...apifyLeads);
    console.log(`[ORCHESTRATOR] Paid APIs found: ${serpApiLeads.length + apifyLeads.length} leads`);
  }
  
  // ENGINE 1: GIS/Nominatim (free, always run)
  const gisLeads = await searchOverpassGIS(keyword, target);
  allLeads.push(...gisLeads);
  
  // Extract names found by GIS to use in web searches
  const gisNames = gisLeads
    .map(l => l.name)
    .filter(n => n && n !== 'NA' && n.length > 3);
  
  console.log(`[ORCHESTRATOR] GIS found names: ${gisNames.join(', ') || 'none'}`);
  
  // ENGINE 2 & 3: Web searches (free, can be unreliable)
  const [snippetLeads, directoryLeads] = await Promise.all([
    searchEngineSnippets(keyword, target, gisNames),
    searchDirectoryExpansion(keyword, target, gisNames)
  ]);
  
  allLeads.push(...snippetLeads, ...directoryLeads);

  console.log(`[ORCHESTRATOR] Raw results - GIS: ${gisLeads.length}, Snippets: ${snippetLeads.length}, Directory: ${directoryLeads.length}`);

  // Deep crawl websites for missing contact details - enrich ALL leads with websites
  console.log(`[ORCHESTRATOR] Enriching leads with website contact info...`);
  for (const lead of allLeads) {
    if (lead.website && lead.website !== 'NA' && !isExcludedDomain(lead.website)) {
      // Skip yelp/yellowpages/facebook - they don't have actual business contact info
      if (lead.website.includes('yelp.com') || 
          lead.website.includes('yellowpages.com') ||
          lead.website.includes('facebook.com')) {
        continue;
      }
      
      if (lead.email === 'NA' || lead.phone === 'NA') {
        try {
          console.log(`[ENRICH] Scraping: ${lead.website.substring(0, 50)}...`);
          const deepDetails = await scrapeWebsiteDetails(lead.website);
          if (lead.email === 'NA' && deepDetails.email !== 'NA') {
            lead.email = deepDetails.email;
            console.log(`[ENRICH] Found email: ${deepDetails.email}`);
          }
          if (lead.phone === 'NA' && deepDetails.phone !== 'NA') {
            lead.phone = deepDetails.phone;
          }
          if (lead.socials.facebook === 'NA' && deepDetails.socials.facebook !== 'NA') {
            lead.socials.facebook = deepDetails.socials.facebook;
          }
          if (lead.socials.instagram === 'NA' && deepDetails.socials.instagram !== 'NA') {
            lead.socials.instagram = deepDetails.socials.instagram;
          }
        } catch (e) {
          // Skip enrichment errors silently
        }
      }
    }
  }

  // Deduplicate and Concatenate all records across platforms
  const concatenatedLeads = mergeAndConcatenateLeads(allLeads);
  console.log(`[ORCHESTRATOR] After dedup: ${concatenatedLeads.length} unique leads`);
  
  return concatenatedLeads;
}

/**
 * Search Google Maps via Bing for business listings
 * Uses targeted queries to find actual businesses
 */
async function searchGoogleMapsViaBing(keyword, target) {
  const leads = [];
  const city = target.city || '';
  const state = target.region || '';
  const zip = target.zipcode || '';
  
  // Construct location string
  const locationStr = [city, state, zip].filter(Boolean).join(' ');
  
  // Targeted queries for business discovery
  const queries = [
    `${keyword} ${city} ${state}`,
    `${keyword} near ${zip}`,
    `"${keyword}" "${city}" address phone`,
    `${keyword} ${city} site:google.com/maps`
  ].filter(q => q.includes(keyword));
  
  for (const query of queries.slice(0, 2)) {
    try {
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`;
      console.log(`[MAPS] Querying: ${query}`);
      
      const res = await axiosInstance.get(searchUrl, {
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      const $ = cheerio.load(res.data);
      
      // Look for local business results
      $('li.b_algo').each((i, el) => {
        if (leads.length >= 30) return;
        
        const titleEl = $(el).find('h2 a');
        const title = titleEl.text().trim();
        const rawLink = titleEl.attr('href') || '';
        const link = decodeBingUrl(rawLink);
        const snippet = $(el).find('.b_caption p').text().trim();

        // Skip non-business results
        if (!isLikelyBusinessResult(title, link, snippet, keyword)) return;
        if (link === 'NA' || !link.startsWith('http')) return;
        if (leads.some(l => l.website === link)) return;

        const phone = extractPhone(snippet);
        const email = extractEmail(snippet);
        
        // Clean business name
        let businessName = title
          .replace(/\s*[-|·•]\s*Google\s*Maps.*$/i, '')
          .replace(/\s*[-|·•]\s*Yelp.*$/i, '')
          .replace(/\s*[-|·•]\s*Facebook.*$/i, '')
          .replace(/\s*-\s*Updated\s+\d+.*$/i, '')
          .replace(/THE BEST \d+ /i, '')
          .split(/[-|·•]/)[0]
          .trim();

        leads.push({
          id: `maps-${leads.length}-${Math.random().toString(36).substr(2, 5)}`,
          name: sanitize(businessName),
          location: locationStr,
          city: city,
          zipcode: zip,
          phone: sanitize(phone),
          email: sanitize(email),
          website: link,
          sources: ["Maps Search"],
          socials: { facebook: 'NA', instagram: 'NA', tiktok: 'NA' }
        });
      });
      
      await new Promise(r => setTimeout(r, 400));
      
    } catch (e) {
      console.log(`[MAPS] Error: ${e.message}`);
    }
  }
  
  return leads;
}

/**
 * Multi-target search orchestrator
 * Searches key cities in an area and aggregates results
 */
async function searchAllTargets(keyword, targets, options = {}) {
  console.log(`\n[MULTI-TARGET] Starting search for "${keyword}" across ${targets.length} locations`);
  
  const allLeads = [];
  const processedCities = new Set();
  
  // Limit to unique cities (avoid searching same city multiple times)
  const uniqueCityTargets = [];
  for (const target of targets) {
    const cityKey = `${target.city}-${target.region}`.toLowerCase();
    if (!processedCities.has(cityKey)) {
      processedCities.add(cityKey);
      uniqueCityTargets.push(target);
    }
  }
  
  // Limit to first 5 cities to avoid rate limiting
  const citiesToSearch = uniqueCityTargets.slice(0, 5);
  console.log(`[MULTI-TARGET] Searching ${citiesToSearch.length} unique cities`);
  
  for (let i = 0; i < citiesToSearch.length; i++) {
    const target = citiesToSearch[i];
    
    console.log(`\n[${i + 1}/${citiesToSearch.length}] Searching: ${target.city}, ${target.region}`);
    
    try {
      // Search this target location
      const leads = await searchTargetLocation(keyword, target, options);
      allLeads.push(...leads);
      
      // Longer delay between cities to avoid rate limiting
      if (i < citiesToSearch.length - 1) {
        console.log('[MULTI-TARGET] Pausing to avoid rate limits...');
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.log(`[ERROR] Failed searching ${target.queryArea}: ${e.message}`);
    }
  }
  
  // Final deduplication across all targets
  console.log(`\n[MULTI-TARGET] Total raw leads: ${allLeads.length}`);
  const finalLeads = mergeAndConcatenateLeads(allLeads);
  console.log(`[MULTI-TARGET] After final dedup: ${finalLeads.length} unique leads`);
  
  return finalLeads;
}

module.exports = { searchTargetLocation, searchAllTargets, scrapeWebsiteDetails };
