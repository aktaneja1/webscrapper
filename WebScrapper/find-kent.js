const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const ax = axios.create({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) });

async function findKentTemple() {
  // Try possible domains
  const urls = [
    'https://www.kentsikhtemple.com/',
    'https://kentsikhtemple.org/',
    'https://gurdwarakent.org/',
    'http://gurudwarateghbahadur.org/'
  ];
  
  console.log('Searching for Kent Gurdwara website...\n');
  
  for (const url of urls) {
    try {
      const res = await ax.get(url, { timeout: 10000, maxRedirects: 3, validateStatus: () => true });
      
      if (res.status === 200) {
        const $ = cheerio.load(res.data);
        const text = $('body').text();
        
        console.log('✓ Found:', url);
        
        const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        const phones = text.match(/\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g) || [];
        
        console.log('  Emails:', [...new Set(emails)].slice(0,3).join(', ') || 'none');
        console.log('  Phones:', [...new Set(phones)].slice(0,3).join(', ') || 'none');
        console.log();
      } else {
        console.log('✗ Status', res.status, ':', url);
      }
    } catch (e) {
      console.log('✗ Failed:', url, '-', e.code || e.message);
    }
  }
  
  // Also try the sikhscholarhub detail page directly  
  const detailUrl = 'https://directory.sikhscholarhub.com/gurdwara/washington/gurudwara-sri-guru-tegh-bahadur-sahib-ji';
  try {
    const res = await ax.get(detailUrl, { timeout: 10000 });
    const $ = cheerio.load(res.data);
    
    // Look for any links that might be their website
    console.log('\nLinks from Sikh Scholar Hub detail page:');
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('http') && !href.includes('sikhscholarhub') && !href.includes('google.com')) {
        console.log(' -', href);
      }
    });
    
    // Check for contact info
    const text = $('body').text();
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    console.log('\nEmails on page:', [...new Set(emails)].join(', ') || 'none');
    
  } catch(e) {
    console.log('Detail fetch failed:', e.message);
  }
}

findKentTemple();
