const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

// Target Seattle metro area cities
const seattleMetroCities = ['seattle', 'renton', 'kent', 'bothell', 'bellevue', 'kirkland', 'redmond', 'tukwila', 'burien', 'federal way', 'auburn'];

async function scrapeGurdwaraDirectory() {
  const url = 'https://directory.sikhscholarhub.com/gurdwara/washington';
  
  console.log('Scraping Sikh directory for Seattle Metro area...\n');
  
  try {
    const res = await axiosInstance.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });
    
    const $ = cheerio.load(res.data);
    
    // Find all links to individual gurdwara pages
    const gurdwaras = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (href.includes('/gurdwara/washington/') && href !== '/gurdwara/washington' && text.length > 5) {
        // Check if it's in Seattle metro area
        const textLower = text.toLowerCase();
        const isSeattleArea = seattleMetroCities.some(city => textLower.includes(city));
        if (!gurdwaras.some(g => g.href === href)) {
          gurdwaras.push({ name: text, href, isSeattleArea });
        }
      }
    });
    
    // Filter to Seattle metro area gurdwaras
    const seattleGurdwaras = gurdwaras.filter(g => g.isSeattleArea);
    console.log('Found', seattleGurdwaras.length, 'Gurdwaras in Seattle Metro Area:\n');
    
    const results = [];
    
    // Scrape each gurdwara's detail page for contact info
    for (const g of seattleGurdwaras) {
      const nameParts = g.name.split('Google Maps');
      const cleanName = nameParts[0].trim() || g.name;
      
      console.log('---', cleanName, '---');
      
      try {
        const detailUrl = g.href.startsWith('http') ? g.href : 'https://directory.sikhscholarhub.com' + g.href;
        const detail = await axiosInstance.get(detailUrl, {
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const $d = cheerio.load(detail.data);
        const pageText = $d('body').text();
        
        // Extract info
        const phoneMatch = pageText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        const emailMatch = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const addressMatch = pageText.match(/\d+[^,\n]+,\s*(?:WA|Washington)\s*\d{5}/i);
        
        // Find official website
        let website = null;
        $d('a[href^="http"]').each((i, el) => {
          const href = $d(el).attr('href');
          if (href && !href.includes('sikhscholarhub') && !href.includes('google.com') &&
              !href.includes('facebook') && !href.includes('twitter')) {
            website = href;
            return false;
          }
        });
        
        const result = {
          name: cleanName,
          phone: phoneMatch ? phoneMatch[0] : 'NA',
          email: emailMatch ? emailMatch[0] : 'NA',
          address: addressMatch ? addressMatch[0] : 'NA',
          website: website || 'NA'
        };
        
        console.log('  Address:', result.address);
        console.log('  Phone:', result.phone);
        console.log('  Email:', result.email);
        console.log('  Website:', result.website);
        
        results.push(result);
        
      } catch (e) {
        console.log('  Error:', e.message);
      }
      
      console.log();
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Summary
    console.log('\n========== SUMMARY ==========');
    console.log('Target emails to find:');
    console.log('1. singhsabha100@gmail.com (Singh Sabha)');
    console.log('2. info@sikhcentreofseattle.org (Sikh Centre)');
    console.log('3. seattlenanaksar@gmail.com (Nanaksar)');
    console.log('4. kentsikhtemple@outlook.com (Kent Temple)');
    
    console.log('\nEmails found:');
    results.filter(r => r.email !== 'NA').forEach(r => {
      console.log(`  ${r.name}: ${r.email}`);
    });
    
  } catch (e) {
    console.log('Error:', e.message);
  }
}

scrapeGurdwaraDirectory();
