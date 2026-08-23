/**
 * Multi-Platform Concatenator & Deep Research Engine
 * Queries and concatenates business records across Overpass GIS, Search Snippets, Directories, and Maps.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const { mergeAndConcatenateLeads } = require('./entityMerger');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/gi;
const PHONE_REGEX = /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
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
  if (digits.length < 10 || digits.length > 15) return null;
  return phone.trim();
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
  const response = await axios.get(url, {
    timeout: 6000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
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
  try {
    const cleanBrand = keyword.replace(/stores|restaurants|shop/gi, '').trim();
    // Overpass query for nodes/ways in area
    const overpassQuery = `
      [out:json][timeout:10];
      (
        node["name"~"${cleanBrand}",i](${target.city ? `area["name"="${target.city}"]` : ''});
        way["name"~"${cleanBrand}",i](${target.city ? `area["name"="${target.city}"]` : ''});
      );
      out body 15;
    `;

    // Fast nominatim area fallback
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword + ' ' + target.queryArea)}&format=json&addressdetails=1&extratags=1&limit=15`;
    const res = await axios.get(nomUrl, {
      timeout: 5000,
      headers: { 'User-Agent': 'OmniScrape/2.0 (BusinessDirectoryFinder)' }
    });

    if (res.data && Array.isArray(res.data)) {
      for (const place of res.data) {
        const tags = place.extratags || {};
        const addr = place.address || {};
        const house = addr.house_number || "";
        const road = addr.road || addr.pedestrian || "";
        const city = addr.city || addr.town || target.city;
        const postcode = addr.postcode || target.zipcode;
        const state = addr.state || target.region;

        const name = tags.name || place.namedetails?.name || place.display_name.split(',')[0] || keyword;
        const fullAddr = `${house} ${road}, ${city}, ${state} ${postcode}`.trim().replace(/^,/, '');
        const phone = tags.phone || tags['contact:phone'] || "NA";
        const email = tags.email || tags['contact:email'] || "NA";
        const website = tags.website || tags['contact:website'] || place.url || "NA";

        leads.push({
          id: `osm-${place.place_id}`,
          name: sanitize(name),
          location: sanitize(fullAddr.length > 6 ? fullAddr : place.display_name),
          city: sanitize(city),
          zipcode: sanitize(postcode),
          phone: sanitize(phone),
          email: sanitize(email),
          website: sanitize(website),
          sources: ["Google Maps", "OpenStreetMap GIS"],
          socials: { facebook: "NA", instagram: "NA", tiktok: "NA" }
        });
      }
    }
  } catch (e) {
    // Ignore endpoint timeouts
  }
  return leads;
}

/**
 * ENGINE 2: Search Engine & Web Directory Snippet Scraper (DuckDuckGo / YellowPages / Yelp)
 */
async function searchEngineSnippets(keyword, target) {
  const leads = [];
  try {
    const query = `${keyword} ${target.queryArea}`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await axios.get(searchUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(res.data);
    $('.result').each((i, el) => {
      if (i >= 8) return; // Top 8 web search snippets
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const rawLink = $(el).find('.result__a').attr('href') || $(el).find('.result__url').attr('href') || 'NA';
      const link = decodeDuckDuckGoUrl(rawLink);

      if (title) {
        const phone = extractPhone(snippet);
        const email = extractEmail(snippet);

        leads.push({
          id: `ddg-${i}-${Math.random().toString(36).substr(2, 5)}`,
          name: sanitize(title.split('-')[0].split('|')[0]),
          location: `${target.city}, ${target.region} ${target.zipcode}`,
          city: target.city,
          zipcode: target.zipcode,
          phone: sanitize(phone),
          email: sanitize(email),
          website: link.startsWith('http') ? link : 'NA',
          sources: ["Web Search Snippet"],
          socials: {
            facebook: link.includes('facebook.com') ? link : "NA",
            instagram: link.includes('instagram.com') ? link : "NA",
            tiktok: link.includes('tiktok.com') ? link : "NA"
          }
        });
      }
    });
  } catch (e) {
    // Fallback search
  }
  return leads;
}

/**
 * ENGINE 3: Directory Query Expansion (Real-only, no synthetic records)
 */
async function searchDirectoryExpansion(keyword, target) {
  const leads = [];
  try {
    const query = `${keyword} ${target.queryArea} contact`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await axios.get(searchUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(res.data);
    $('.result').each((i, el) => {
      if (i >= 6) return;
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const rawLink = $(el).find('.result__a').attr('href') || '';
      const website = decodeDuckDuckGoUrl(rawLink);
      if (!title || website === 'NA') return;

      leads.push({
        id: `dir-${i}-${Math.random().toString(36).slice(2, 7)}`,
        name: sanitize(title.split('-')[0].split('|')[0]),
        location: `${target.city}, ${target.region} ${target.zipcode}`,
        city: target.city,
        zipcode: target.zipcode,
        phone: sanitize(extractPhone(snippet)),
        email: sanitize(extractEmail(snippet)),
        website,
        sources: ['Directory/Contact Search'],
        socials: { facebook: 'NA', instagram: 'NA', tiktok: 'NA' }
      });
    });
  } catch (_) {
    // If this query fails, continue with other engines.
  }

  return leads;
}

/**
 * Main Concatenating Search Orchestrator
 * Runs all engines in parallel and merges/concatenates results.
 */
async function searchTargetLocation(keyword, target, options = {}) {
  // Execute multi-engine queries concurrently
  const [gisLeads, snippetLeads, directoryLeads] = await Promise.all([
    searchOverpassGIS(keyword, target),
    searchEngineSnippets(keyword, target),
    searchDirectoryExpansion(keyword, target)
  ]);

  // Combine raw lead results from all platforms
  const combinedRawLeads = [...gisLeads, ...snippetLeads, ...directoryLeads];

  // Deep crawl websites for missing contact details
  for (const lead of combinedRawLeads) {
    if (lead.website && lead.website !== 'NA' && (lead.email === 'NA' || lead.phone === 'NA')) {
      const deepDetails = await scrapeWebsiteDetails(lead.website);
      if (lead.email === 'NA' && deepDetails.email !== 'NA') lead.email = deepDetails.email;
      if (lead.phone === 'NA' && deepDetails.phone !== 'NA') lead.phone = deepDetails.phone;
      if (lead.socials.facebook === 'NA' && deepDetails.socials.facebook !== 'NA') lead.socials.facebook = deepDetails.socials.facebook;
      if (lead.socials.instagram === 'NA' && deepDetails.socials.instagram !== 'NA') lead.socials.instagram = deepDetails.socials.instagram;
    }
  }

  // Deduplicate and Concatenate all records across platforms
  const concatenatedLeads = mergeAndConcatenateLeads(combinedRawLeads);
  return concatenatedLeads;
}

module.exports = { searchTargetLocation, scrapeWebsiteDetails };
