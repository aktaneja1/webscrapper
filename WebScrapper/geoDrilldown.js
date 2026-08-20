/**
 * Exhaustive Geo Drill-down Module
 * Maps target areas (States, Provinces, Counties, Cities) into exhaustive ZIP/Postal codes and sub-area sectors.
 */

const REGION_DATABASE = {
  california: {
    name: "California",
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
      { name: "Santa Ana", zipcodes: ["92701", "92703", "92704", "92705", "92706", "92707"] }
    ]
  },
  washington: {
    name: "Washington",
    type: "state",
    cities: [
      { name: "Seattle", zipcodes: ["98101", "98102", "98103", "98104", "98105", "98107", "98109", "98115", "98122", "98133", "98144"] },
      { name: "Federal Way", zipcodes: ["98001", "98003", "98023", "98063", "98093"] },
      { name: "Tacoma", zipcodes: ["98402", "98403", "98404", "98405", "98406", "98407", "98408", "98409"] },
      { name: "Spokane", zipcodes: ["99201", "99202", "99203", "99204", "99205", "99207", "99208"] },
      { name: "Bellevue", zipcodes: ["98004", "98005", "98006", "98007", "98008"] }
    ]
  },
  "new york": {
    name: "New York",
    type: "state",
    cities: [
      { name: "New York City (Manhattan)", zipcodes: ["10001", "10002", "10003", "10009", "10011", "10016", "10019", "10023", "10025", "10028", "10036"] },
      { name: "Brooklyn", zipcodes: ["11201", "11203", "11205", "11209", "11211", "11215", "11217", "11226", "11231", "11235", "11238"] },
      { name: "Queens", zipcodes: ["11101", "11354", "11375", "11385", "11432", "11691"] },
      { name: "Buffalo", zipcodes: ["14201", "14202", "14207", "14209", "14213", "14214", "14215"] }
    ]
  },
  texas: {
    name: "Texas",
    type: "state",
    cities: [
      { name: "Houston", zipcodes: ["77002", "77003", "77006", "77007", "77008", "77019", "77024", "77027", "77030", "77056", "77077"] },
      { name: "Dallas", zipcodes: ["75201", "75202", "75204", "75206", "75208", "75219", "75220", "75225", "75230"] },
      { name: "Austin", zipcodes: ["78701", "78702", "78703", "78704", "78705", "78745", "78751", "78758", "78759"] },
      { name: "San Antonio", zipcodes: ["78201", "78205", "78209", "78212", "78216", "78229", "78230", "78240"] }
    ]
  }
};

/**
 * Given a prompt area string (e.g., "California", "Fremont", "Federal Way"),
 * resolves it into an exhaustive list of search targets.
 */
function drilldownArea(areaPrompt, depthMode = 'standard') {
  const normalized = areaPrompt.trim().toLowerCase();
  
  // 1. Check exact state/province database match
  for (const key of Object.keys(REGION_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      const region = REGION_DATABASE[key];
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
        targets: targets
      };
    }
  }

  // 2. Check direct city match within database
  for (const regKey of Object.keys(REGION_DATABASE)) {
    const region = REGION_DATABASE[regKey];
    for (const city of region.cities) {
      if (city.name.toLowerCase() === normalized || normalized.includes(city.name.toLowerCase())) {
        const targets = city.zipcodes.map(zip => ({
          region: region.name,
          city: city.name,
          zipcode: zip,
          queryArea: `${city.name}, ${region.name} ${zip}`
        }));
        return {
          matchedRegion: `${city.name}, ${region.name}`,
          isBroadArea: false,
          targets: targets
        };
      }
    }
  }

  // 3. Custom city/area fallback (generate multi-sector drilldown)
  const parts = areaPrompt.split(",").map(p => p.trim());
  const cityName = parts[0] || areaPrompt;
  const stateOrCountry = parts[1] || "";

  const sectors = ["Downtown Core", "North District", "South District", "East District", "West District", "Central Plaza", "Commercial Corridor"];
  const targets = sectors.map(sector => ({
    region: stateOrCountry || cityName,
    city: cityName,
    zipcode: sector,
    queryArea: `${cityName}${stateOrCountry ? ', ' + stateOrCountry : ''} (${sector})`
  }));

  return {
    matchedRegion: areaPrompt,
    isBroadArea: false,
    targets: targets
  };
}

module.exports = { drilldownArea, REGION_DATABASE };
