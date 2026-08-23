/**
 * Exhaustive Geo Drill-down Module
 * Maps target areas (States, Provinces, Counties, Cities) into exhaustive ZIP/Postal codes and sub-area sectors.
 */

const REGION_DATABASE = {
  california: {
    name: "California",
    abbrev: "CA",
    type: "state",
    cities: [
      { name: "Los Angeles", zipcodes: ["90001", "90002", "90003", "90004", "90005", "90006", "90007", "90008", "90011", "90012", "90015", "90019", "90020", "90024", "90028", "90034", "90036", "90045", "90049", "90064", "90066"] },
      { name: "San Francisco", zipcodes: ["94102", "94103", "94107", "94108", "94109", "94110", "94112", "94114", "94115", "94117", "94118", "94121", "94122", "94123", "94133"] },
      { name: "San Diego", zipcodes: ["92101", "92102", "92103", "92104", "92105", "92108", "92109", "92110", "92111", "92115", "92117", "92120", "92122", "92126", "92130"] },
      { name: "San Jose", zipcodes: ["95110", "95111", "95112", "95116", "95117", "95120", "95123", "95124", "95125", "95128", "95129", "95131", "95134", "95136"] },
      { name: "Sacramento", zipcodes: ["95814", "95815", "95816", "95817", "95818", "95819", "95820", "95822", "95823", "95825", "95831", "95833"] },
      { name: "Fresno", zipcodes: ["93701", "93702", "93703", "93704", "93705", "93710", "93711", "93720", "93722", "93726", "93727"] },
      { name: "Fremont", zipcodes: ["94536", "94538", "94539", "94555"] },
      { name: "Long Beach", zipcodes: ["90802", "90803", "90804", "90805", "90806", "90807", "90808", "90813", "90815"] },
      { name: "Oakland", zipcodes: ["94601", "94602", "94605", "94606", "94607", "94609", "94611", "94612", "94618", "94619"] },
      { name: "Anaheim", zipcodes: ["92801", "92802", "92804", "92805", "92806", "92807", "92808"] },
      { name: "Bakersfield", zipcodes: ["93301", "93304", "93305", "93306", "93307", "93308", "93309", "93311", "93312"] },
      { name: "Riverside", zipcodes: ["92501", "92503", "92504", "92505", "92506", "92507", "92508"] },
      { name: "Irvine", zipcodes: ["92602", "92603", "92604", "92606", "92612", "92614", "92618", "92620"] },
      { name: "Santa Ana", zipcodes: ["92701", "92703", "92704", "92705", "92706", "92707"] },
      { name: "Santa Clara", zipcodes: ["95050", "95051", "95054"] },
      { name: "Sunnyvale", zipcodes: ["94085", "94086", "94087", "94089"] },
      { name: "Milpitas", zipcodes: ["95035"] },
      { name: "Newark", zipcodes: ["94560"] },
      { name: "Union City", zipcodes: ["94587"] }
    ]
  },
  washington: {
    name: "Washington",
    abbrev: "WA",
    type: "state",
    cities: [
      { name: "Seattle", zipcodes: ["98101", "98102", "98103", "98104", "98105", "98107", "98109", "98115", "98122", "98133", "98144"] },
      { name: "Federal Way", zipcodes: ["98001", "98003", "98023", "98063", "98093"] },
      { name: "Tacoma", zipcodes: ["98402", "98403", "98404", "98405", "98406", "98407", "98408", "98409"] },
      { name: "Spokane", zipcodes: ["99201", "99202", "99203", "99204", "99205", "99207", "99208"] },
      { name: "Bellevue", zipcodes: ["98004", "98005", "98006", "98007", "98008"] },
      { name: "Bothell", zipcodes: ["98011", "98012", "98021"] },
      { name: "Kirkland", zipcodes: ["98033", "98034"] },
      { name: "Redmond", zipcodes: ["98052", "98053"] },
      { name: "Renton", zipcodes: ["98055", "98056", "98057", "98058"] },
      { name: "Kent", zipcodes: ["98030", "98031", "98032", "98042"] },
      { name: "Everett", zipcodes: ["98201", "98203", "98204", "98208"] },
      { name: "Olympia", zipcodes: ["98501", "98502", "98503", "98506"] },
      { name: "Vancouver", zipcodes: ["98660", "98661", "98662", "98663", "98664", "98665"] }
    ]
  },
  oregon: {
    name: "Oregon",
    abbrev: "OR",
    type: "state",
    cities: [
      { name: "Portland", zipcodes: ["97201", "97202", "97203", "97204", "97205", "97206", "97209", "97210", "97211", "97212", "97213", "97214", "97215", "97217", "97218", "97219", "97220", "97221", "97227", "97230", "97232", "97233", "97236"] },
      { name: "Salem", zipcodes: ["97301", "97302", "97303", "97304", "97305", "97306", "97317"] },
      { name: "Eugene", zipcodes: ["97401", "97402", "97403", "97404", "97405"] },
      { name: "Beaverton", zipcodes: ["97005", "97006", "97007", "97008"] },
      { name: "Hillsboro", zipcodes: ["97123", "97124"] },
      { name: "Bend", zipcodes: ["97701", "97702", "97703"] },
      { name: "Medford", zipcodes: ["97501", "97504"] },
      { name: "Corvallis", zipcodes: ["97330", "97331", "97333"] },
      { name: "Gresham", zipcodes: ["97030", "97080"] },
      { name: "Lake Oswego", zipcodes: ["97034", "97035"] },
      { name: "Tigard", zipcodes: ["97223", "97224"] }
    ]
  },
  "new york": {
    name: "New York",
    abbrev: "NY",
    type: "state",
    cities: [
      { name: "New York City", zipcodes: ["10001", "10002", "10003", "10009", "10011", "10016", "10019", "10023", "10025", "10028", "10036"] },
      { name: "Manhattan", zipcodes: ["10001", "10002", "10003", "10009", "10011", "10016", "10019", "10023", "10025", "10028", "10036"] },
      { name: "Brooklyn", zipcodes: ["11201", "11203", "11205", "11209", "11211", "11215", "11217", "11226", "11231", "11235", "11238"] },
      { name: "Queens", zipcodes: ["11101", "11354", "11375", "11385", "11432", "11691"] },
      { name: "Buffalo", zipcodes: ["14201", "14202", "14207", "14209", "14213", "14214", "14215"] },
      { name: "Bronx", zipcodes: ["10451", "10452", "10453", "10454", "10455", "10456", "10457", "10458", "10459", "10460"] },
      { name: "Rochester", zipcodes: ["14604", "14605", "14607", "14608", "14609", "14610", "14611", "14612", "14613", "14614", "14615", "14616", "14617", "14618", "14619", "14620", "14621"] }
    ]
  },
  texas: {
    name: "Texas",
    abbrev: "TX",
    type: "state",
    cities: [
      { name: "Houston", zipcodes: ["77002", "77003", "77006", "77007", "77008", "77019", "77024", "77027", "77030", "77056", "77077"] },
      { name: "Dallas", zipcodes: ["75201", "75202", "75204", "75206", "75208", "75219", "75220", "75225", "75230"] },
      { name: "Austin", zipcodes: ["78701", "78702", "78703", "78704", "78705", "78745", "78751", "78758", "78759"] },
      { name: "San Antonio", zipcodes: ["78201", "78205", "78209", "78212", "78216", "78229", "78230", "78240"] },
      { name: "Fort Worth", zipcodes: ["76101", "76102", "76103", "76104", "76105", "76106", "76107", "76108", "76109", "76110"] },
      { name: "El Paso", zipcodes: ["79901", "79902", "79903", "79904", "79905", "79906", "79907", "79912", "79924", "79925"] },
      { name: "Plano", zipcodes: ["75023", "75024", "75025", "75074", "75075"] },
      { name: "Irving", zipcodes: ["75014", "75015", "75016", "75017", "75038", "75039", "75060", "75061", "75062", "75063"] }
    ]
  },
  florida: {
    name: "Florida",
    abbrev: "FL",
    type: "state",
    cities: [
      { name: "Miami", zipcodes: ["33101", "33109", "33125", "33126", "33127", "33128", "33129", "33130", "33131", "33132", "33133", "33134", "33135", "33136", "33137", "33138", "33139", "33140", "33141", "33142", "33143", "33144", "33145", "33146", "33147"] },
      { name: "Orlando", zipcodes: ["32801", "32803", "32804", "32805", "32806", "32807", "32808", "32809", "32810", "32811", "32812", "32814", "32817", "32818", "32819", "32820", "32821", "32822", "32824", "32825", "32826", "32827", "32828", "32829"] },
      { name: "Tampa", zipcodes: ["33601", "33602", "33603", "33604", "33605", "33606", "33607", "33609", "33610", "33611", "33612", "33613", "33614", "33615", "33616", "33617", "33618", "33619", "33620", "33621", "33624", "33625", "33626", "33629"] },
      { name: "Jacksonville", zipcodes: ["32099", "32201", "32202", "32203", "32204", "32205", "32206", "32207", "32208", "32209", "32210", "32211", "32212", "32214", "32216", "32217", "32218", "32219", "32220", "32221", "32222", "32223", "32224", "32225", "32226", "32227", "32228", "32229", "32231", "32232", "32233", "32234", "32235", "32236", "32237", "32238", "32239", "32240", "32241", "32244", "32245", "32246", "32247", "32250", "32254", "32255", "32256", "32257", "32258", "32266", "32277"] }
    ]
  }
};

