import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool, initDb } from './server/db.js';
import authRoutes from './server/routes/auth.js';
import adminRoutes from './server/routes/admin.js';
import { escapeHtml, sanitizeUrl } from './server/utils/html.js';
import { logActivity } from './server/utils/activity.js';
import { generateSubprocessorsPdf } from './server/utils/subprocessorsPdf.js';

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.set('trust proxy', 1);

  // Initialize Database
  try {
    console.log('Starting database initialization...');
    await initDb();
    console.log('Database initialization completed successfully.');
  } catch (error) {
    console.error('Database initialization failed:', error);
    // Continue starting the server even if DB init fails, 
    // but routes might fail later.
  }

  app.use(express.json());
  app.use(cookieParser());
  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
  }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Too many requests, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false
  });

  // Serve static files from public directory with nosniff
  app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static('public/uploads'));

  // API Routes
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);

  // Access requests submission endpoint
  app.post('/api/public/access-requests', async (req, res) => {
    try {
      const {
        documentName,
        documentType,
        productSlug,
        firstName,
        lastName,
        businessEmail,
        company,
        jobTitle,
        relationship,
        purpose,
        comments,
        ndaAccepted,
        ndaAcceptedAt
      } = req.body;

      if (!documentName || !firstName || !lastName || !businessEmail || !company) {
        return res.status(400).json({ error: 'Missing required request fields' });
      }

      const requesterFullName = `${firstName.trim()} ${lastName.trim()}`;
      const email = businessEmail.trim();
      const comp = company.trim();
      const rawIp = req.ip || req.socket.remoteAddress || '';
      const ip = rawIp.replace(/^::ffff:/, '');

      const [result]: any = await pool.query(`
        INSERT INTO access_requests (
          document_name, document_type, product_slug, requester_name, business_email,
          company, job_title, relationship, purpose, comments, nda_accepted, nda_accepted_at,
          status, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `, [
        documentName.trim(),
        documentType || 'compliance',
        productSlug || null,
        requesterFullName,
        email,
        comp,
        jobTitle ? jobTitle.trim() : null,
        relationship || 'Other',
        purpose ? purpose.trim() : '',
        comments ? comments.trim() : null,
        ndaAccepted ? 1 : 0,
        ndaAcceptedAt || new Date().toISOString(),
        ip
      ]);

      await logActivity({
        type: 'access_request',
        action: 'request_submitted',
        title: `Access requested for '${documentName.trim()}' by ${requesterFullName} (${comp})`,
        actor: email,
        target_type: 'document',
        target_name: documentName.trim(),
        status: 'pending',
        ip_address: ip,
        details: {
          requestId: result.insertId,
          documentName: documentName.trim(),
          requester: requesterFullName,
          email,
          company: comp,
          jobTitle,
          relationship,
          purpose,
          nda_accepted: !!ndaAccepted,
          nda_accepted_at: ndaAcceptedAt
        }
      });

      res.json({ success: true, id: result.insertId });
    } catch (err: any) {
      console.error('Error saving access request:', err);
      res.status(500).json({ error: 'Failed to record access request' });
    }
  });

  app.get('/api/public/pages', async (req, res) => {
    try {
      const [pages]: any = await pool.query('SELECT id, is_public FROM pages WHERE is_public = 1');
      res.json(pages.map((p: any) => p.id));
    } catch (err) {
      console.error('Error fetching public pages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/products', async (req, res) => {
    try {
      const country = req.query.country;
      let query = `
        SELECT p.slug, p.name, p.category, p.color, p.status_url, pcs.is_applicable
        FROM products p
        LEFT JOIN product_certification_summary pcs ON p.slug = pcs.product_slug
      `;
      const params: any[] = [];
      if (country && country !== 'all') {
        query += ` WHERE (
          EXISTS (SELECT 1 FROM product_countries pc WHERE pc.product_slug = p.slug AND pc.country = ?)
          OR NOT EXISTS (SELECT 1 FROM product_countries pc WHERE pc.product_slug = p.slug)
        )`;
        params.push(country);
      }
      const [products]: any = await pool.query(query, params);
      
      // Fetch countries for all products
      const [countries]: any = await pool.query('SELECT product_slug, country FROM product_countries');
      
      const productsWithCountries = products.map((p: any) => ({
        ...p,
        countries: countries.filter((c: any) => c.product_slug === p.slug).map((c: any) => c.country)
      }));
      
      res.json(productsWithCountries);
    } catch (err) {
      console.error('Error fetching public products:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-overrides', async (req, res) => {
    try {
      const [overrides]: any = await pool.query('SELECT product_slug, name, category, url FROM product_overrides');
      res.json(overrides);
    } catch (err) {
      console.error('Error fetching product overrides:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-security/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [security]: any = await pool.query('SELECT * FROM product_security WHERE product_slug = ?', [slug]);
      res.json(security[0] || null);
    } catch (err) {
      console.error('Error fetching product security:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-general/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [generalRows]: any = await pool.query('SELECT * FROM product_general_info WHERE product_slug = ?', [slug]);
      res.json(generalRows[0] || null);
    } catch (err) {
      console.error('Error fetching product general info:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-whitepaper/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const country = req.query.country as string;
      
      const [productRows]: any = await pool.query('SELECT * FROM products WHERE slug = ?', [slug]);
      if (!productRows || productRows.length === 0) {
        return res.status(404).send('<h1>Product Not Found</h1>');
      }
      const product = productRows[0];

      const [generalRows]: any = await pool.query('SELECT * FROM product_general_info WHERE product_slug = ?', [slug]);
      const general = generalRows[0] || {};

      const [securityRows]: any = await pool.query('SELECT * FROM product_security WHERE product_slug = ?', [slug]);
      const security = securityRows[0] || {};

      const [certSummaryRows]: any = await pool.query('SELECT * FROM product_certification_summary WHERE product_slug = ?', [slug]);
      const certSummary = certSummaryRows[0] || {};

      const [certs]: any = await pool.query('SELECT * FROM product_certifications WHERE product_slug = ?', [slug]);
      const [controls]: any = await pool.query('SELECT * FROM product_controls WHERE product_slug = ?', [slug]);
      const [policies]: any = await pool.query('SELECT * FROM product_policies WHERE product_slug = ?', [slug]);

      // Filter legal documents by selected country if query parameter is provided
      let legalDocsQuery = 'SELECT * FROM product_legal_documents WHERE product_slug = ? ORDER BY effective_date DESC';
      const [legalDocs]: any = await pool.query(legalDocsQuery, [slug]);

      // Fetch subprocessors with country filtering if query parameter is provided
      let querySub = 'SELECT * FROM product_subprocessors WHERE product_slug = ?';
      const paramsSub: any[] = [slug];
      if (country && country !== 'all') {
        querySub = `
          SELECT s.*
          FROM product_subprocessors s
          JOIN subprocessor_countries sc ON s.id = sc.subprocessor_id
          WHERE s.product_slug = ? AND sc.country = ?
        `;
        paramsSub.push(country);
      }
      const [subprocessors]: any = await pool.query(querySub, paramsSub);

      // Fetch countries for all subprocessors
      const [subCountries]: any = await pool.query('SELECT subprocessor_id, country FROM subprocessor_countries');
      const subprocessorsWithCountries = subprocessors.map((s: any) => ({
        ...s,
        countries: subCountries.filter((c: any) => c.subprocessor_id === s.id).map((c: any) => c.country)
      }));

      // fetch custom dashboard/site branding settings
      const [settingsRows]: any = await pool.query('SELECT "key", "value" FROM dashboard_settings');
      const settings: any = {};
      for (const s of settingsRows as any[]) {
        try {
          settings[s.key] = JSON.parse(s.value);
        } catch (e) {
          settings[s.key] = s.value;
        }
      }

      const siteName = settings.site_name || 'Bjorn Lunden';
      const siteLogo = settings.site_logo || '';

      // helpers
      const formatTopicName = (id: string) => {
        return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      };

      const getLegalDocName = (type: string) => {
        const mapping: Record<string, string> = {
          'tc': 'Terms and Conditions',
          'privacy': 'Privacy Notice',
          'dpa': 'Data Protection Agreement (DPA)',
          'exit': 'Data Exit Strategy Addendum',
          'sla': 'Service Level Agreement (SLA)'
        };
        return mapping[type] || type;
      };

      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="paper-size" content="A4">
  <title>${escapeHtml(product.name)} - Compliance &amp; Security Whitepaper</title>
  
  <!-- Typography CDN -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">

  <style>
    /* Absolute Base Styling for screen & print */
    :root {
      --primary: #1B3A6B;
      --primary-light: #2c5282;
      --accent-blue: #D0D8E4;
      --text-dark: #0f172a;
      --text-muted: #475569;
      --border-color: #D0D8E4;
      --bg-light: #F4F7FB;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #f1f5f9;
      color: var(--text-dark);
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Screen view wrapping */
    .screen-wrapper {
      max-width: 900px;
      margin: 40px auto;
      background: transparent;
      padding: 0;
    }

    /* Print Controls */
    .screen-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background-color: var(--primary);
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background-color 0.15s ease;
    }

    .btn-print:hover {
      background-color: var(--primary-light);
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }

    .btn-back:hover {
      color: var(--primary);
    }

    /* Standard A4 Flowing Page Container */
    .paper-page {
      background: #ffffff;
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 30px auto;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
      border-radius: 4px;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* Typographic definitions */
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 26pt;
      font-weight: 700;
      color: var(--primary);
      line-height: 1.2;
      margin-bottom: 8px;
    }

    h2 {
      font-family: 'Playfair Display', serif;
      font-size: 16pt;
      font-weight: 700;
      color: var(--primary);
      border-b: 1px solid var(--border-color);
      padding-bottom: 4px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }

    h3 {
      font-family: 'Inter', sans-serif;
      font-size: 11pt;
      font-weight: 600;
      color: var(--primary);
      margin-top: 12px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p {
      margin-bottom: 10px;
    }

    /* Logo block */
    .cover-band {
      background-color: var(--bg-light);
      border-left: 6px solid var(--primary);
      padding: 24px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .two-column-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 15px 0;
    }

    .control-card {
      border: 1px solid var(--border-color);
      padding: 12px;
      border-radius: 6px;
      background-color: #fafbfc;
    }

    .control-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .control-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: var(--primary);
    }

    .control-badge {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 3px;
      white-space: nowrap;
    }

    .badge-implemented {
      background-color: #e6fffa;
      color: #234e52;
    }

    .badge-partial {
      background-color: #feebc8;
      color: #744210;
    }

    .badge-not-implemented {
      background-color: #fed7d7;
      color: #742a2a;
    }

    .control-desc {
      font-size: 8.5pt;
      color: var(--text-dark);
      line-height: 1.4;
    }

    /* Table Styling */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 9pt;
    }

    th {
      background-color: var(--primary);
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid var(--primary);
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.05em;
    }

    td {
      padding: 8px 10px;
      border: 1px solid var(--border-color);
      color: var(--text-dark);
      background-color: #ffffff;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Footer structure */
    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      border-top: 1px solid var(--border-color);
      padding-top: 12px;
      font-size: 8.5pt;
      color: var(--text-muted);
    }

    /* CSS Print Block running header */
    .print-official-header {
      display: none;
    }

    @media print {
      .print-official-header {
        display: block !important;
        width: 100%;
        border-bottom: 2px solid var(--primary);
        padding-bottom: 8px;
        margin-bottom: 20px;
        font-family: 'Inter', sans-serif;
      }
      .print-official-header .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .print-official-header .company-name {
        font-size: 14pt !important;
        font-weight: 700 !important;
        text-transform: uppercase;
        color: var(--primary);
        letter-spacing: 0.1em;
      }
      .print-official-header .doc-reference {
        font-size: 8.5pt !important;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }
    }

    /* PRINT ONLY MEDIA BLOCK */
    @media print {
      body {
        background-color: #ffffff !important;
        color: #000000 !important;
        width: auto;
        height: auto;
      }

      .screen-controls {
        display: none !important;
      }

      .screen-wrapper {
        max-width: 100% !important;
        margin: 0 !important;
      }

      /* Native margin allocation */
      @page {
        size: A4 portrait;
        margin: 20mm;
      }

      .paper-page {
        width: 100% !important;
        min-height: 0 !important;
        height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
      }

      /* Orphan heading protections */
      h1, h2, h3, h4 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      tr, .two-column-block, table, .control-card {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .cover-band {
        background-color: var(--bg-light) !important;
        border-left: 6px solid var(--primary) !important;
      }
    }
  </style>
</head>
<body>

  <div class="screen-wrapper">
    <!-- Browser-Only Top Controls -->
    <div class="screen-controls">
      <a href="/product/${escapeHtml(slug)}" class="btn-back">
        ← Back to ${escapeHtml(product.name)} Registry
      </a>
      <button onclick="window.print()" class="btn-print">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save as PDF
      </button>
    </div>

    <div class="paper-page">
      <!-- Official PDF Document Running Header (visible during print) -->
      <div class="print-official-header">
        <div class="header-content">
          <span class="company-name">${escapeHtml(siteName)}</span>
          <span class="doc-reference">Official Security &amp; Compliance Whitepaper</span>
        </div>
      </div>

      <!-- Subtle Background Block / Corporate Header -->
      <div class="cover-band" style="position: relative;">
        ${siteLogo ? `
        <div style="position: absolute; top: 18px; right: 24px; display: flex; align-items: center; justify-content: flex-end;">
          <img src="${sanitizeUrl(siteLogo)}" alt="${escapeHtml(siteName)} Logo" style="max-height: 48px; max-width: 140px; object-fit: contain;" referrerPolicy="no-referrer" />
        </div>
        ` : ''}
        <div style="font-size: 8.5pt; font-weight: 700; letter-spacing: 0.15em; color: var(--primary); margin-bottom: 8px; max-width: 75%;">${escapeHtml(siteName).toUpperCase()}</div>
        <h1 style="max-width: 75%;">${escapeHtml(product.name)}</h1>
        <div style="font-size: 12pt; font-weight: 500; color: var(--text-muted); margin-top: 4px; max-width: 75%;">${escapeHtml(product.category || 'Compliance &amp; Security Registry')}</div>
      </div>

      <!-- General & Office Overview -->
      <section style="margin-top: 10px;">
        <h2>General &amp; Office Overview</h2>
        <div class="two-column-block" style="grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin: 4px 0 16px 0;">
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 4px;">Office Location</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.4; text-align: left; whitespace: pre-wrap;">
              ${general.office_location ? escapeHtml(general.office_location) : '<span style="color: #94a3b8; font-style: italic;">No office location listed.</span>'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 4px;">Contact Channels</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.4; text-align: left; whitespace: pre-wrap;">
              ${general.contact_info ? escapeHtml(general.contact_info) : '<span style="color: #94a3b8; font-style: italic;">No contact information listed.</span>'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 4px;">Opening Hours</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.4; text-align: left; whitespace: pre-wrap;">
              ${general.opening_hours ? escapeHtml(general.opening_hours) : '<span style="color: #94a3b8; font-style: italic;">No opening hours listed.</span>'}
            </p>
          </div>
        </div>
      </section>

      <!-- Security Overview Section -->
      <section style="margin-top: 10px;">
        <h2>Security Overview</h2>
        <div class="two-column-block" style="margin-top: 10px; gap: 12px;">
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Backup &amp; Recovery</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.backup ? escapeHtml(security.backup) : 'No information provided.'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Multi-Factor Authentication (MFA)</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.mfa === 1 || security.mfa === true || security.mfa === '1' ? 'Supported' : 'Not Supported'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Encryption</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.encryption ? escapeHtml(security.encryption) : 'No information provided.'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Single Sign-On (SSO)</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.sso === 1 || security.sso === true || security.sso === '1' ? 'Supported' : 'Not Supported'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">Data Residency</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.data_residency ? escapeHtml(security.data_residency) : 'No information provided.'}
            </p>
          </div>
          <div style="background-color: #fafbfc; border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px;">
            <strong style="color: var(--primary); font-size: 9pt; display: block; margin-bottom: 2px;">SLA Uptime</strong>
            <p style="margin: 0; font-size: 8.5pt; color: var(--text-dark); line-height: 1.35;">
              ${security.sla_uptime ? escapeHtml(security.sla_uptime) : 'No information provided.'}
            </p>
          </div>
        </div>
      </section>

      <!-- Controls Section -->
      <section style="margin-top: 15px;">
        <h2>Controls</h2>
        ${controls && controls.length > 0 ? `
          <div class="two-column-block" style="gap: 12px;">
            ${controls.map((ctrl: any) => `
              <div class="control-card">
                <div class="control-header">
                  <span class="control-title">${escapeHtml(formatTopicName(ctrl.topic_id))}</span>
                  <span class="control-badge ${
                    ctrl.status === 'Implemented' ? 'badge-implemented' : 
                    ctrl.status === 'Partial' ? 'badge-partial' : 
                    'badge-not-implemented'
                  }">
                    ${escapeHtml(ctrl.status)}
                  </span>
                </div>
                <p class="control-desc" style="margin-bottom: 0;">
                  ${ctrl.description ? escapeHtml(ctrl.description) : 'No description provided.'}
                </p>
              </div>
            `).join('')}
          </div>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No controls listed.</p>
        `}
      </section>

      <!-- Certifications & Reports Section -->
      <section style="margin-top: 15px;">
        <h2>Certifications &amp; Reports</h2>
        ${certs && certs.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Certification / Report</th>
                <th style="width: 50%;">Issuer</th>
              </tr>
            </thead>
            <tbody>
              ${certs.map((cert: any) => `
                <tr>
                  <td><strong>${escapeHtml(cert.name)}</strong></td>
                  <td>${cert.issuer ? escapeHtml(cert.issuer) : '<span style="color: #94a3b8; font-style: italic;">Not specified</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No certifications or reports listed.</p>
        `}
      </section>

      <!-- Policies Section -->
      <section style="margin-top: 15px;">
        <h2>Policies</h2>
        ${policies && policies.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 70%;">Policy Name</th>
                <th style="width: 30%;">Version</th>
              </tr>
            </thead>
            <tbody>
              ${policies.map((pol: any) => `
                <tr>
                  <td><strong>${escapeHtml(pol.name)}</strong></td>
                  <td>${pol.version ? escapeHtml(pol.version) : '<span style="color: #94a3b8; font-style: italic;">Not specified</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No policies listed.</p>
        `}
      </section>

      <!-- Legal Documents Section -->
      <section style="margin-top: 15px;">
        <h2>Legal Documents</h2>
        ${legalDocs && legalDocs.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 70%;">Document</th>
                <th style="width: 30%;">Version</th>
              </tr>
            </thead>
            <tbody>
              ${legalDocs.map((doc: any) => `
                <tr>
                  <td><strong>${escapeHtml(getLegalDocName(doc.document_type))}</strong></td>
                  <td>${doc.version ? escapeHtml(doc.version) : '<span style="color: #94a3b8; font-style: italic;">Not specified</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No legal documents listed.</p>
        `}
      </section>

      <!-- Subprocessors Section -->
      <section style="margin-top: 15px;">
        <h2>Subprocessors &amp; Data Processors</h2>
        ${subprocessorsWithCountries && subprocessorsWithCountries.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">Subprocessor &amp; Contact</th>
                <th style="width: 14%;">Purposes</th>
                <th style="width: 18%;">Categories of Data</th>
                <th style="width: 15%;">Recipients &amp; Transfers</th>
                <th style="width: 13%;">Retention</th>
                <th style="width: 20%;">Security Measures (TOMs)</th>
              </tr>
            </thead>
            <tbody>
              ${subprocessorsWithCountries.map((sub: any) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(sub.name)}</strong>
                    ${sub.contact_details ? `<div style="font-size: 8pt; color: var(--text-muted); margin-top: 3px;">${escapeHtml(sub.contact_details)}</div>` : ''}
                    ${sub.org_number ? `<div style="font-size: 7.5pt; color: var(--text-muted); margin-top: 2px;">Org: ${escapeHtml(sub.org_number)}</div>` : ''}
                  </td>
                  <td>
                    ${escapeHtml(sub.purpose || 'Not specified')}
                    ${sub.nature_of_processing ? `<div style="font-size: 7.5pt; color: var(--text-muted); margin-top: 3px;"><em>${escapeHtml(sub.nature_of_processing)}</em></div>` : ''}
                  </td>
                  <td>${sub.data_categories ? escapeHtml(sub.data_categories) : '<span style="color: #94a3b8; font-style: italic;">Standard system telemetry</span>'}</td>
                  <td>
                    <div><strong>Region:</strong> ${escapeHtml(sub.region)}</div>
                    ${sub.transfers ? `<div style="font-size: 8pt; color: var(--text-muted); margin-top: 3px;">${escapeHtml(sub.transfers)}</div>` : ''}
                    ${sub.recipients ? `<div style="font-size: 8pt; color: var(--text-muted); margin-top: 3px;"><strong>Recipients:</strong> ${escapeHtml(sub.recipients)}</div>` : ''}
                  </td>
                  <td>${sub.retention ? escapeHtml(sub.retention) : '<span style="color: #94a3b8; font-style: italic;">Duration of contract</span>'}</td>
                  <td>
                    ${sub.security_measures ? `<div style="font-size: 8pt;">${escapeHtml(sub.security_measures)}</div>` : 'Technical &amp; organizational security controls.'}
                    ${sub.certifications ? `<div style="font-size: 7.5pt; color: #166534; font-weight: 600; margin-top: 4px;">🛡️ ${escapeHtml(sub.certifications)}</div>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <p style="font-size: 9pt; color: var(--text-muted); font-style: italic;">No subprocessors or data processors listed.</p>
        `}
      </section>

      <!-- Page Footer -->
      <footer class="page-footer" style="margin-top: auto;">
        <span>${escapeHtml(product.name)} Compliance &amp; Security | ${escapeHtml(siteName)}</span>
        <span>Generated: ${escapeHtml(dateStr)}</span>
      </footer>
    </div>
  </div>

</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      console.error('Error generating product whitepaper:', err);
      res.status(500).send('<h1>Internal Server Error</h1><p>Failed to generate white paper.</p>');
    }
  });

  app.get('/api/public/nda-whitepaper', async (req, res) => {
    try {
      // fetch custom dashboard/site branding settings
      const [settingsRows]: any = await pool.query('SELECT "key", "value" FROM dashboard_settings');
      const settings: any = {};
      for (const s of settingsRows as any[]) {
        try {
          settings[s.key] = JSON.parse(s.value);
        } catch (e) {
          settings[s.key] = s.value;
        }
      }

      const [currentNda]: any = await pool.query('SELECT * FROM nda_versions WHERE is_current = 1 LIMIT 1');
      const nda = currentNda?.[0] || null;

      const siteName = settings.site_name || 'Bjorn Lunden';
      const siteLogo = settings.site_logo || '';
      const version = nda?.version || settings.nda_version || '1.1.0';
      const effectiveDate = nda?.effective_date || settings.nda_effective_date || '2025-01-01';
      const formattedDate = new Date(effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      
      const ndaBodyHtml = nda?.content || settings.nda_notice || `
        <h2>Non-Disclosure Agreement (NDA)</h2>
        <p>This Non-Disclosure Agreement ("Agreement") governs the disclosure of confidential, proprietary, security, and compliance documentation by <strong>${escapeHtml(siteName)}</strong> and its affiliates ("Disclosing Party") to the requesting organization and its representatives ("Receiving Party").</p>
        
        <h3>1. Purpose</h3>
        <p>The Receiving Party has requested access to confidential documentation, including but not limited to third-party audit reports (such as ISAE 3402, SOC 2, ISO 27001), penetration testing summaries, data protection impact assessments (DPIAs), architectural specifications, and internal security policies via the Trust Center ("Purpose").</p>
        
        <h3>2. Confidential Information</h3>
        <p>Confidential Information includes all non-public technical, operational, organizational, and compliance information disclosed through the Trust Center, whether in tangible, electronic, or visual form. All copies of policies, risk assessments, and audit reports are strictly Confidential Information.</p>
        
        <h3>3. Obligations of Receiving Party</h3>
        <p>The Receiving Party agrees to:</p>
        <ul>
          <li>Protect and preserve the confidentiality of the Confidential Information using at least reasonable care and no less than the care used for its own confidential information.</li>
          <li>Use Confidential Information solely for evaluating ${escapeHtml(siteName)}'s security, privacy, and compliance posture for the stated Purpose.</li>
          <li>Restrict access strictly to employees, contractors, and advisors who strictly require access for the Purpose and are bound by confidentiality obligations at least as restrictive as this Agreement.</li>
          <li>Not disclose, publish, reverse-engineer, distribute, or make available any Confidential Information to third parties without prior written consent.</li>
        </ul>
        
        <h3>4. Electronic Watermarking &amp; Traceability</h3>
        <p>The Receiving Party acknowledges that requested documents and policies are electronically watermarked with recipient identifiers (e.g. name, email, company, and timestamp). Tampering with or altering watermarks is strictly prohibited.</p>
        
        <h3>5. Duration</h3>
        <p>Confidentiality obligations under this Agreement shall remain in effect for a period of three (3) years from the date of disclosure, or perpetually for information constituting trade secrets under applicable law.</p>
        
        <h3>6. Governing Law</h3>
        <p>This Agreement is governed by and construed in accordance with the laws of Sweden. Any disputes arising in connection with this Agreement shall be settled by the competent courts of Sweden.</p>
      `;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="paper-size" content="A4">
  <title>Non-Disclosure Agreement (NDA) - ${escapeHtml(siteName)} Trust Center</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root {
      --primary: #1B3A6B;
      --primary-light: #2c5282;
      --accent-blue: #D0D8E4;
      --text-dark: #0f172a;
      --text-muted: #475569;
      --border-color: #D0D8E4;
      --bg-light: #F4F7FB;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: #f1f5f9;
      color: var(--text-dark);
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .screen-wrapper {
      max-width: 860px;
      margin: 40px auto;
      background: transparent;
      padding: 0;
    }

    .screen-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      gap: 16px;
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background-color: #ffffff;
      color: var(--text-dark);
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 9pt;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      transition: all 0.2s;
    }
    .btn-back:hover { background-color: #f8fafc; border-color: #94a3b8; }

    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 20px;
      background-color: var(--primary);
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 9pt;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(27,58,107,0.25);
      transition: background 0.2s, transform 0.1s;
    }
    .btn-print:hover { background-color: #142a4e; transform: translateY(-1px); }

    .paper-page {
      background: #ffffff;
      padding: 60px 65px;
      border-radius: 8px;
      box-shadow: 0 10px 30px -5px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1);
      position: relative;
    }

    .print-official-header { display: none; }

    .cover-band {
      background-color: var(--bg-light);
      border-left: 5px solid var(--primary);
      padding: 24px 28px;
      margin-bottom: 30px;
      border-radius: 4px;
    }

    .cover-band h1 {
      font-size: 22pt;
      font-weight: 700;
      color: var(--primary);
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }

    .meta-badge-row {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 8.5pt;
      color: var(--text-muted);
      margin-top: 6px;
      flex-wrap: wrap;
    }

    .meta-badge {
      display: inline-block;
      padding: 2px 8px;
      background-color: #e2e8f0;
      color: #334155;
      font-weight: 600;
      border-radius: 4px;
      font-size: 8pt;
    }

    .meta-badge.active {
      background-color: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    .legal-content {
      color: #1e293b;
      font-size: 10pt;
      line-height: 1.7;
    }

    .legal-content h2 {
      font-size: 14pt;
      color: var(--primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
    }

    .legal-content h3 {
      font-size: 11.5pt;
      color: var(--text-dark);
      margin-top: 18px;
      margin-bottom: 6px;
    }

    .legal-content p {
      margin-bottom: 12px;
    }

    .legal-content ul, .legal-content ol {
      margin-left: 24px;
      margin-bottom: 14px;
    }

    .legal-content li {
      margin-bottom: 6px;
    }

    .legal-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: var(--text-muted);
    }

    @media print {
      @page {
        size: A4;
        margin: 18mm 16mm 18mm 16mm;
      }
      body {
        background-color: #ffffff !important;
        font-size: 9.5pt;
      }
      .screen-controls { display: none !important; }
      .screen-wrapper { margin: 0 !important; max-width: 100% !important; }
      .paper-page {
        padding: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .print-official-header {
        display: block !important;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
        font-size: 8pt;
        color: var(--text-muted);
        display: flex !important;
        justify-content: space-between;
      }
      .cover-band {
        background-color: #f8fafc !important;
        border-left: 4px solid var(--primary) !important;
        padding: 16px 20px !important;
        margin-bottom: 20px !important;
      }
      .legal-content h2, .legal-content h3 {
        page-break-after: avoid;
        break-after: avoid;
      }
      .legal-footer {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <div class="screen-wrapper">
    <div class="screen-controls">
      <a href="/nda" class="btn-back">
        ← Back to NDA
      </a>
      <button onclick="window.print()" class="btn-print">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save as PDF
      </button>
    </div>

    <div class="paper-page">
      <div class="print-official-header">
        <span>${escapeHtml(siteName)} Trust Center</span>
        <span>Official Non-Disclosure Agreement (NDA) • Version ${escapeHtml(version)}</span>
      </div>

      <div class="cover-band" style="position: relative;">
        ${siteLogo ? `
        <div style="position: absolute; top: 16px; right: 20px; display: flex; align-items: center;">
          <img src="${sanitizeUrl(siteLogo)}" alt="${escapeHtml(siteName)} Logo" style="max-height: 42px; max-width: 140px; object-fit: contain;" referrerPolicy="no-referrer" />
        </div>
        ` : ''}
        <div style="font-size: 8.5pt; font-weight: 700; letter-spacing: 0.12em; color: var(--primary); margin-bottom: 6px; text-transform: uppercase;">${escapeHtml(siteName)} Trust Center</div>
        <h1>Non-Disclosure Agreement (NDA)</h1>
        <div class="meta-badge-row">
          <span class="meta-badge active">Active Agreement</span>
          <span class="meta-badge">Version ${escapeHtml(version)}</span>
          <span>Effective Date: <strong>${escapeHtml(formattedDate)}</strong></span>
          <span>• Restricted Document &amp; Policy Requests</span>
        </div>
      </div>

      <div class="legal-content">
        ${ndaBodyHtml}
      </div>

      <div class="legal-footer">
        <span>${escapeHtml(siteName)} Trust Center • Official Legal Instrument</span>
        <span>Generated: ${escapeHtml(generatedDate)}</span>
      </div>
    </div>
  </div>

  <script>
    // Trigger print dialog automatically if requested via URL
    if (new URLSearchParams(window.location.search).get('print') === 'true') {
      window.addEventListener('load', () => {
        setTimeout(() => window.print(), 350);
      });
    }
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      console.error('Error generating NDA whitepaper:', err);
      res.status(500).send('<h1>Internal Server Error</h1><p>Failed to generate NDA document.</p>');
    }
  });

  app.get('/api/public/subprocessors-pdf/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const country = req.query.country as string;

      const [productRows]: any = await pool.query('SELECT * FROM products WHERE slug = ?', [slug]);
      if (!productRows || productRows.length === 0) {
        return res.status(404).json({ error: 'Product Not Found' });
      }
      const product = productRows[0];

      let querySub = 'SELECT * FROM product_subprocessors WHERE product_slug = ?';
      const paramsSub: any[] = [slug];
      if (country && country !== 'all') {
        querySub = `
          SELECT s.*
          FROM product_subprocessors s
          JOIN subprocessor_countries sc ON s.id = sc.subprocessor_id
          WHERE s.product_slug = ? AND sc.country = ?
        `;
        paramsSub.push(country);
      }
      const [subprocessors]: any = await pool.query(querySub, paramsSub);

      const [subCountries]: any = await pool.query('SELECT subprocessor_id, country FROM subprocessor_countries');
      const subprocessorsWithCountries = subprocessors.map((s: any) => ({
        ...s,
        countries: subCountries.filter((c: any) => c.subprocessor_id === s.id).map((c: any) => c.country)
      }));

      const [historyRows]: any = await pool.query('SELECT * FROM subprocessor_history WHERE product_slug = ? ORDER BY date DESC', [slug]);
      const history = historyRows || [];

      const [settingsRows]: any = await pool.query('SELECT "key", "value" FROM dashboard_settings');
      const settings: any = {};
      for (const s of settingsRows as any[]) {
        try {
          settings[s.key] = JSON.parse(s.value);
        } catch (e) {
          settings[s.key] = s.value;
        }
      }

      const pdfBytes = await generateSubprocessorsPdf({
        product,
        subprocessors: subprocessorsWithCountries,
        history,
        settings,
        country
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${slug}-authorized-subprocessors.pdf"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.end(Buffer.from(pdfBytes));
    } catch (err) {
      console.error('Error generating subprocessors PDF:', err);
      res.status(500).json({ error: 'Failed to generate PDF document' });
    }
  });

  app.get('/api/public/subprocessors-whitepaper/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const country = req.query.country as string;

      const [productRows]: any = await pool.query('SELECT * FROM products WHERE slug = ?', [slug]);
      if (!productRows || productRows.length === 0) {
        return res.status(404).send('<h1>Product Not Found</h1>');
      }
      const product = productRows[0];

      // Fetch subprocessors with country filtering if query parameter is provided
      let querySub = 'SELECT * FROM product_subprocessors WHERE product_slug = ?';
      const paramsSub: any[] = [slug];
      if (country && country !== 'all') {
        querySub = `
          SELECT s.*
          FROM product_subprocessors s
          JOIN subprocessor_countries sc ON s.id = sc.subprocessor_id
          WHERE s.product_slug = ? AND sc.country = ?
        `;
        paramsSub.push(country);
      }
      const [subprocessors]: any = await pool.query(querySub, paramsSub);

      // Fetch countries for all subprocessors
      const [subCountries]: any = await pool.query('SELECT subprocessor_id, country FROM subprocessor_countries');
      const subprocessorsWithCountries = subprocessors.map((s: any) => ({
        ...s,
        countries: subCountries.filter((c: any) => c.subprocessor_id === s.id).map((c: any) => c.country)
      }));

      // Fetch history / alteration registry
      const [historyRows]: any = await pool.query('SELECT * FROM subprocessor_history WHERE product_slug = ? ORDER BY date DESC', [slug]);
      const history = historyRows || [];

      // Fetch site settings
      const [settingsRows]: any = await pool.query('SELECT "key", "value" FROM dashboard_settings');
      const settings: any = {};
      for (const s of settingsRows as any[]) {
        try {
          settings[s.key] = JSON.parse(s.value);
        } catch (e) {
          settings[s.key] = s.value;
        }
      }

      const siteName = settings.site_name || 'Bjorn Lunden';
      const mailtoLegal = settings.mailto_legal || 'security@bjornlunden.com';
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const scopeStr = country && country !== 'all' ? `Filtered by Jurisdiction: ${country.toUpperCase()}` : 'Global Jurisdiction (All Scope)';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(product.name)} - Authorized Subprocessors &amp; Registry of Alterations</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0f172a;
      --primary-accent: #2563eb;
      --border-color: #cbd5e1;
      --text-dark: #0f172a;
      --text-muted: #475569;
      --bg-slate: #f8fafc;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #f1f5f9;
      color: var(--text-dark);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 9pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .screen-wrapper {
      max-width: 1040px;
      margin: 30px auto;
      padding: 0 16px;
    }
    .screen-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background-color: #0f172a;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background-color 0.15s ease;
    }
    .btn-print:hover {
      background-color: #1e293b;
    }
    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
    .btn-back:hover {
      color: #0f172a;
    }
    .document-page {
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
    }
    .header-section {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    .header-left h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .header-left .product-badge {
      display: inline-block;
      margin-top: 6px;
      font-size: 11pt;
      font-weight: 700;
      color: #2563eb;
    }
    .header-left .meta-text {
      color: var(--text-muted);
      font-size: 8.5pt;
      margin-top: 4px;
    }
    .header-right {
      text-align: right;
      font-size: 8pt;
      color: var(--text-muted);
    }
    .header-right .certified-badge {
      display: inline-block;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .notice-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #2563eb;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 8.5pt;
      color: #334155;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    .section-title {
      font-size: 13pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 24px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .section-title span.count {
      font-size: 9pt;
      font-weight: 600;
      color: #64748b;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 28px;
      page-break-inside: auto;
    }
    table.data-table tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    table.data-table th {
      background-color: #f8fafc;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 7.5pt;
      letter-spacing: 0.05em;
      padding: 10px 8px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    table.data-table td {
      padding: 10px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
      color: #1e293b;
    }
    table.data-table tr:nth-child(even) td {
      background-color: #fafbfc;
    }
    .sub-name {
      font-weight: 700;
      color: #0f172a;
      font-size: 9pt;
    }
    .sub-meta {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 2px;
    }
    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 600;
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      color: #475569;
      margin: 1px;
    }
    .badge-safeguard {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e40af;
    }
    .doc-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 14px;
      margin-top: 30px;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 12mm 15mm 12mm;
      }
      body {
        background-color: #ffffff !important;
      }
      .screen-wrapper {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      .screen-controls {
        display: none !important;
      }
      .document-page {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
      table.data-table th {
        background-color: #f1f5f9 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
  <script>
    window.onload = function() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('print') === 'true' || urlParams.get('autoprint') !== 'false') {
        setTimeout(function() {
          window.print();
        }, 500);
      }
    };
  </script>
</head>
<body>
  <div class="screen-wrapper">
    <div class="screen-controls">
      <a href="/subprocessors/${escapeHtml(slug)}" class="btn-back">
        ← Back to ${escapeHtml(product.name)} Subprocessors
      </a>
      <div style="display: flex; gap: 10px; align-items: center;">
        <a href="/api/public/subprocessors-pdf/${escapeHtml(slug)}${country && country !== 'all' ? `?country=${escapeHtml(country)}` : ''}" class="btn-print" style="background-color: #2563eb;" download="${escapeHtml(slug)}-authorized-subprocessors.pdf">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download PDF
        </a>
        <button onclick="window.print()" class="btn-print">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          Print / Save PDF
        </button>
      </div>
    </div>

    <div class="document-page">
      <div class="header-section">
        <div class="header-left">
          <div style="font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb; margin-bottom: 4px;">
            ${escapeHtml(siteName)} Trust Center
          </div>
          <h1>Authorized Subprocessors &amp; Alterations</h1>
          <div class="product-badge">Product: ${escapeHtml(product.name)}</div>
          <div class="meta-text">${escapeHtml(scopeStr)} • Published under GDPR Article 28</div>
        </div>
        <div class="header-right">
          <div class="certified-badge">Certified Registry</div>
          <div>Date: <strong>${escapeHtml(dateStr)}</strong></div>
          <div style="margin-top: 3px;">Reference: SUB-${escapeHtml(product.slug).toUpperCase()}</div>
          <div style="margin-top: 3px;">Contact: <a href="mailto:${escapeHtml(mailtoLegal)}" style="color: inherit;">${escapeHtml(mailtoLegal)}</a></div>
        </div>
      </div>

      <div class="notice-box">
        <strong>Legal Disclosure &amp; Scope:</strong> This document certifies all current authorized third-party subprocessors engaged to support data processing activities for <strong>${escapeHtml(product.name)}</strong>, together with the official registry of historical alterations. Pursuant to applicable Data Processing Agreements and GDPR standards, all listed entities are contractually bound to confidentiality, data security, and compliance guarantees at least as stringent as those agreed with the customer.
      </div>

      <!-- SECTION 1: CURRENT AUTHORIZED SUBPROCESSORS -->
      <div class="section-title">
        <span>1. Current Authorized Subprocessors</span>
        <span class="count">${subprocessorsWithCountries.length} Entity${subprocessorsWithCountries.length === 1 ? '' : 'ies'} Registered</span>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 22%;">Subprocessor / Identity</th>
            <th style="width: 14%;">Category</th>
            <th style="width: 26%;">Processing Activities &amp; Purpose</th>
            <th style="width: 18%;">Location &amp; Scope</th>
            <th style="width: 20%;">Safeguards &amp; Certifications</th>
          </tr>
        </thead>
        <tbody>
          ${subprocessorsWithCountries.map((sub: any) => `
            <tr>
              <td>
                <div class="sub-name">${escapeHtml(sub.name)}</div>
                ${sub.org_number ? `<div class="sub-meta">Org: ${escapeHtml(sub.org_number)}</div>` : ''}
                ${sub.lei_number ? `<div class="sub-meta">LEI: ${escapeHtml(sub.lei_number)}</div>` : ''}
                ${sub.contact_details ? `<div class="sub-meta">${escapeHtml(sub.contact_details)}</div>` : ''}
              </td>
              <td>
                <span class="badge">${escapeHtml(sub.category || 'Service Provider')}</span>
              </td>
              <td>
                <div style="font-weight: 600; color: #1e293b;">${escapeHtml(sub.purpose || 'Infrastructure & Processing')}</div>
                ${sub.nature_of_processing ? `<div class="sub-meta" style="margin-top: 4px;"><em>${escapeHtml(sub.nature_of_processing)}</em></div>` : ''}
                ${sub.data_categories ? `<div class="sub-meta" style="margin-top: 3px;"><strong>Data:</strong> ${escapeHtml(sub.data_categories)}</div>` : ''}
              </td>
              <td>
                <div><strong>${escapeHtml(sub.region || 'EU / Global')}</strong></div>
                ${sub.countries && sub.countries.length > 0 ? `
                  <div style="margin-top: 4px;">
                    ${sub.countries.map((c: string) => `<span class="badge">${escapeHtml(c.toUpperCase())}</span>`).join(' ')}
                  </div>
                ` : ''}
                ${sub.retention ? `<div class="sub-meta" style="margin-top: 3px;"><strong>Retention:</strong> ${escapeHtml(sub.retention)}</div>` : ''}
              </td>
              <td>
                <div>${sub.security_measures ? escapeHtml(sub.security_measures) : 'Technical &amp; organizational controls'}</div>
                ${sub.certifications ? `<div class="sub-meta" style="color: #065f46; font-weight: 600; margin-top: 4px;">🛡️ ${escapeHtml(sub.certifications)}</div>` : ''}
                ${sub.transfers ? `<div class="sub-meta" style="margin-top: 3px;"><span class="badge badge-safeguard">${escapeHtml(sub.transfers)}</span></div>` : ''}
                <div class="sub-meta" style="margin-top: 3px;">DPA: ${sub.dpa_url ? 'Executed &amp; Verified' : sub.dpa_requestable ? 'Available on Request' : 'Standard Art. 28 Terms'}</div>
              </td>
            </tr>
          `).join('')}
          ${subprocessorsWithCountries.length === 0 ? `
            <tr>
              <td colspan="5" style="text-align: center; color: #94a3b8; padding: 24px;">No subprocessors registered for this product.</td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- SECTION 2: REGISTRY OF ALTERATIONS -->
      <div class="section-title">
        <span>2. Registry of Alterations</span>
        <span class="count">${history.length} Record${history.length === 1 ? '' : 's'}</span>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 14%;">Version</th>
            <th style="width: 18%;">Effective Date</th>
            <th style="width: 68%;">Description of Alteration &amp; Change Log</th>
          </tr>
        </thead>
        <tbody>
          ${history.map((h: any) => `
            <tr>
              <td>
                <span class="badge" style="font-family: monospace; font-weight: 700; font-size: 8.5pt;">v${escapeHtml(h.version)}</span>
              </td>
              <td style="font-weight: 600; color: #334155;">
                ${escapeHtml(h.date)}
              </td>
              <td style="line-height: 1.5; color: #1e293b;">
                ${escapeHtml(h.description)}
              </td>
            </tr>
          `).join('')}
          ${history.length === 0 ? `
            <tr>
              <td colspan="3" style="text-align: center; color: #94a3b8; padding: 20px;">No historical alterations recorded for this product.</td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <div class="doc-footer">
        <div>
          <span>${escapeHtml(siteName)} Trust Center</span> • Official Compliance Publication • ${escapeHtml(product.name)}
        </div>
        <div>
          Inquiries: <a href="mailto:${escapeHtml(mailtoLegal)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(mailtoLegal)}</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      console.error('Error generating subprocessors whitepaper:', err);
      res.status(500).send('<h1>Internal Server Error</h1><p>Failed to generate subprocessors whitepaper.</p>');
    }
  });

  app.get('/api/public/product-certifications/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [summaryRows]: any = await pool.query('SELECT * FROM product_certification_summary WHERE product_slug = ?', [slug]);
      const [certifications]: any = await pool.query('SELECT * FROM product_certifications WHERE product_slug = ?', [slug]);
      res.json({ summary: summaryRows[0] || null, certifications });
    } catch (err) {
      console.error('Error fetching product certifications:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-controls/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [controls]: any = await pool.query('SELECT * FROM product_controls WHERE product_slug = ?', [slug]);
      res.json(controls);
    } catch (err) {
      console.error('Error fetching product controls:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-subprocessors/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const country = req.query.country;
      let querySub = 'SELECT * FROM product_subprocessors WHERE product_slug = ?';
      let queryHist = 'SELECT * FROM subprocessor_history WHERE product_slug = ? ORDER BY date DESC';
      const paramsSub: any[] = [slug];
      const paramsHist: any[] = [slug];
      
      if (country) {
        querySub = `
          SELECT s.*
          FROM product_subprocessors s
          JOIN subprocessor_countries sc ON s.id = sc.subprocessor_id
          WHERE s.product_slug = ? AND sc.country = ?
        `;
        paramsSub.push(country);
      }
      
      const [subprocessors]: any = await pool.query(querySub, paramsSub);
      const [history]: any = await pool.query(queryHist, paramsHist);
      
      // Fetch countries for subprocessors
      const [countries]: any = await pool.query('SELECT subprocessor_id, country FROM subprocessor_countries');
      
      const subprocessorsWithCountries = subprocessors.map((s: any) => ({
        ...s,
        countries: countries.filter((c: any) => c.subprocessor_id === s.id).map((c: any) => c.country)
      }));

      res.json({ subprocessors: subprocessorsWithCountries, history });
    } catch (err) {
      console.error('Error fetching product subprocessors:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-legal/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const country = req.query.country;
      const query = 'SELECT * FROM product_legal_documents WHERE product_slug = ? ORDER BY effective_date DESC';
      const [documents]: any = await pool.query(query, [slug]);
      
      res.json(documents);
    } catch (err) {
      console.error('Error fetching product legal documents:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/product-policies/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [policies]: any = await pool.query('SELECT * FROM product_policies WHERE product_slug = ?', [slug]);
      res.json(policies);
    } catch (err) {
      console.error('Error fetching product policies:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/public/metrics/track', async (req, res) => {
    try {
      const { event_type, product_slug, item_name, user_email } = req.body;
      if (!event_type || !product_slug) {
        return res.status(400).json({ error: 'event_type and product_slug are required' });
      }
      
      await pool.query(
        'INSERT INTO metrics_events (event_type, product_slug, item_name, user_email) VALUES (?, ?, ?, ?)',
        [event_type, product_slug, item_name || '', user_email || null]
      );
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error tracking metric:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/public/subscribe', async (req, res) => {
    try {
      const { email, type = 'controls', product_slug } = req.body;
      if (!email || !product_slug) {
        return res.status(400).json({ error: 'Email and product are required' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const [existing]: any = await pool.query(
        'SELECT id, status FROM subscriptions WHERE email = ? AND type = ? AND product_slug = ?',
        [cleanEmail, type, product_slug]
      );

      if (existing && existing.length > 0) {
        await pool.query('UPDATE subscriptions SET status = ? WHERE id = ?', ['active', existing[0].id]);
        return res.json({ success: true, message: 'Subscription updated to active', status: 'active' });
      }

      await pool.query(
        'INSERT INTO subscriptions (email, type, product_slug, status) VALUES (?, ?, ?, ?)',
        [cleanEmail, type, product_slug, 'active']
      );

      // Track metric
      await pool.query(
        'INSERT INTO metrics_events (event_type, product_slug, item_name, user_email) VALUES (?, ?, ?, ?)',
        ['subscription', product_slug, `${type}_subscription`, cleanEmail]
      ).catch(() => {});

      res.json({ success: true, message: 'Subscription successful', status: 'active' });
    } catch (err) {
      console.error('Error in public subscribe:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/public/unsubscribe', async (req, res) => {
    try {
      const { email, type = 'controls', product_slug } = req.body;
      if (!email || !product_slug) {
        return res.status(400).json({ error: 'Email and product are required' });
      }

      const cleanEmail = email.trim().toLowerCase();
      await pool.query(
        'UPDATE subscriptions SET status = ? WHERE email = ? AND type = ? AND product_slug = ?',
        ['cancelled', cleanEmail, type, product_slug]
      );

      res.json({ success: true, message: 'Subscription cancelled', status: 'cancelled' });
    } catch (err) {
      console.error('Error in public unsubscribe:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/subscription-stats', async (req, res) => {
    try {
      const { product_slug, type = 'controls' } = req.query;
      let query = 'SELECT status, count(*) as count FROM subscriptions WHERE type = ?';
      const params: any[] = [type];
      if (product_slug && product_slug !== 'all') {
        query += ' AND product_slug = ?';
        params.push(product_slug);
      }
      query += ' GROUP BY status';

      const [rows]: any = await pool.query(query, params);
      const stats = { active: 0, paused: 0, cancelled: 0, total: 0 };
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const c = Number(r.count) || 0;
          if (r.status === 'active') stats.active += c;
          else if (r.status === 'paused') stats.paused += c;
          else if (r.status === 'cancelled') stats.cancelled += c;
          stats.total += c;
        }
      }
      res.json(stats);
    } catch (err) {
      console.error('Error getting subscription stats:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/dashboard-documents', async (req, res) => {
    try {
      const unifiedDocs: any[] = [];
      const [productsRows]: any = await pool.query('SELECT slug, name FROM products');
      const productMap: Record<string, string> = {};
      for (const pr of productsRows) {
        productMap[pr.slug] = pr.name;
      }

      const [certs]: any = await pool.query('SELECT * FROM product_certifications');
      for (const c of certs) {
        const prodName = productMap[c.product_slug] || c.product_slug;
        unifiedDocs.push({
          id: `cert-${c.id}`,
          slug: `cert-${c.id}`,
          name: c.name,
          product_name: prodName,
          type: c.type === 'report' ? 'Audit Report' : 'Certification',
          category: 'Certifications & Reports',
          requires_nda: (!c.certificate_url && c.soa_available === 1) ? 1 : 0,
          soa_available: c.soa_available === 1,
          products: [c.product_slug],
          url: c.certificate_url || null,
          description: `${c.type === 'report' ? 'Independent Audit Report' : 'Compliance Certification'}`,
          source: 'certification'
        });
      }
      
      const [docs]: any = await pool.query('SELECT * FROM documents');
      for (const d of docs) {
        if (!d.url && (d.requires_nda === 0 || d.requires_nda === false || d.requires_nda === '0')) continue;
        const prods = JSON.parse(d.products || '[]');
        const prodName = prods.map((s: string) => productMap[s] || s).filter(Boolean).join(', ');
        unifiedDocs.push({
          id: `doc-${d.id}`,
          slug: d.slug,
          name: d.name,
          product_name: prodName,
          type: d.type || 'Document',
          category: d.category || 'General',
          requires_nda: d.requires_nda,
          products: prods,
          url: d.url,
          description: d.description,
          source: 'document'
        });
      }

      const [policies]: any = await pool.query('SELECT * FROM product_policies');
      for (const p of policies) {
        if (p.is_requestable !== 1 && p.is_requestable !== true && p.is_requestable !== '1' && !p.file_url) continue;
        const prodName = productMap[p.product_slug] || p.product_slug;
        unifiedDocs.push({
          id: `pol-${p.id}`,
          slug: `policy-${p.id}`,
          name: p.name,
          product_name: prodName,
          type: 'Policy',
          category: 'Policy',
          requires_nda: p.file_url ? 0 : (p.is_requestable === 1 ? 1 : 0),
          products: [p.product_slug],
          url: p.file_url || null,
          description: p.description,
          source: 'policy'
        });
      }

      const [legal]: any = await pool.query('SELECT * FROM product_legal_documents');
      for (const l of legal) {
        if (!l.url && !l.file_url) continue;
        const prodName = productMap[l.product_slug] || l.product_slug;
        unifiedDocs.push({
          id: `leg-${l.id}`,
          slug: `legal-${l.id}`,
          name: l.name || (l.document_type === 'tc' ? 'Terms & Conditions' : l.document_type === 'privacy' ? 'Privacy Policy' : l.document_type === 'dpa' ? 'Data Processing Agreement (DPA)' : 'Legal Document'),
          product_name: prodName,
          type: l.document_type === 'tc' ? 'Terms & Conditions' : l.document_type === 'privacy' ? 'Privacy Policy' : l.document_type === 'dpa' ? 'DPA' : l.document_type,
          category: 'Legal',
          requires_nda: 0,
          products: [l.product_slug],
          url: l.file_url || l.url,
          description: `Version ${l.version || '1.0'}`,
          source: 'legal'
        });
      }

      const [dpa]: any = await pool.query('SELECT * FROM product_subprocessors WHERE dpa_url IS NOT NULL OR dpa_requestable = 1');
      for (const a of dpa) {
        const prodName = productMap[a.product_slug] || a.product_slug;
        unifiedDocs.push({
          id: `dpa-${a.id}`,
          slug: `dpa-${a.id}`,
          name: `DPA - ${a.name}`,
          product_name: prodName,
          type: 'DPA Addendum',
          category: 'Legal',
          requires_nda: a.dpa_requestable === 1 ? 1 : 0,
          products: [a.product_slug],
          url: a.dpa_url,
          description: `Data Processing Agreement for ${a.name}`,
          source: 'dpa'
        });
      }

      res.json(unifiedDocs);
    } catch (err) {
      console.error('Error fetching dashboard documents:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/documents', async (req, res) => {
    try {
      const [documents]: any = await pool.query('SELECT * FROM documents');
      res.json(documents.map((d: any) => ({
        ...d,
        products: JSON.parse(d.products || '[]')
      })));
    } catch (err) {
      console.error('Error fetching public documents:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/latest-controls', async (req, res) => {
    try {
      const [controls]: any = await pool.query(`
        SELECT pc.*, p.name as product_name 
        FROM product_controls pc
        JOIN products p ON pc.product_slug = p.slug
        ORDER BY pc.updated_at DESC
        LIMIT 3
      `);
      res.json(controls);
    } catch (err) {
      console.error('Error fetching latest controls:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/all-controls', async (req, res) => {
    try {
      const [controls]: any = await pool.query(`
        SELECT pc.*, p.name as product_name 
        FROM product_controls pc
        JOIN products p ON pc.product_slug = p.slug
        ORDER BY pc.updated_at DESC
      `);
      res.json(controls);
    } catch (err) {
      console.error('Error fetching all controls:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/dashboard-settings', async (req, res) => {
    try {
      const [settings]: any = await pool.query('SELECT "key", "value" FROM dashboard_settings');
      const result: any = {};
      for (const s of settings as any[]) {
        try {
          result[s.key] = JSON.parse(s.value);
        } catch (e) {
          result[s.key] = s.value;
        }
      }
      res.json(result);
    } catch (err) {
      console.error('Error fetching dashboard settings:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/public/nda-version', async (req, res) => {
    try {
      const [rows]: any = await pool.query(`
        SELECT id, version, change_summary, created_by, effective_date, created_at
        FROM nda_versions
        WHERE is_current = 1
        LIMIT 1
      `);
      if (rows && rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.json({ version: '1.1.0', effective_date: '2025-01-01' });
      }
    } catch (err) {
      res.json({ version: '1.1.0', effective_date: '2025-01-01' });
    }
  });

  app.get('/api/health', async (req, res) => {
    const status: any = { status: 'ok', databases: { sqlite: 'unknown' } };
    
    try {
      await pool.query('SELECT 1');
      status.databases.sqlite = 'connected';
    } catch (err) {
      status.databases.sqlite = 'error';
    }

    res.json(status);
  });

  // Catch-all for undefined /api and /api/* routes so they never fall through to Vite SPA index.html
  app.all('/api', (req, res) => {
    res.status(404).setHeader('Content-Type', 'application/json').json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  app.all('/api/*', (req, res) => {
    res.status(404).setHeader('Content-Type', 'application/json').json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  // Global API error handler ensuring JSON is always returned for API routes
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).setHeader('Content-Type', 'application/json').json({
      error: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
