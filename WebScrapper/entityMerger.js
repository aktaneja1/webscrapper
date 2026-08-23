/**
 * Entity Resolution & Concatenation Engine
 * Normalizes, deduplicates, and merges business leads found across multiple platforms.
 */

// Helper to normalize strings for comparison
function normalizeStr(str) {
  if (!str || str === 'NA') return '';
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

// Clean phone numbers to digits only
function cleanPhone(phone) {
  if (!phone || phone === 'NA') return '';
  return phone.replace(/\D/g, '');
}

// Extract domain from URL
function extractDomain(url) {
  if (!url || url === 'NA') return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Deduplicates and concatenates a list of raw lead records collected from multiple platforms.
 */
function mergeAndConcatenateLeads(rawLeads) {
  if (!Array.isArray(rawLeads) || rawLeads.length === 0) return [];

  const mergedMap = new Map();

  for (const lead of rawLeads) {
    if (!lead || !lead.name) continue;

    const normName = normalizeStr(lead.name);
    const normPhone = cleanPhone(lead.phone);
    const normLoc = normalizeStr(lead.location);
    const normDomain = extractDomain(lead.website);

    let matchKey = null;

    // Check existing records in map for match
    for (const [key, existing] of mergedMap.entries()) {
      const existingName = normalizeStr(existing.name);
      const existingPhone = cleanPhone(existing.phone);
      const existingLoc = normalizeStr(existing.location);
      const existingDomain = extractDomain(existing.website);

      // Match criteria 1: Same phone number
      const phoneMatch = normPhone && existingPhone && (normPhone === existingPhone || normPhone.endsWith(existingPhone.slice(-7)));

      // Match criteria 2: Same website domain
      const domainMatch = normDomain && existingDomain && normDomain === existingDomain;

      // Match criteria 3: Name similarity (one contains the other, at least 10 chars overlap)
      const nameMatch = normName.length > 10 && existingName.length > 10 && 
        (normName.includes(existingName) || existingName.includes(normName));
      
      // Match criteria 4: Address similarity (first 15 chars match, or one is empty)
      const locMatch = (!normLoc || !existingLoc) || (normLoc.slice(0, 15) === existingLoc.slice(0, 15));

      // Match if: same phone OR same domain OR (name match AND location compatible)
      if (phoneMatch || domainMatch || (nameMatch && locMatch)) {
        matchKey = key;
        break;
      }
    }

    if (matchKey) {
      // Concatenate/Merge into existing record
      const existing = mergedMap.get(matchKey);

      // Prefer longer/more specific business name
      if ((lead.name || '').length > (existing.name || '').length && lead.name !== 'NA') {
        existing.name = lead.name;
      }

      // Prefer complete location
      if ((lead.location || '').length > (existing.location || '').length && lead.location !== 'NA') {
        existing.location = lead.location;
      }

      // Merge Phone
      if ((existing.phone === 'NA' || !existing.phone) && lead.phone && lead.phone !== 'NA') {
        existing.phone = lead.phone;
      }

      // Merge Email - prefer contact/office/info emails over others
      const preferredEmailPrefixes = ['contact', 'info', 'office', 'officemanager', 'admin', 'hello'];
      const isPreferredEmail = (email) => {
        if (!email || email === 'NA') return false;
        const prefix = email.split('@')[0].toLowerCase();
        return preferredEmailPrefixes.some(p => prefix.includes(p));
      };
      
      if (lead.email && lead.email !== 'NA') {
        if (existing.email === 'NA' || !existing.email) {
          existing.email = lead.email;
        } else if (isPreferredEmail(lead.email) && !isPreferredEmail(existing.email)) {
          // Replace with preferred email
          existing.email = lead.email;
        }
      }

      // Merge Website
      if ((existing.website === 'NA' || !existing.website) && lead.website && lead.website !== 'NA') {
        existing.website = lead.website;
      }

      // Merge Sources
      if (Array.isArray(lead.sources)) {
        lead.sources.forEach(src => {
          if (!existing.sources.includes(src)) {
            existing.sources.push(src);
          }
        });
      }

      // Merge Socials
      existing.socials = existing.socials || {};
      if (lead.socials) {
        if (existing.socials.facebook === 'NA' && lead.socials.facebook && lead.socials.facebook !== 'NA') {
          existing.socials.facebook = lead.socials.facebook;
        }
        if (existing.socials.instagram === 'NA' && lead.socials.instagram && lead.socials.instagram !== 'NA') {
          existing.socials.instagram = lead.socials.instagram;
        }
        if (existing.socials.tiktok === 'NA' && lead.socials.tiktok && lead.socials.tiktok !== 'NA') {
          existing.socials.tiktok = lead.socials.tiktok;
        }
      }
    } else {
      // New distinct record
      const uniqueKey = `${normName}_${normLoc.slice(0, 10)}_${normPhone.slice(-4) || Math.random().toString(36).substr(2, 5)}`;
      mergedMap.set(uniqueKey, {
        id: lead.id || `lead-${Math.random().toString(36).substr(2, 9)}`,
        name: lead.name || 'NA',
        location: lead.location || 'NA',
        city: lead.city || 'NA',
        zipcode: lead.zipcode || 'NA',
        phone: lead.phone || 'NA',
        email: lead.email || 'NA',
        website: lead.website || 'NA',
        sources: Array.isArray(lead.sources) ? [...lead.sources] : ['Google Search'],
        socials: {
          facebook: lead.socials?.facebook || 'NA',
          instagram: lead.socials?.instagram || 'NA',
          tiktok: lead.socials?.tiktok || 'NA'
        }
      });
    }
  }

  return Array.from(mergedMap.values());
}

module.exports = { mergeAndConcatenateLeads };