// State name/abbreviation aliases for flexible matching
const STATE_ALIASES = {
  'ca': 'california', 'calif': 'california',
  'wa': 'washington', 'wash': 'washington',
  'or': 'oregon', 'ore': 'oregon',
  'ny': 'new york', 'nyc': 'new york',
  'tx': 'texas', 'tex': 'texas',
  'fl': 'florida', 'fla': 'florida'
};

/**
 * Parse user input into city and state components.
 * Handles: "Seattle", "Seattle WA", "Seattle, Washington", "Bothell Washington", etc.
 */
function parseAreaInput(areaPrompt) {
  const normalized = areaPrompt.trim();
  
  // Try "City, State" format first
  if (normalized.includes(',')) {
    const [cityPart, statePart] = normalized.split(',').map(s => s.trim().toLowerCase());
    return { city: cityPart, state: statePart, raw: normalized.toLowerCase() };
  }
  
  // Try "City State" format (split on last word that could be a state)
  const words = normalized.toLowerCase().split(/\s+/);
  if (words.length >= 2) {
    const lastWord = words[words.length - 1];
    const lastTwoWords = words.slice(-2).join(' ');
    
    // Check if last word(s) match a state name or alias
    if (STATE_ALIASES[lastWord] || Object.keys(REGION_DATABASE).includes(lastWord)) {
      return {
        city: words.slice(0, -1).join(' '),
        state: STATE_ALIASES[lastWord] || lastWord,
        raw: normalized.toLowerCase()
      };
    }
    if (STATE_ALIASES[lastTwoWords] || Object.keys(REGION_DATABASE).includes(lastTwoWords)) {
      return {
        city: words.slice(0, -2).join(' '),
        state: STATE_ALIASES[lastTwoWords] || lastTwoWords,
        raw: normalized.toLowerCase()
      };
    }
  }
  
  // Single word - could be city or state
  return { city: null, state: null, raw: normalized.toLowerCase() };
}

