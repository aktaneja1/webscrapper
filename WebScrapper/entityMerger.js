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

    let matchKey = null;

    // Check existing records in map for match
    for (const [key, existing] of mergedMap.entries()) {
      const existingName = normalizeStr(existing.name);
      const existingPhone = cleanPhone(existing.phone);
      const existingLoc = normalizeStr(existing.location);

      // Match criteria 1: Same phone number
      const phoneMatch = normPhone && existingPhone && (normPhone === existingPhone || normPhone.endsWith(existingPhone.slice(-7)));

      // Match criteria 2: Name similarity and address similarity
      const nameMatch = normName.includes(existingName) || existingName.includes(normName);
      const locMatch = normLoc && existingLoc && (normLoc.slice(0, 15) === existingLoc.slice(0, 15));

      if (phoneMatch || (nameMatch && locMatch)) {
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

      // Merge Email
      if ((existing.email === 'NA' || !existing.email) && lead.email && lead.email !== 'NA') {
        existing.email = lead.email;
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
