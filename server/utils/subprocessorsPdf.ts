import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface GeneratePdfOptions {
  product: {
    name: string;
    slug: string;
  };
  subprocessors: Array<{
    id: number;
    name: string;
    category?: string;
    purpose?: string;
    nature_of_processing?: string;
    data_categories?: string;
    region?: string;
    countries?: string[];
    website_url?: string;
    contact_details?: string;
    org_number?: string;
    lei_number?: string;
    certifications?: string;
    security_measures?: string;
    transfers?: string;
    retention?: string;
    dpa_url?: string;
    dpa_requestable?: number;
  }>;
  history: Array<{
    id: number;
    version: string;
    date: string;
    description: string;
  }>;
  settings: {
    site_name?: string;
    mailto_legal?: string;
  };
  country?: string;
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  // Clean whitespace and sanitize non-ASCII or unsupported characters for standard Helvetica
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

export async function generateSubprocessorsPdf(options: GeneratePdfOptions): Promise<Uint8Array> {
  const { product, subprocessors, history, settings, country } = options;

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
  const mailtoLegal = settings.mailto_legal || 'security@bjornlunden.com';
  const certifiedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const scopeStr = country && country !== 'all' 
    ? `Jurisdiction Scope: ${country.toUpperCase()}` 
    : 'Jurisdiction Scope: Global (All Scope)';
  const refCode = `SUB-${product.slug.toUpperCase()}`;

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
      currentPage.drawText(`${siteName} Trust Center | Authorized Subprocessors: ${product.name} (Ref: ${refCode})`, {
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
  currentPage.drawText(`${siteName.toUpperCase()} • TRUST CENTER PUBLIC DOCUMENTATION`, {
    x: marginX,
    y: currentY,
    size: 7.5,
    font: bold,
    color: colorAccent
  });
  currentY -= 16;

  // Main Document Heading
  currentPage.drawText('Authorized Subprocessors & Registry of Alterations', {
    x: marginX,
    y: currentY,
    size: 16,
    font: bold,
    color: colorPrimary
  });
  currentY -= 16;

  // Product Badge & Date metadata
  currentPage.drawText(`Product: ${product.name}`, {
    x: marginX,
    y: currentY,
    size: 10,
    font: bold,
    color: colorAccent
  });
  currentPage.drawText(`Date printed: ${certifiedDate}`, {
    x: pageWidth - marginX - 180,
    y: currentY,
    size: 8.5,
    font: bold,
    color: colorPrimary
  });
  currentY -= 12;

  currentPage.drawText(scopeStr, {
    x: marginX,
    y: currentY,
    size: 8,
    font,
    color: colorMuted
  });
  currentPage.drawText(`Reference: ${refCode}`, {
    x: pageWidth - marginX - 180,
    y: currentY,
    size: 7.5,
    font,
    color: colorMuted
  });
  currentY -= 14;

  // Separator line
  currentPage.drawLine({
    start: { x: marginX, y: currentY },
    end: { x: pageWidth - marginX, y: currentY },
    thickness: 1.5,
    color: colorPrimary
  });
  currentY -= 16;

  // ==========================================
  // SECTION 1: AUTHORIZED SUBPROCESSORS TABLE
  // ==========================================
  checkPageBreak(40);
  currentPage.drawText(`1. Current Authorized Subprocessors (${subprocessors.length} Entities)`, {
    x: marginX,
    y: currentY,
    size: 11,
    font: bold,
    color: colorPrimary
  });
  currentY -= 12;

  // Table Column Definitions
  // Total contentWidth = 523.28 pt
  const colWidths = {
    entity: 120,    // 0 to 120
    category: 75,   // 120 to 195
    purpose: 140,   // 195 to 335
    region: 95,     // 335 to 430
    safeguards: 93.28 // 430 to 523.28
  };

  const drawSubTableHeader = () => {
    checkPageBreak(22);
    currentPage.drawRectangle({
      x: marginX,
      y: currentY - 18,
      width: contentWidth,
      height: 18,
      color: colorHeaderBg,
      borderColor: colorBorder,
      borderWidth: 0.75
    });

    const headers = [
      { text: 'Subprocessor / Identity', x: marginX + 4, width: colWidths.entity },
      { text: 'Category', x: marginX + colWidths.entity + 4, width: colWidths.category },
      { text: 'Processing & Purpose', x: marginX + colWidths.entity + colWidths.category + 4, width: colWidths.purpose },
      { text: 'Location & Scope', x: marginX + colWidths.entity + colWidths.category + colWidths.purpose + 4, width: colWidths.region },
      { text: 'Safeguards / TOMs', x: marginX + colWidths.entity + colWidths.category + colWidths.purpose + colWidths.region + 4, width: colWidths.safeguards },
    ];

    for (const h of headers) {
      currentPage.drawText(h.text, {
        x: h.x,
        y: currentY - 12,
        size: 7,
        font: bold,
        color: colorPrimary
      });
    }
    currentY -= 18;
  };

  drawSubTableHeader();

  // Render Subprocessor Rows
  for (let idx = 0; idx < subprocessors.length; idx++) {
    const sub = subprocessors[idx];

    // Build text content for each column
    const entityLines: { text: string; isBold?: boolean; size?: number; color?: any }[] = [
      { text: sub.name, isBold: true, size: 8, color: colorPrimary }
    ];
    if (sub.org_number) entityLines.push({ text: `Org: ${sub.org_number}`, size: 6.5, color: colorMuted });
    if (sub.lei_number) entityLines.push({ text: `LEI: ${sub.lei_number}`, size: 6.5, color: colorMuted });
    if (sub.contact_details) {
      const contactWrapped = wrapText(sub.contact_details, font, 6.5, colWidths.entity - 8);
      contactWrapped.forEach(l => entityLines.push({ text: l, size: 6.5, color: colorMuted }));
    }

    const categoryLines: { text: string; size?: number; color?: any }[] = [
      { text: sub.category || 'Service Provider', size: 7.5, color: colorDarkText }
    ];

    const purposeLines: { text: string; isBold?: boolean; size?: number; color?: any }[] = [];
    if (sub.purpose) {
      wrapText(sub.purpose, bold, 7, colWidths.purpose - 8).forEach(l => {
        purposeLines.push({ text: l, isBold: true, size: 7, color: colorDarkText });
      });
    }
    if (sub.nature_of_processing) {
      wrapText(`Nature: ${sub.nature_of_processing}`, font, 6.5, colWidths.purpose - 8).forEach(l => {
        purposeLines.push({ text: l, size: 6.5, color: rgb(0.25, 0.3, 0.38) });
      });
    }
    if (sub.data_categories) {
      wrapText(`Data: ${sub.data_categories}`, oblique, 6.5, colWidths.purpose - 8).forEach(l => {
        purposeLines.push({ text: l, size: 6.5, color: colorMuted });
      });
    }

    const regionLines: { text: string; isBold?: boolean; size?: number; color?: any }[] = [
      { text: sub.region || 'EU / Global', isBold: true, size: 7.5, color: colorDarkText }
    ];
    if (sub.countries && sub.countries.length > 0) {
      const countriesStr = sub.countries.map(c => c.toUpperCase()).join(', ');
      wrapText(`Jurisdictions: ${countriesStr}`, font, 6.5, colWidths.region - 8).forEach(l => {
        regionLines.push({ text: l, size: 6.5, color: colorMuted });
      });
    }
    if (sub.retention) {
      wrapText(`Retention: ${sub.retention}`, font, 6, colWidths.region - 8).forEach(l => {
        regionLines.push({ text: l, size: 6, color: colorMuted });
      });
    }

    const safeguardLines: { text: string; isBold?: boolean; size?: number; color?: any }[] = [];
    if (sub.certifications) {
      wrapText(`Audit: ${sub.certifications}`, bold, 6.5, colWidths.safeguards - 8).forEach(l => {
        safeguardLines.push({ text: l, isBold: true, size: 6.5, color: rgb(0.04, 0.45, 0.25) });
      });
    }
    if (sub.transfers) {
      wrapText(`Transfers: ${sub.transfers}`, font, 6.5, colWidths.safeguards - 8).forEach(l => {
        safeguardLines.push({ text: l, size: 6.5, color: colorAccent });
      });
    }
    const dpaStatus = sub.dpa_url ? 'DPA: Executed' : sub.dpa_requestable ? 'DPA: On Request' : 'DPA: Art. 28 Terms';
    safeguardLines.push({ text: dpaStatus, size: 6.5, color: colorMuted });

    const maxLinesCount = Math.max(
      entityLines.length,
      categoryLines.length,
      purposeLines.length,
      regionLines.length,
      safeguardLines.length,
      2
    );
    const rowHeight = (maxLinesCount * 9) + 8;

    if (checkPageBreak(rowHeight)) {
      drawSubTableHeader();
    }

    // Row background (alternating)
    if (idx % 2 === 1) {
      currentPage.drawRectangle({
        x: marginX,
        y: currentY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: colorAltRowBg
      });
    }

    // Outer row border
    currentPage.drawRectangle({
      x: marginX,
      y: currentY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      borderColor: colorBorder,
      borderWidth: 0.5
    });

    // Column separator lines
    let colX = marginX;
    [colWidths.entity, colWidths.category, colWidths.purpose, colWidths.region].forEach(w => {
      colX += w;
      currentPage.drawLine({
        start: { x: colX, y: currentY },
        end: { x: colX, y: currentY - rowHeight },
        thickness: 0.5,
        color: colorBorder
      });
    });

    // Draw Column 1: Entity
    let itemY = currentY - 9;
    for (const item of entityLines) {
      currentPage.drawText(item.text, {
        x: marginX + 4,
        y: itemY,
        size: item.size || 7,
        font: item.isBold ? bold : font,
        color: item.color || colorDarkText
      });
      itemY -= 9;
    }

    // Draw Column 2: Category
    itemY = currentY - 9;
    for (const item of categoryLines) {
      currentPage.drawText(item.text, {
        x: marginX + colWidths.entity + 4,
        y: itemY,
        size: item.size || 7,
        font,
        color: item.color || colorDarkText
      });
      itemY -= 9;
    }

    // Draw Column 3: Processing & Purpose
    itemY = currentY - 9;
    for (const item of purposeLines) {
      currentPage.drawText(item.text, {
        x: marginX + colWidths.entity + colWidths.category + 4,
        y: itemY,
        size: item.size || 7,
        font: item.isBold ? bold : font,
        color: item.color || colorDarkText
      });
      itemY -= 9;
    }

    // Draw Column 4: Location & Scope
    itemY = currentY - 9;
    for (const item of regionLines) {
      currentPage.drawText(item.text, {
        x: marginX + colWidths.entity + colWidths.category + colWidths.purpose + 4,
        y: itemY,
        size: item.size || 7,
        font: item.isBold ? bold : font,
        color: item.color || colorDarkText
      });
      itemY -= 9;
    }

    // Draw Column 5: Safeguards & TOMs
    itemY = currentY - 9;
    for (const item of safeguardLines) {
      currentPage.drawText(item.text, {
        x: marginX + colWidths.entity + colWidths.category + colWidths.purpose + colWidths.region + 4,
        y: itemY,
        size: item.size || 7,
        font: item.isBold ? bold : font,
        color: item.color || colorDarkText
      });
      itemY -= 9;
    }

    currentY -= rowHeight;
  }

  if (subprocessors.length === 0) {
    const emptyHeight = 24;
    currentPage.drawRectangle({
      x: marginX,
      y: currentY - emptyHeight,
      width: contentWidth,
      height: emptyHeight,
      borderColor: colorBorder,
      borderWidth: 0.5
    });
    currentPage.drawText('No subprocessors are registered for this product.', {
      x: marginX + 16,
      y: currentY - 15,
      size: 7.5,
      font: oblique,
      color: colorMuted
    });
    currentY -= emptyHeight;
  }

  currentY -= 18;

  // ==========================================
  // SECTION 2: REGISTRY OF ALTERATIONS TABLE
  // ==========================================
  checkPageBreak(50);
  currentPage.drawText(`2. Registry of Alterations (${history.length} Revisions)`, {
    x: marginX,
    y: currentY,
    size: 11,
    font: bold,
    color: colorPrimary
  });
  currentY -= 12;

  const histCols = {
    version: 60,
    date: 80,
    desc: contentWidth - 140 // 383.28 pt
  };

  const drawHistTableHeader = () => {
    checkPageBreak(22);
    currentPage.drawRectangle({
      x: marginX,
      y: currentY - 18,
      width: contentWidth,
      height: 18,
      color: colorHeaderBg,
      borderColor: colorBorder,
      borderWidth: 0.75
    });

    currentPage.drawText('Version', {
      x: marginX + 6,
      y: currentY - 12,
      size: 7,
      font: bold,
      color: colorPrimary
    });
    currentPage.drawText('Effective Date', {
      x: marginX + histCols.version + 6,
      y: currentY - 12,
      size: 7,
      font: bold,
      color: colorPrimary
    });
    currentPage.drawText('Description of Alteration & Statutory Log', {
      x: marginX + histCols.version + histCols.date + 6,
      y: currentY - 12,
      size: 7,
      font: bold,
      color: colorPrimary
    });
    currentY -= 18;
  };

  drawHistTableHeader();

  for (let idx = 0; idx < history.length; idx++) {
    const h = history[idx];
    const descLines = wrapText(h.description, font, 7, histCols.desc - 12);
    const rowHeight = Math.max(descLines.length * 9 + 8, 20);

    if (checkPageBreak(rowHeight)) {
      drawHistTableHeader();
    }

    if (idx % 2 === 1) {
      currentPage.drawRectangle({
        x: marginX,
        y: currentY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: colorAltRowBg
      });
    }

    currentPage.drawRectangle({
      x: marginX,
      y: currentY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      borderColor: colorBorder,
      borderWidth: 0.5
    });

    // Column separators
    currentPage.drawLine({
      start: { x: marginX + histCols.version, y: currentY },
      end: { x: marginX + histCols.version, y: currentY - rowHeight },
      thickness: 0.5,
      color: colorBorder
    });
    currentPage.drawLine({
      start: { x: marginX + histCols.version + histCols.date, y: currentY },
      end: { x: marginX + histCols.version + histCols.date, y: currentY - rowHeight },
      thickness: 0.5,
      color: colorBorder
    });

    // Draw Version badge
    currentPage.drawText(`v${h.version}`, {
      x: marginX + 6,
      y: currentY - 12,
      size: 7.5,
      font: bold,
      color: colorPrimary
    });

    // Draw Date
    currentPage.drawText(h.date, {
      x: marginX + histCols.version + 6,
      y: currentY - 12,
      size: 7,
      font,
      color: colorDarkText
    });

    // Draw Description lines
    let descY = currentY - 10;
    for (const line of descLines) {
      currentPage.drawText(line, {
        x: marginX + histCols.version + histCols.date + 6,
        y: descY,
        size: 7,
        font,
        color: colorDarkText
      });
      descY -= 9;
    }

    currentY -= rowHeight;
  }

  if (history.length === 0) {
    const emptyHeight = 22;
    currentPage.drawRectangle({
      x: marginX,
      y: currentY - emptyHeight,
      width: contentWidth,
      height: emptyHeight,
      borderColor: colorBorder,
      borderWidth: 0.5
    });
    currentPage.drawText('No alteration history recorded for this product.', {
      x: marginX + 16,
      y: currentY - 14,
      size: 7.5,
      font: oblique,
      color: colorMuted
    });
    currentY -= emptyHeight;
  }

  // ==========================================
  // STAMP FOOTERS ON ALL PAGES
  // ==========================================
  const totalPages = doc.getPageCount();
  const pages = doc.getPages();

  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    // Footer separator line
    p.drawLine({
      start: { x: marginX, y: marginBottom + 14 },
      end: { x: pageWidth - marginX, y: marginBottom + 14 },
      thickness: 0.5,
      color: colorBorder
    });

    p.drawText(`Public Version • ${siteName} Trust Center • Product: ${product.name}`, {
      x: marginX,
      y: marginBottom + 4,
      size: 6.5,
      font,
      color: colorMuted
    });

    const pageIndicator = `Page ${i + 1} of ${totalPages}`;
    const pageIndWidth = font.widthOfTextAtSize(pageIndicator, 6.5);
    p.drawText(pageIndicator, {
      x: pageWidth - marginX - pageIndWidth,
      y: marginBottom + 4,
      size: 6.5,
      font: bold,
      color: colorMuted
    });
  }

  return await doc.save();
}