/**
 * Find a city in the database by name, optionally filtered by state.
 */
function findCityInDatabase(cityName, stateName = null) {
  const normalizedCity = cityName.toLowerCase().trim();
  
  for (const [stateKey, region] of Object.entries(REGION_DATABASE)) {
    // If state specified, only search that state
    if (stateName && stateKey !== stateName && region.name.toLowerCase() !== stateName) {
      continue;
    }
    
    for (const city of region.cities) {
      const cityLower = city.name.toLowerCase();
      if (cityLower === normalizedCity || cityLower.includes(normalizedCity) || normalizedCity.includes(cityLower)) {
        return { region, city };
      }
    }
  }
  return null;
}

/**
 * Find a state/region in the database by name or alias.
 */
function findStateInDatabase(stateName) {
  const normalized = stateName.toLowerCase().trim();
  const resolvedKey = STATE_ALIASES[normalized] || normalized;
  
  for (const [key, region] of Object.entries(REGION_DATABASE)) {
    if (key === resolvedKey || region.name.toLowerCase() === resolvedKey || region.abbrev?.toLowerCase() === normalized) {
      return { key, region };
    }
  }
  return null;
}

/**
 * Given a prompt area string (e.g., "California", "Fremont", "Bothell Washington"),
 * resolves it into an exhaustive list of search targets.
 */
