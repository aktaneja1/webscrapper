/**
 * Client Application Logic for OmniScrape 2.0 (Concatenating Multi-Source Engine & Dynamic Theme Images)
 */

document.addEventListener('DOMContentLoaded', () => {
  const configCard = document.querySelector('.config-card');
  const scrapeForm = document.getElementById('scrape-form');
  const keywordInput = document.getElementById('keyword-input');
  const areaInput = document.getElementById('area-input');
  const depthSelect = document.getElementById('depth-select');
  const startBtn = document.getElementById('start-btn');

  const progressSection = document.getElementById('progress-section');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressPercent = document.getElementById('progress-percent');
  const consoleLogs = document.getElementById('console-logs');

  const statsSection = document.getElementById('stats-section');
  const statTotal = document.getElementById('stat-total');
  const statEmails = document.getElementById('stat-emails');
  const statPhones = document.getElementById('stat-phones');
  const statSources = document.getElementById('stat-sources');

  const resultsSection = document.getElementById('results-section');
  const resultsBadge = document.getElementById('results-badge');
  const leadsTbody = document.getElementById('leads-tbody');
  const tableFilter = document.getElementById('table-filter');

  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportJsonBtn = document.getElementById('export-json-btn');

  const modal = document.getElementById('lead-modal');
  const modalClose = document.getElementById('modal-close');
  const modalBody = document.getElementById('modal-body');

  let allLeads = [];
  let isRunning = false;

  // Category image dictionary for instant wowed background themes
  const CATEGORY_IMAGES = {
    '7-eleven': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80',
    'mcdonald': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80',
    'temple': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1600&q=80',
    'mosque': 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1600&q=80',
    'coffee': 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1600&q=80',
    'boutique': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80',
    'auto': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1600&q=80',
    'bakery': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1600&q=80',
    'dentist': 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1600&q=80'
  };

  /**
   * Dynamically sets background image of the search section based on search query
   */
  function updateSectionBackgroundImage(keyword) {
    if (!configCard || !keyword) return;

    const lower = keyword.toLowerCase();
    let imageUrl = null;

    // Check predefined category map
    for (const key of Object.keys(CATEGORY_IMAGES)) {
      if (lower.includes(key)) {
        imageUrl = CATEGORY_IMAGES[key];
        break;
      }
    }

    // Dynamic Unsplash fallback query if not in preset category map
    if (!imageUrl) {
      const cleanWord = encodeURIComponent(keyword.replace(/stores|shop|restaurant/gi, '').trim() || 'business');
      imageUrl = `https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1600&q=80`;
    }

    // Apply dark gradient overlay for text legibility
    configCard.style.backgroundImage = `linear-gradient(rgba(10, 13, 20, 0.82), rgba(10, 13, 20, 0.90)), url('${imageUrl}')`;
  }

  // Set initial background image
  updateSectionBackgroundImage(keywordInput.value);

  // Update background on input typing or change
  keywordInput.addEventListener('input', (e) => {
    updateSectionBackgroundImage(e.target.value);
  });

  // Preset button click handlers
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      keywordInput.value = btn.dataset.keyword;
      areaInput.value = btn.dataset.area;
      updateSectionBackgroundImage(btn.dataset.keyword);
    });
  });

  // Logger helper
  function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const logLine = document.createElement('div');
    logLine.className = `log-line ${type}`;
    logLine.textContent = `[${time}] ${message}`;
    consoleLogs.appendChild(logLine);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  // Form Submit Handler
  scrapeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isRunning) return;

    const keyword = keywordInput.value.trim();
    const area = areaInput.value.trim();
    const depthMode = depthSelect ? depthSelect.value : 'exhaustive';

    if (!keyword || !area) return;

    updateSectionBackgroundImage(keyword);

    // Reset UI State
    allLeads = [];
    leadsTbody.innerHTML = '';
    consoleLogs.innerHTML = '';
    isRunning = true;
    startBtn.disabled = true;
    startBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Researching & Concatenating...`;

    progressSection.classList.remove('hidden');
    statsSection.classList.remove('hidden');
    resultsSection.classList.remove('hidden');

    updateStats();
    updateProgress(0);

    addLog(`Initiating multi-platform search concatenation for "${keyword}" in "${area}" [Depth: ${depthMode}]...`, 'info');

    try {
      // Step 1: Geo Drill-down API call
      const drillRes = await fetch('/api/drilldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, area, depthMode })
      });

      const drillData = await drillRes.json();
      if (!drillRes.ok) throw new Error(drillData.error || 'Failed geo drilldown');

      addLog(`Region resolved: ${drillData.matchedRegion}. Total sub-area targets: ${drillData.totalTargets}`, 'success');

      const targets = drillData.targets;
      let completedTargets = 0;

      const selectedPlatforms = Array.from(document.querySelectorAll('input[name="platform"]:checked')).map(cb => cb.value);

      // Step 2: Iterate and scrape sub-areas sequentially
      for (const target of targets) {
        addLog(`Querying & Concatenating multi-engine results for: ${target.queryArea}...`, 'info');

        try {
          const scrapeRes = await fetch('/api/scrape-target', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword,
              target,
              priorityPlatforms: selectedPlatforms
            })
          });

          const scrapeData = await scrapeRes.json();
          if (scrapeRes.ok && scrapeData.leads) {
            scrapeData.leads.forEach(lead => {
              allLeads.push(lead);
              appendLeadRow(lead, allLeads.length);
            });
            addLog(`[Found ${scrapeData.leads.length} concatenated stores] in ${target.queryArea}`, 'success');
          } else {
            addLog(`No stores found in ${target.queryArea}`, 'warn');
          }
        } catch (err) {
          addLog(`Error querying ${target.queryArea}: ${err.message}`, 'error');
        }

        completedTargets++;
        const pct = Math.round((completedTargets / targets.length) * 100);
        updateProgress(pct);
        updateStats();
      }

      addLog(`Research & Concatenation complete! Total unique store leads acquired: ${allLeads.length}`, 'success');
    } catch (err) {
      addLog(`Execution error: ${err.message}`, 'error');
    } finally {
      isRunning = false;
      startBtn.disabled = false;
      startBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Start Exhaustive Multi-Source Search`;
    }
  });

  function updateProgress(pct) {
    progressBarFill.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}%`;
  }

  function updateStats() {
    statTotal.textContent = allLeads.length;
    const validEmails = allLeads.filter(l => l.email && l.email !== 'NA').length;
    const validPhones = allLeads.filter(l => l.phone && l.phone !== 'NA').length;

    let totalSourcesMerged = 0;
    allLeads.forEach(l => {
      if (Array.isArray(l.sources)) totalSourcesMerged += l.sources.length;
    });

    statEmails.textContent = validEmails;
    statPhones.textContent = validPhones;
    statSources.textContent = totalSourcesMerged;
    resultsBadge.textContent = `${allLeads.length} Unique Records`;
  }

  function appendLeadRow(lead, index) {
    const tr = document.createElement('tr');

    const emailDisplay = lead.email !== 'NA' 
      ? `<span class="email-badge"><i class="fa-solid fa-envelope"></i> ${lead.email}</span>` 
      : `<span class="na-badge">NA</span>`;

    const phoneDisplay = lead.phone !== 'NA' 
      ? `<span><i class="fa-solid fa-phone" style="color: var(--accent-blue); margin-right: 6px;"></i>${lead.phone}</span>` 
      : `<span class="na-badge">NA</span>`;

    const sourcesBadges = Array.isArray(lead.sources) 
      ? lead.sources.map(src => `<span class="source-badge">${src}</span>`).join('') 
      : `<span class="source-badge">Google Search</span>`;

    tr.innerHTML = `
      <td>${index}</td>
      <td><strong>${lead.name}</strong></td>
      <td>${lead.location}</td>
      <td>${lead.city}, ${lead.zipcode}</td>
      <td>${phoneDisplay}</td>
      <td>${emailDisplay}</td>
      <td><div>${sourcesBadges}</div></td>
      <td>
        <button class="btn btn-secondary view-btn" style="padding: 4px 10px; font-size: 12px;">
          <i class="fa-solid fa-eye"></i> Details
        </button>
      </td>
    `;

    tr.querySelector('.view-btn').addEventListener('click', () => openModal(lead));
    leadsTbody.appendChild(tr);
  }

  // Filter functionality
  tableFilter.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = leadsTbody.querySelectorAll('tr');
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });

  // Export handlers
  exportCsvBtn.addEventListener('click', () => exportData('csv'));
  exportJsonBtn.addEventListener('click', () => exportData('json'));

  async function exportData(format) {
    if (allLeads.length === 0) return alert('No lead data available to export.');

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: allLeads, format })
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scraped_leads.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(`Failed to export: ${err.message}`);
    }
  }

  // Modal logic
  function openModal(lead) {
    const sourcesList = Array.isArray(lead.sources) ? lead.sources.join(' + ') : 'Google Search';
    modalBody.innerHTML = `
      <div style="line-height: 1.8;">
        <h4 style="color: var(--accent-purple); font-size: 18px; margin-bottom: 12px;">${lead.name}</h4>
        <p><strong><i class="fa-solid fa-location-dot"></i> Physical Address:</strong> ${lead.location}</p>
        <p><strong><i class="fa-solid fa-city"></i> City & ZIP:</strong> ${lead.city}, ${lead.zipcode}</p>
        <p><strong><i class="fa-solid fa-phone"></i> Phone:</strong> ${lead.phone}</p>
        <p><strong><i class="fa-solid fa-envelope"></i> Email:</strong> ${lead.email}</p>
        <p><strong><i class="fa-solid fa-globe"></i> Website:</strong> ${lead.website !== 'NA' ? `<a href="${lead.website}" target="_blank" style="color: var(--accent-blue);">${lead.website}</a>` : 'NA'}</p>
        <p><strong><i class="fa-solid fa-code-merge"></i> Concatenated Platforms:</strong> <span style="color: var(--accent-green); font-weight: 600;">${sourcesList}</span></p>
        <hr style="border: none; border-top: 1px solid var(--bg-card-border); margin: 16px 0;">
        <h5 style="margin-bottom: 8px;">Social Media Accounts:</h5>
        <ul style="list-style: none; padding-left: 0;">
          <li><i class="fa-brands fa-facebook"></i> Facebook: ${lead.socials?.facebook !== 'NA' ? `<a href="${lead.socials.facebook}" target="_blank" style="color: var(--accent-blue);">${lead.socials.facebook}</a>` : 'NA'}</li>
          <li><i class="fa-brands fa-instagram"></i> Instagram: ${lead.socials?.instagram !== 'NA' ? `<a href="${lead.socials.instagram}" target="_blank" style="color: var(--accent-blue);">${lead.socials.instagram}</a>` : 'NA'}</li>
          <li><i class="fa-brands fa-tiktok"></i> TikTok: ${lead.socials?.tiktok !== 'NA' ? `<a href="${lead.socials.tiktok}" target="_blank" style="color: var(--accent-blue);">${lead.socials.tiktok}</a>` : 'NA'}</li>
        </ul>
      </div>
    `;
    modal.classList.remove('hidden');
  }

  modalClose.addEventListener('click', () => modal.classList.add('hidden'));
  window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
});
