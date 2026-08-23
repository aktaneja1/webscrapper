const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

async function testSearch(query) {
  console.log(`\n=== Search: "${query}" ===`);
  const searchUrl = 'https://www.bing.com/search?q=' + encodeURIComponent(query);
  
  const res = await axiosInstance.get(searchUrl, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html'
    }
  });
  
  const $ = cheerio.load(res.data);
  let found = false;
  
  $('li.b_algo').slice(0, 10).each((i, el) => {
    const title = $(el).find('h2').text().trim();
    const rawUrl = $(el).find('h2 a').attr('href') || '';
    
    // Decode Bing URL
    let url = rawUrl;
    if (rawUrl.includes('bing.com/ck/a')) {
      try {
        const parsed = new URL(rawUrl);
        const encodedUrl = parsed.searchParams.get('u');
        if (encodedUrl && encodedUrl.startsWith('a1')) {
          url = decodeURIComponent(encodedUrl.substring(2));
        }
      } catch(e) {}
    }
    
    const snippet = $(el).find('.b_caption p').text().trim();
    
    // Check for HTCC related content
    const isRelevant = 
      title.toLowerCase().includes('htcc') || 
      title.toLowerCase().includes('hindu temple') ||
      title.toLowerCase().includes('cultural center') ||
      url.includes('htcc') ||
      snippet.toLowerCase().includes('htcc') ||
      snippet.toLowerCase().includes('bothell');
    
    if (isRelevant) {
      found = true;
      console.log(`[${i+1}] ${title}`);
      console.log(`    URL: ${url.substring(0, 80)}`);
      console.log(`    Snippet: ${snippet.substring(0, 100)}...`);
    }
  });
  
  if (!found) {
    console.log('No relevant results found');
    // Show first 3 anyway
    $('li.b_algo').slice(0, 3).each((i, el) => {
      const title = $(el).find('h2').text().trim();
      console.log(`  [${i+1}] ${title.substring(0, 60)}`);
    });
  }
}

async function testDirectScrape() {
  console.log('\n=== Direct scrape of htccwa.org ===');
  try {
    const res = await axiosInstance.get('https://htccwa.org', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(res.data);
    const bodyText = $('body').text();
    
    // Find emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const emails = [...new Set(bodyText.match(emailRegex) || [])];
    console.log('Emails found:', emails);
    
    // Find phones
    const phoneRegex = /(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = [...new Set(bodyText.match(phoneRegex) || [])];
    console.log('Phones found:', phones.slice(0, 5));
    
    // Check contact page
    const contactLinks = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.toLowerCase().includes('contact')) {
        contactLinks.push(href);
      }
    });
    console.log('Contact links:', contactLinks.slice(0, 3));
    
  } catch (e) {
    console.log('Error:', e.message);
  }
}

async function run() {
  // Test various search strategies
  await testSearch('"Hindu Temple" "Cultural Center" Bothell WA');
  await testSearch('HTCC temple Bothell Washington');
  await testSearch('site:htccwa.org contact');
  await testSearch('Hindu temple 212th Street Bothell contact');
  
  // Test direct website scrape
  await testDirectScrape();
}

run().catch(console.error);