function drilldownArea(areaPrompt, depthMode = 'standard') {
  const parsed = parseAreaInput(areaPrompt);
  
  // PRIORITY 1: If we have "City State" pattern, try city match first
  if (parsed.city && parsed.state) {
    const cityMatch = findCityInDatabase(parsed.city, parsed.state);
    if (cityMatch) {
      const { region, city } = cityMatch;
      const zips = depthMode === 'exhaustive' ? city.zipcodes : city.zipcodes.slice(0, 3);
      const targets = zips.map(zip => ({
        region: region.name,
        city: city.name,
        zipcode: zip,
        queryArea: `${city.name}, ${region.name} ${zip}`
      }));
      return {
        matchedRegion: `${city.name}, ${region.name}`,
        isBroadArea: false,
        targets
      };
    }
    
    // City not in database but state is valid - create direct city query
    const stateMatch = findStateInDatabase(parsed.state);
    if (stateMatch) {
      return {
        matchedRegion: `${parsed.city}, ${stateMatch.region.name}`,
        isBroadArea: false,
        targets: [{
          region: stateMatch.region.name,
          city: parsed.city,
          zipcode: '',
          queryArea: `${parsed.city}, ${stateMatch.region.name}`
        }]
      };
    }
  }
  
  // PRIORITY 2: Try exact city match across all states
  const cityMatch = findCityInDatabase(parsed.raw);
  if (cityMatch) {
    const { region, city } = cityMatch;
    const zips = depthMode === 'exhaustive' ? city.zipcodes : city.zipcodes.slice(0, 3);
    const targets = zips.map(zip => ({
      region: region.name,
      city: city.name,
      zipcode: zip,
      queryArea: `${city.name}, ${region.name} ${zip}`
    }));
    return {
      matchedRegion: `${city.name}, ${region.name}`,
      isBroadArea: false,
      targets
    };
  }
  
  // PRIORITY 3: Try state-only match (for broad searches like "Oregon")
  const stateMatch = findStateInDatabase(parsed.raw);
  if (stateMatch) {
    const { region } = stateMatch;
    const targets = [];
    region.cities.forEach(city => {
      const zips = depthMode === 'exhaustive' ? city.zipcodes : city.zipcodes.slice(0, 3);
      zips.forEach(zip => {
        targets.push({
          region: region.name,
          city: city.name,
          zipcode: zip,
          queryArea: `${city.name}, ${region.name} ${zip}`
        });
      });
    });
    return {
      matchedRegion: region.name,
      isBroadArea: true,
      targets
    };
  }

  // PRIORITY 4: Unknown location - create single direct query (no fake sectors)
  const parts = areaPrompt.split(/[,\s]+/).filter(Boolean);
  const cityName = parts[0] || areaPrompt;
  const stateName = parts.slice(1).join(' ') || '';

  return {
    matchedRegion: areaPrompt,
    isBroadArea: false,
    targets: [{
      region: stateName || 'Unknown',
      city: cityName,
      zipcode: '',
      queryArea: areaPrompt.trim()
    }]
  };
}

module.exports = { drilldownArea, REGION_DATABASE, parseAreaInput, findCityInDatabase, findStateInDatabase };
