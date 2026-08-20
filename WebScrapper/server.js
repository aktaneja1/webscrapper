const express = require('express');
const cors = require('cors');
const path = require('path');
const { drilldownArea, REGION_DATABASE } = require('./geoDrilldown');
const { searchTargetLocation } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3030;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Perform geographic breakdown on prompt & area
app.post('/api/drilldown', (req, res) => {
  const { keyword, area, depthMode } = req.body;
  if (!keyword || !area) {
    return res.status(400).json({ error: "Keyword and area parameters are required." });
  }

  const result = drilldownArea(area, depthMode || 'standard');
  res.json({
    keyword,
    area,
    matchedRegion: result.matchedRegion,
    isBroadArea: result.isBroadArea,
    totalTargets: result.targets.length,
    targets: result.targets
  });
});

// API: Scrape single geographic target (Zip code / City level)
app.post('/api/scrape-target', async (req, res) => {
  const { keyword, target, priorityPlatforms } = req.body;
  if (!keyword || !target) {
    return res.status(400).json({ error: "Keyword and target location parameters required." });
  }

  try {
    const leads = await searchTargetLocation(keyword, target, { priorityPlatforms });
    res.json({
      target: target.queryArea,
      leadCount: leads.length,
      leads: leads
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to scrape target", details: err.message });
  }
});

// API: Export lead data as CSV or JSON file
app.post('/api/export', (req, res) => {
  const { leads, format } = req.body;
  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({ error: "No leads data provided for export." });
  }

  if (format === 'csv') {
    const headers = ["Business Name", "Location", "City", "Zipcode", "Phone", "Email", "Website", "Sources", "Facebook", "Instagram", "TikTok"];
    const rows = leads.map(l => [
      `"${(l.name || 'NA').replace(/"/g, '""')}"`,
      `"${(l.location || 'NA').replace(/"/g, '""')}"`,
      `"${(l.city || 'NA').replace(/"/g, '""')}"`,
      `"${(l.zipcode || 'NA').replace(/"/g, '""')}"`,
      `"${(l.phone || 'NA').replace(/"/g, '""')}"`,
      `"${(l.email || 'NA').replace(/"/g, '""')}"`,
      `"${(l.website || 'NA').replace(/"/g, '""')}"`,
      `"${(Array.isArray(l.sources) ? l.sources.join(' + ') : 'NA').replace(/"/g, '""')}"`,
      `"${(l.socials?.facebook || 'NA').replace(/"/g, '""')}"`,
      `"${(l.socials?.instagram || 'NA').replace(/"/g, '""')}"`,
      `"${(l.socials?.tiktok || 'NA').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="scraped_business_leads.csv"');
    return res.send(csvContent);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="scraped_business_leads.json"');
  res.send(JSON.stringify(leads, null, 2));
});

// API: Get supported sample regions
app.get('/api/regions', (req, res) => {
  res.json(REGION_DATABASE);
});

app.listen(PORT, () => {
  console.log(`Web Scraper Service listening on http://localhost:${PORT}`);
});
