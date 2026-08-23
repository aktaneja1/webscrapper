/**
 * Diagnostic Test Script for WebScrapper
 * Run with: node test-scraper.js
 */

const { drilldownArea } = require('./geoDrilldown');
const { searchTargetLocation } = require('./scraper');

const TEST_CASES = [
  { keyword: 'Mosques', area: 'Seattle' },
  { keyword: 'Temples', area: 'Fremont California' },
  { keyword: 'McDonalds', area: 'Oregon' },
  { keyword: 'Temples', area: 'Bothell Washington' },
];

async function runTests() {
  console.log('='.repeat(70));
  console.log('WEBSCRAPPER DIAGNOSTIC TEST');
  console.log('='.repeat(70));

  for (const test of TEST_CASES) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`TEST: "${test.keyword}" in "${test.area}"`);
    console.log('─'.repeat(70));

    // Test geo drilldown
    const drillResult = drilldownArea(test.area, 'standard');
    console.log(`\n[GEO DRILLDOWN]`);
    console.log(`  Matched Region: ${drillResult.matchedRegion}`);
    console.log(`  Is Broad Area: ${drillResult.isBroadArea}`);
    console.log(`  Total Targets: ${drillResult.targets.length}`);
    console.log(`  First 3 targets:`);
    drillResult.targets.slice(0, 3).forEach((t, i) => {
      console.log(`    ${i + 1}. ${t.queryArea}`);
    });

    // Test actual scraping on first target only (to avoid rate limits)
    if (drillResult.targets.length > 0) {
      const firstTarget = drillResult.targets[0];
      console.log(`\n[SCRAPE TEST] Querying: ${firstTarget.queryArea}`);
      
      try {
        const startTime = Date.now();
        const leads = await searchTargetLocation(test.keyword, firstTarget, {});
        const elapsed = Date.now() - startTime;
        
        console.log(`  Results: ${leads.length} leads found (${elapsed}ms)`);
        if (leads.length > 0) {
          console.log(`  Sample lead:`);
          const sample = leads[0];
          console.log(`    Name: ${sample.name}`);
          console.log(`    Location: ${sample.location}`);
          console.log(`    Phone: ${sample.phone}`);
          console.log(`    Email: ${sample.email}`);
          console.log(`    Website: ${sample.website}`);
          console.log(`    Sources: ${sample.sources.join(', ')}`);
        }
      } catch (err) {
        console.log(`  ERROR: ${err.message}`);
      }
    }

    // Rate limit protection
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('TESTS COMPLETE');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
