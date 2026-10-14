import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface GenerateKpiPdfOptions {
  metrics: Array<{
    id: number;
    event_type: string;
    product_slug: string;
    item_name: string;
    user_email?: string | null;
    created_at: string;
  }>;
  accessRequests: Array<{
    id: number;
    document_name: string;
    document_type?: string;
    product_slug?: string | null;
    requester_name: string;
    business_email: string;
    company: string;
    job_title?: string | null;
    relationship?: string | null;
    purpose?: string | null;
    comments?: string | null;
    nda_accepted?: number | boolean;
    nda_accepted_at?: string | null;
    status: string;
    created_at: string;
  }>;
  products: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  settings: {
    site_name?: string;
    mailto_legal?: string;
  };
  productFilter?: string;
  startDate?: string;
  endDate?: string;
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const clean = text.replace(/[\r\n]+/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      const singleWordWidth = font.widthOfTextAtSize(word, fontSize);
      if (singleWordWidth > maxWidth) {
        let remaining = word;
        while (remaining.length > 0) {
          let sliceLen = Math.floor(remaining.length * (maxWidth / singleWordWidth)) || 1;
          while (sliceLen > 0 && font.widthOfTextAtSize(remaining.slice(0, sliceLen), fontSize) > maxWidth) {
            sliceLen--;
          }
          if (sliceLen <= 0) sliceLen = 1;
          lines.push(remaining.slice(0, sliceLen));
          remaining = remaining.slice(sliceLen);
        }
        currentLine = '';
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateKpiPdf(options: GenerateKpiPdfOptions): Promise<Uint8Array> {
  const { metrics, accessRequests, products, settings, productFilter, startDate, endDate } = options;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  // A4 Page dimensions (in points: 72 points = 1 inch)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 36;
  const marginTop = 40;
  const marginBottom = 45;
  const contentWidth = pageWidth - (marginX * 2); // 523.28 pt

  const colorPrimary = rgb(0.06, 0.09, 0.16); // #0f172a slate-900
  const colorAccent = rgb(0.14, 0.39, 0.92); // #2563eb blue-600
  const colorMuted = rgb(0.35, 0.42, 0.52); // slate-500
  const colorBorder = rgb(0.8, 0.84, 0.88); // slate-300
  const colorHeaderBg = rgb(0.95, 0.96, 0.98); // slate-100
  const colorAltRowBg = rgb(0.985, 0.99, 0.995);
  const colorDarkText = rgb(0.1, 0.12, 0.16);

  const siteName = settings.site_name || 'Bjorn Lunden';
  const certifiedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const certifiedTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  const productName = productFilter && productFilter !== 'all'
    ? (products.find(p => p.slug === productFilter)?.name || productFilter)
    : 'Global Scope (All Products)';

  const dateRangeStr = (startDate || endDate)
    ? `${startDate || 'Earliest'} to ${endDate || 'Latest'}`
    : 'All Time Range';

  let currentPage = doc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - marginTop;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY - neededHeight < marginBottom) {
      currentPage = doc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - marginTop;

      // Draw running header on continuation pages
      currentPage.drawLine({
        start: { x: marginX, y: currentY },
        end: { x: pageWidth - marginX, y: currentY },
        thickness: 0.5,
        color: colorBorder
      });
      currentPage.drawText(`${siteName} Trust Center | Executive KPI & Governance Report`, {
        x: marginX,
        y: currentY + 6,
        size: 7.5,
        font: bold,
        color: colorMuted
      });
      currentY -= 16;
      return true;
    }
    return false;
  };

  // --- PAGE 1 HEADER ---
  // Top brand bar
  currentPage.drawRectangle({
    x: marginX,
    y: currentY - 3,
    width: contentWidth,
    height: 3,
    color: colorAccent
  });
  currentY -= 16;

  // Title & Metadata
  currentPage.drawText(`${siteName.toUpperCase()} • EXECUTIVE KPI & GOVERNANCE PUBLICATION`, {
    x: marginX,
    y: currentY,
    size: 7.5,
    font: bold,
    color: colorAccent
  });

  // Certified badge on right
  const badgeText = 'CERTIFIED EXECUTIVE REPORT';
  const badgeWidth = bold.widthOfTextAtSize(badgeText, 7) + 12;
  currentPage.drawRectangle({
    x: pageWidth - marginX - badgeWidth,
    y: currentY - 3,
    width: badgeWidth,
    height: 14,
    color: rgb(0.92, 0.98, 0.95),
    borderColor: rgb(0.65, 0.88, 0.75),
    borderWidth: 0.5
  });
  currentPage.drawText(badgeText, {
    x: pageWidth - marginX - badgeWidth + 6,
    y: currentY + 1,
    size: 7,
    font: bold,
    color: rgb(0.04, 0.45, 0.25)
  });
  currentY -= 18;

  currentPage.drawText('Executive KPI & Access Governance Report', {
    x: marginX,
    y: currentY,
    size: 16,
    font: bold,
    color: colorPrimary
  });
  currentY -= 14;

  currentPage.drawText(`Scope: ${productName}  |  Period: ${dateRangeStr}  |  Generated: ${certifiedDate} ${certifiedTime}`, {
    x: marginX,
    y: currentY,
    size: 8,
    font: oblique,
    color: colorMuted
  });
  currentY -= 18;

  // Header separator line
  currentPage.drawLine({
    start: { x: marginX, y: currentY },
    end: { x: pageWidth - marginX, y: currentY },
    thickness: 1,
    color: colorBorder
  });
  currentY -= 16;

  // --- STATUTORY DISCLOSURE BOX ---
  const noticeBoxHeight = 36;
  currentPage.drawRectangle({
    x: marginX,
    y: currentY - noticeBoxHeight,
    width: contentWidth,
    height: noticeBoxHeight,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.82, 0.88, 0.98),
    borderWidth: 0.5
  });
  currentPage.drawRectangle({
    x: marginX,
    y: currentY - noticeBoxHeight,
    width: 3,
    height: noticeBoxHeight,
    color: colorAccent
  });

  currentPage.drawText('CONFIDENTIAL EXECUTIVE AUDIT NOTICE:', {
    x: marginX + 10,
    y: currentY - 11,
    size: 7.5,
    font: bold,
    color: colorAccent
  });

  currentPage.drawText(
    'This certified document records access metrics, stakeholder demographics, verified requester professional roles, and NDA compliance logs. Generated automatically by the Bjorn Lunden Trust Center platform for executive oversight and audit governance.',
    {
      x: marginX + 10,
      y: currentY - 24,
      size: 7,
      font: font,
      color: rgb(0.2, 0.25, 0.35)
    }
  );
  currentY -= (noticeBoxHeight + 16);

  // --- EXECUTIVE SUMMARY METRICS CARDS (4 Boxes) ---
  const totalRequests = accessRequests.length;
  const directDownloads = metrics.filter(m => m.event_type.startsWith('download_')).length;
  const uniqueCompanies = new Set(accessRequests.map(r => r.company)).size;
  const ndaAccepted = accessRequests.filter(r => r.nda_accepted).length;
  const ndaRate = totalRequests > 0 ? Math.round((ndaAccepted / totalRequests) * 100) : 100;

  const cardWidth = (contentWidth - (3 * 8)) / 4;
  const cardHeight = 44;
  const summaryMetrics = [
    { label: 'TOTAL REQUESTS', value: String(totalRequests), sub: `${uniqueCompanies} Organizations` },
    { label: 'DIRECT DOWNLOADS', value: String(directDownloads), sub: 'Whitepapers & Reports' },
    { label: 'NDA OPT-IN RATE', value: `${ndaRate}%`, sub: `${ndaAccepted} Verified NDAs` },
    { label: 'UNIQUE PRODUCTS', value: String(new Set(metrics.map(m => m.product_slug)).size || 1), sub: productName }
  ];

  summaryMetrics.forEach((card, i) => {
    const cardX = marginX + i * (cardWidth + 8);
    currentPage.drawRectangle({
      x: cardX,
      y: currentY - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: rgb(0.98, 0.985, 0.995),
      borderColor: colorBorder,
      borderWidth: 0.5
    });

    currentPage.drawText(card.label, {
      x: cardX + 8,
      y: currentY - 12,
      size: 6.5,
      font: bold,
      color: colorMuted
    });
    currentPage.drawText(card.value, {
      x: cardX + 8,
      y: currentY - 26,
      size: 13,
      font: bold,
      color: colorPrimary
    });
    currentPage.drawText(card.sub, {
      x: cardX + 8,
      y: currentY - 37,
      size: 6.5,
      font: font,
      color: colorMuted
    });
  });
  currentY -= (cardHeight + 20);

  // ============================================================
  // SECTION 1: STAKEHOLDER DEMOGRAPHICS & GOVERNANCE ANALYSIS
  // ============================================================
  checkPageBreak(80);

  currentPage.drawText('1. Stakeholder Intelligence & Access Governance', {
    x: marginX,
    y: currentY,
    size: 11,
    font: bold,
    color: colorPrimary
  });
  currentY -= 12;

  currentPage.drawText('Distribution of professional job titles, relationship to Bjorn Lunden, and declared evaluation purposes.', {
    x: marginX,
    y: currentY,
    size: 7.5,
    font: oblique,
    color: colorMuted
  });
  currentY -= 14;

  // Group by Job Title
  const jobTitleMap: Record<string, { count: number; orgs: Set<string>; topRel: Record<string, number>; topPurp: Record<string, number> }> = {};
  accessRequests.forEach(r => {
    const title = (r.job_title || 'Unspecified Role').trim();
    if (!jobTitleMap[title]) jobTitleMap[title] = { count: 0, orgs: new Set(), topRel: {}, topPurp: {} };
    jobTitleMap[title].count++;
    if (r.company) jobTitleMap[title].orgs.add(r.company);
    const rel = (r.relationship || 'Unspecified').trim();
    jobTitleMap[title].topRel[rel] = (jobTitleMap[title].topRel[rel] || 0) + 1;
    const purp = (r.purpose || 'Unspecified').trim();
    jobTitleMap[title].topPurp[purp] = (jobTitleMap[title].topPurp[purp] || 0) + 1;
  });

  const jobTitleList = Object.entries(jobTitleMap).map(([title, data]) => ({
    title,
    count: data.count,
    share: totalRequests > 0 ? Math.round((data.count / totalRequests) * 100) : 0,
    orgs: data.orgs.size,
    primaryRel: Object.entries(data.topRel).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
    primaryPurp: Object.entries(data.topPurp).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  })).sort((a, b) => b.count - a.count);

  // Job Title Table Headers
  const colJobTitle = 175;
  const colRel = 120;
  const colPurp = 150;
  const colCount = 40;
  const colShare = 38.28;

  currentPage.drawRectangle({
    x: marginX,
    y: currentY - 16,
    width: contentWidth,
    height: 16,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5
  });

  currentPage.drawText('PROFESSIONAL JOB TITLE', { x: marginX + 6, y: currentY - 11, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('RELATIONSHIP TO BJÖRN LUNDEN', { x: marginX + colJobTitle + 4, y: currentY - 11, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('PRIMARY PURPOSE OF REQUEST', { x: marginX + colJobTitle + colRel + 4, y: currentY - 11, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('REQS', { x: marginX + colJobTitle + colRel + colPurp + 4, y: currentY - 11, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('SHARE', { x: marginX + colJobTitle + colRel + colPurp + colCount + 4, y: currentY - 11, size: 6.5, font: bold, color: colorPrimary });
  currentY -= 16;

  jobTitleList.forEach((item, idx) => {
    checkPageBreak(18);
    const rowHeight = 16;
    const isAlt = idx % 2 === 1;

    currentPage.drawRectangle({
      x: marginX,
      y: currentY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: isAlt ? colorAltRowBg : rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5
    });

    const safeTitle = item.title.length > 38 ? item.title.slice(0, 36) + '...' : item.title;
    const safeRel = item.primaryRel.length > 25 ? item.primaryRel.slice(0, 23) + '...' : item.primaryRel;
    const safePurp = item.primaryPurp.length > 33 ? item.primaryPurp.slice(0, 31) + '...' : item.primaryPurp;

    currentPage.drawText(safeTitle, { x: marginX + 6, y: currentY - 11, size: 7, font: bold, color: colorDarkText });
    currentPage.drawText(safeRel, { x: marginX + colJobTitle + 4, y: currentY - 11, size: 6.5, font: font, color: colorMuted });
    currentPage.drawText(safePurp, { x: marginX + colJobTitle + colRel + 4, y: currentY - 11, size: 6.5, font: font, color: colorDarkText });
    currentPage.drawText(String(item.count), { x: marginX + colJobTitle + colRel + colPurp + 8, y: currentY - 11, size: 7, font: bold, color: colorAccent });
    currentPage.drawText(`${item.share}%`, { x: marginX + colJobTitle + colRel + colPurp + colCount + 6, y: currentY - 11, size: 7, font: font, color: colorMuted });
    currentY -= rowHeight;
  });
  currentY -= 18;

  // ============================================================
  // SECTION 2: RELATIONSHIP & PURPOSE BREAKDOWN MATRICES
  // ============================================================
  checkPageBreak(120);

  // Group by Relationship
  const relMap: Record<string, number> = {};
  accessRequests.forEach(r => {
    const rel = (r.relationship || 'Unspecified').trim();
    relMap[rel] = (relMap[rel] || 0) + 1;
  });
  const relList = Object.entries(relMap).map(([name, count]) => ({
    name,
    count,
    share: totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0
  })).sort((a, b) => b.count - a.count);

  // Group by Purpose
  const purpMap: Record<string, number> = {};
  accessRequests.forEach(r => {
    const purp = (r.purpose || 'Unspecified').trim();
    purpMap[purp] = (purpMap[purp] || 0) + 1;
  });
  const purpList = Object.entries(purpMap).map(([name, count]) => ({
    name,
    count,
    share: totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0
  })).sort((a, b) => b.count - a.count);

  // Two columns side-by-side for Relationship vs Purpose
  const halfColWidth = (contentWidth - 10) / 2;

  currentPage.drawText('2. Relationship & Purpose Breakdown', {
    x: marginX,
    y: currentY,
    size: 11,
    font: bold,
    color: colorPrimary
  });
  currentY -= 16;

  // Column Headers
  currentPage.drawRectangle({
    x: marginX,
    y: currentY - 14,
    width: halfColWidth,
    height: 14,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5
  });
  currentPage.drawText('STAKEHOLDER RELATIONSHIP', { x: marginX + 6, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('COUNT', { x: marginX + halfColWidth - 45, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('SHARE', { x: marginX + halfColWidth - 24, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });

  currentPage.drawRectangle({
    x: marginX + halfColWidth + 10,
    y: currentY - 14,
    width: halfColWidth,
    height: 14,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5
  });
  currentPage.drawText('EVALUATION PURPOSE', { x: marginX + halfColWidth + 16, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('COUNT', { x: marginX + contentWidth - 45, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('SHARE', { x: marginX + contentWidth - 24, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });
  currentY -= 14;

  const maxRows = Math.max(relList.length, purpList.length);
  for (let i = 0; i < maxRows; i++) {
    checkPageBreak(16);
    const rowH = 14;
    const isAlt = i % 2 === 1;

    // Left Column: Relationship
    if (relList[i]) {
      currentPage.drawRectangle({
        x: marginX,
        y: currentY - rowH,
        width: halfColWidth,
        height: rowH,
        color: isAlt ? colorAltRowBg : rgb(1, 1, 1),
        borderColor: colorBorder,
        borderWidth: 0.5
      });
      const safeRel = relList[i].name.length > 32 ? relList[i].name.slice(0, 30) + '...' : relList[i].name;
      currentPage.drawText(safeRel, { x: marginX + 6, y: currentY - 10, size: 6.5, font: font, color: colorDarkText });
      currentPage.drawText(String(relList[i].count), { x: marginX + halfColWidth - 40, y: currentY - 10, size: 7, font: bold, color: colorAccent });
      currentPage.drawText(`${relList[i].share}%`, { x: marginX + halfColWidth - 22, y: currentY - 10, size: 6.5, font: font, color: colorMuted });
    }

    // Right Column: Purpose
    if (purpList[i]) {
      currentPage.drawRectangle({
        x: marginX + halfColWidth + 10,
        y: currentY - rowH,
        width: halfColWidth,
        height: rowH,
        color: isAlt ? colorAltRowBg : rgb(1, 1, 1),
        borderColor: colorBorder,
        borderWidth: 0.5
      });
      const safePurp = purpList[i].name.length > 32 ? purpList[i].name.slice(0, 30) + '...' : purpList[i].name;
      currentPage.drawText(safePurp, { x: marginX + halfColWidth + 16, y: currentY - 10, size: 6.5, font: font, color: colorDarkText });
      currentPage.drawText(String(purpList[i].count), { x: marginX + contentWidth - 40, y: currentY - 10, size: 7, font: bold, color: rgb(0.5, 0.2, 0.8) });
      currentPage.drawText(`${purpList[i].share}%`, { x: marginX + contentWidth - 22, y: currentY - 10, size: 6.5, font: font, color: colorMuted });
    }

    currentY -= rowH;
  }
  currentY -= 20;

  // ============================================================
  // SECTION 3: TOP DOCUMENT METRICS
  // ============================================================
  checkPageBreak(100);

  currentPage.drawText('3. Top Documents Requested & Downloaded', {
    x: marginX,
    y: currentY,
    size: 11,
    font: bold,
    color: colorPrimary
  });
  currentY -= 14;

  const topRequestedDocs: Record<string, number> = {};
  accessRequests.forEach(r => {
    topRequestedDocs[r.document_name] = (topRequestedDocs[r.document_name] || 0) + 1;
  });
  const topReqList = Object.entries(topRequestedDocs).map(([docName, count]) => ({ docName, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  const topDownloadedDocs: Record<string, number> = {};
  metrics.filter(m => m.event_type.startsWith('download_')).forEach(m => {
    topDownloadedDocs[m.item_name] = (topDownloadedDocs[m.item_name] || 0) + 1;
  });
  const topDlList = Object.entries(topDownloadedDocs).map(([docName, count]) => ({ docName, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  // Table header for top docs
  currentPage.drawRectangle({
    x: marginX,
    y: currentY - 14,
    width: halfColWidth,
    height: 14,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5
  });
  currentPage.drawText('TOP REQUESTED DOCUMENTS', { x: marginX + 6, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('REQS', { x: marginX + halfColWidth - 30, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });

  currentPage.drawRectangle({
    x: marginX + halfColWidth + 10,
    y: currentY - 14,
    width: halfColWidth,
    height: 14,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5
  });
  currentPage.drawText('TOP DIRECT DOWNLOADED DOCUMENTS', { x: marginX + halfColWidth + 16, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });
  currentPage.drawText('DLS', { x: marginX + contentWidth - 30, y: currentY - 10, size: 6.5, font: bold, color: colorPrimary });
  currentY -= 14;

  const maxDocRows = Math.max(topReqList.length, topDlList.length);
  for (let i = 0; i < maxDocRows; i++) {
    checkPageBreak(16);
    const rowH = 14;
    const isAlt = i % 2 === 1;

    if (topReqList[i]) {
      currentPage.drawRectangle({
        x: marginX,
        y: currentY - rowH,
        width: halfColWidth,
        height: rowH,
        color: isAlt ? colorAltRowBg : rgb(1, 1, 1),
        borderColor: colorBorder,
        borderWidth: 0.5
      });
      const safeName = topReqList[i].docName.length > 34 ? topReqList[i].docName.slice(0, 32) + '...' : topReqList[i].docName;
      currentPage.drawText(safeName, { x: marginX + 6, y: currentY - 10, size: 6.5, font: font, color: colorDarkText });
      currentPage.drawText(String(topReqList[i].count), { x: marginX + halfColWidth - 25, y: currentY - 10, size: 7, font: bold, color: colorAccent });
    }

    if (topDlList[i]) {
      currentPage.drawRectangle({
        x: marginX + halfColWidth + 10,
        y: currentY - rowH,
        width: halfColWidth,
        height: rowH,
        color: isAlt ? colorAltRowBg : rgb(1, 1, 1),
        borderColor: colorBorder,
        borderWidth: 0.5
      });
      const safeName = topDlList[i].docName.length > 34 ? topDlList[i].docName.slice(0, 32) + '...' : topDlList[i].docName;
      currentPage.drawText(safeName, { x: marginX + halfColWidth + 16, y: currentY - 10, size: 6.5, font: font, color: colorDarkText });
      currentPage.drawText(String(topDlList[i].count), { x: marginX + contentWidth - 25, y: currentY - 10, size: 7, font: bold, color: rgb(0.1, 0.6, 0.4) });
    }

    currentY -= rowH;
  }
  currentY -= 20;

  // ============================================================
  // SECTION 4: INFORMATION REQUESTS GOVERNANCE REGISTRY
  // ============================================================
  checkPageBreak(120);

  currentPage.drawText('4. Information Requests Governance Registry (Audit Log)', {
    x: marginX,
    y: currentY,
    size: 11,
    font: bold,
    color: colorPrimary
  });
  currentY -= 12;

  currentPage.drawText('Detailed verification record of individual requests, requester organization, professional title, and status.', {
    x: marginX,
    y: currentY,
    size: 7.5,
    font: oblique,
    color: colorMuted
  });
  currentY -= 14;

  const colLogDate = 55;
  const colLogReq = 125;
  const colLogRole = 110;
  const colLogRel = 85;
  const colLogDoc = 100;
  const colLogStatus = 48.28;

  currentPage.drawRectangle({
    x: marginX,
    y: currentY - 14,
    width: contentWidth,
    height: 14,
    color: colorHeaderBg,
    borderColor: colorBorder,
    borderWidth: 0.5
  });

  currentPage.drawText('DATE', { x: marginX + 4, y: currentY - 10, size: 6, font: bold, color: colorPrimary });
  currentPage.drawText('REQUESTER & COMPANY', { x: marginX + colLogDate + 4, y: currentY - 10, size: 6, font: bold, color: colorPrimary });
  currentPage.drawText('JOB TITLE / ROLE', { x: marginX + colLogDate + colLogReq + 4, y: currentY - 10, size: 6, font: bold, color: colorPrimary });
  currentPage.drawText('RELATIONSHIP', { x: marginX + colLogDate + colLogReq + colLogRole + 4, y: currentY - 10, size: 6, font: bold, color: colorPrimary });
  currentPage.drawText('DOCUMENT', { x: marginX + colLogDate + colLogReq + colLogRole + colLogRel + 4, y: currentY - 10, size: 6, font: bold, color: colorPrimary });
  currentPage.drawText('STATUS', { x: marginX + colLogDate + colLogReq + colLogRole + colLogRel + colLogDoc + 4, y: currentY - 10, size: 6, font: bold, color: colorPrimary });
  currentY -= 14;

  accessRequests.forEach((req, idx) => {
    checkPageBreak(18);
    const rowH = 15;
    const isAlt = idx % 2 === 1;

    currentPage.drawRectangle({
      x: marginX,
      y: currentY - rowH,
      width: contentWidth,
      height: rowH,
      color: isAlt ? colorAltRowBg : rgb(1, 1, 1),
      borderColor: colorBorder,
      borderWidth: 0.5
    });

    const dateStr = new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const reqStr = `${req.requester_name} (${req.company || 'N/A'})`;
    const safeReq = reqStr.length > 25 ? reqStr.slice(0, 23) + '..' : reqStr;
    const safeRole = (req.job_title || 'Unspecified').slice(0, 22);
    const safeRel = (req.relationship || 'Unspecified').slice(0, 16);
    const safeDoc = req.document_name.length > 20 ? req.document_name.slice(0, 18) + '..' : req.document_name;
    const statusStr = (req.status || 'pending').toUpperCase();

    currentPage.drawText(dateStr, { x: marginX + 4, y: currentY - 10, size: 6, font: font, color: colorMuted });
    currentPage.drawText(safeReq, { x: marginX + colLogDate + 4, y: currentY - 10, size: 6.5, font: bold, color: colorDarkText });
    currentPage.drawText(safeRole, { x: marginX + colLogDate + colLogReq + 4, y: currentY - 10, size: 6.5, font: font, color: colorDarkText });
    currentPage.drawText(safeRel, { x: marginX + colLogDate + colLogReq + colLogRole + 4, y: currentY - 10, size: 6, font: font, color: colorMuted });
    currentPage.drawText(safeDoc, { x: marginX + colLogDate + colLogReq + colLogRole + colLogRel + 4, y: currentY - 10, size: 6, font: font, color: colorDarkText });
    currentPage.drawText(statusStr, { x: marginX + colLogDate + colLogReq + colLogRole + colLogRel + colLogDoc + 4, y: currentY - 10, size: 6, font: bold, color: colorAccent });

    currentY -= rowH;
  });

  // --- FOOTER ON ALL PAGES ---
  const totalPages = doc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = doc.getPage(i);
    // Footer line
    page.drawLine({
      start: { x: marginX, y: marginBottom },
      end: { x: pageWidth - marginX, y: marginBottom },
      thickness: 0.5,
      color: colorBorder
    });

    // Left notice
    page.drawText(`${siteName} Trust Center • Official Executive KPI & Access Governance Record`, {
      x: marginX,
      y: marginBottom - 12,
      size: 6.5,
      font: font,
      color: colorMuted
    });

    // Right page number
    const pageText = `Page ${i + 1} of ${totalPages}`;
    const pageTextWidth = font.widthOfTextAtSize(pageText, 6.5);
    page.drawText(pageText, {
      x: pageWidth - marginX - pageTextWidth,
      y: marginBottom - 12,
      size: 6.5,
      font: bold,
      color: colorMuted
    });
  }

  return await doc.save();
}
