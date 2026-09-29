import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { pool } from '../db.js';
import { getJwtSecret } from '../utils/secret.js';
import { csrfProtection } from '../middleware/csrf.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();
const JWT_SECRET = getJwtSecret();

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/svg+xml';
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image formats are allowed (PNG, SVG, JPG, WebP)'));
  }
});

const storageFavicon = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'favicon-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadFavicon = multer({ 
  storage: storageFavicon,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|ico|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed (jpeg, jpg, png, webp, ico, svg)'));
  }
});

const storagePdf = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPdf = multer({ 
  storage: storagePdf,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'application/pdf';
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only PDF files are allowed'));
  }
});

// Middleware to check if admin or moderator
const requireAdminOrMod = (req: any, res: any, next: any) => {
  let token = req.cookies.token;
  
  // Prefer Authorization header if present, as it's more reliable in iframes
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      const headerToken = authHeader.substring(7);
      if (headerToken && headerToken !== 'undefined' && headerToken !== 'null') {
        token = headerToken;
      }
    }
  }

  // Sanitize token
  if (token === 'undefined' || token === 'null') {
    token = null;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'admin' && decoded.role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name !== 'TokenExpiredError') {
      console.error('Admin Middleware - JWT Verify Error:', err.message);
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(csrfProtection);
router.use(requireAdminOrMod);

// Get all users
router.get('/users', async (req: any, res) => {
  const [users]: any = await pool.query('SELECT id, username, role FROM users');
  
  const viewerIds = users.filter((u: any) => u.role === 'viewer').map((u: any) => u.id);
  
  if (viewerIds.length > 0) {
    const placeholders = viewerIds.map(() => '?').join(',');
    const [allModules]: any = await pool.query(`SELECT user_id, module_id FROM user_modules WHERE user_id IN (${placeholders})`, viewerIds);
    const [allProducts]: any = await pool.query(`SELECT user_id, product_slug FROM user_products WHERE user_id IN (${placeholders})`, viewerIds);
    
    const modulesByUserId = allModules.reduce((acc: any, row: any) => {
      acc[row.user_id] = acc[row.user_id] || [];
      acc[row.user_id].push(row.module_id);
      return acc;
    }, {});
    
    const productsByUserId = allProducts.reduce((acc: any, row: any) => {
      acc[row.user_id] = acc[row.user_id] || [];
      acc[row.user_id].push(row.product_slug);
      return acc;
    }, {});
    
    for (const user of users) {
      if (user.role === 'viewer') {
        user.allowedModules = modulesByUserId[user.id] || [];
        user.allowedProducts = productsByUserId[user.id] || [];
      }
    }
  }
  
  res.json(users);
});

// Create a user
router.post('/users', async (req: any, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'Missing fields' });

  // Password validation: at least 12 chars, 1 uppercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ 
      error: 'Password must be at least 12 characters long and contain at least one uppercase letter, one number, and one special character.' 
    });
  }

  // Only admins can create other admins or moderators
  if (req.user.role !== 'admin' && role !== 'viewer') {
    return res.status(403).json({ error: 'Moderators can only create viewers' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const [info]: any = await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, role]);
    res.json({ id: info.insertId, username, role });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete a user
router.delete('/users/:id', async (req: any, res) => {
  const id = req.params.id;
  if (id == req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  const [targetUserRows]: any = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
  const targetUser = targetUserRows[0];
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  if (req.user.role !== 'admin' && targetUser.role !== 'viewer') {
    return res.status(403).json({ error: 'Moderators can only delete viewers' });
  }

  await pool.query('DELETE FROM users WHERE id = ?', [id]);
  res.json({ success: true });
});

// Update user permissions (modules and products)
router.put('/users/:id/permissions', async (req: any, res) => {
  const id = req.params.id;
  const { allowedModules, allowedProducts } = req.body;

  const [targetUserRows]: any = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
  const targetUser = targetUserRows[0];
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.role !== 'viewer') return res.status(400).json({ error: 'Permissions only apply to viewers' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_modules WHERE user_id = ?', [id]);
    await conn.query('DELETE FROM user_products WHERE user_id = ?', [id]);

    if (Array.isArray(allowedModules) && allowedModules.length > 0) {
      const values = allowedModules.flatMap(mod => [id, mod]);
      const placeholders = allowedModules.map(() => '(?, ?)').join(', ');
      await conn.query(`INSERT INTO user_modules (user_id, module_id) VALUES ${placeholders}`, values);
    }

    if (Array.isArray(allowedProducts) && allowedProducts.length > 0) {
      const values = allowedProducts.flatMap(prod => [id, prod]);
      const placeholders = allowedProducts.map(() => '(?, ?)').join(', ');
      await conn.query(`INSERT INTO user_products (user_id, product_slug) VALUES ${placeholders}`, values);
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ error: 'Database error' });
  } finally {
    conn.release();
  }
});

// Get public pages status
router.get('/pages', async (req, res) => {
  const [pages]: any = await pool.query('SELECT id, is_public FROM pages');
  res.json(pages);
});

// Set page public status
router.put('/pages/:id', async (req, res) => {
  const id = req.params.id;
  const { is_public } = req.body;
  
  try {
    await pool.query('INSERT INTO pages (id, is_public) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET is_public = excluded.is_public', [id, is_public ? 1 : 0]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Toggle public page error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update product override
router.put('/product-overrides/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { name, category, url } = req.body;
  
  await pool.query('INSERT INTO product_overrides (product_slug, name, category, url) VALUES (?, ?, ?, ?) ON CONFLICT(product_slug) DO UPDATE SET name = excluded.name, category = excluded.category, url = excluded.url', [slug, name, category, url]);
  res.json({ success: true });
});

// Update product
router.put('/products/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { name, category, url, color, countries } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result]: any = await conn.query('UPDATE products SET name = ?, category = ?, status_url = ?, color = ? WHERE slug = ?', [name, category, url, color, slug]);
    
    await conn.query('DELETE FROM product_countries WHERE product_slug = ?', [slug]);
    if (Array.isArray(countries) && countries.length > 0) {
      const values = countries.flatMap(c => [slug, c]);
      const placeholders = countries.map(() => '(?, ?)').join(', ');
      await conn.query(`INSERT INTO product_countries (product_slug, country) VALUES ${placeholders}`, values);
    }
    
    await conn.commit();
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update product error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Update product general info (Contact info, office location, opening hours)
router.put('/product-general/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { office_location, contact_info, opening_hours } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO product_general_info (product_slug, office_location, contact_info, opening_hours) VALUES (?, ?, ?, ?) ON CONFLICT(product_slug) DO UPDATE SET office_location = excluded.office_location, contact_info = excluded.contact_info, opening_hours = excluded.opening_hours',
      [slug, office_location || '', contact_info || '', opening_hours || '']
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update product general info error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Create product
router.post('/products', async (req, res) => {
  const { name, slug, category, url, color, countries } = req.body;
  
  if (!slug) return res.status(400).json({ error: 'Slug is required' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT INTO products (slug, name, category, status_url, color) VALUES (?, ?, ?, ?, ?)', [slug, name || '', category || '', url || '', color || '#000000']);
    
    if (Array.isArray(countries) && countries.length > 0) {
      const values = countries.flatMap(c => [slug, c]);
      const placeholders = countries.map(() => '(?, ?)').join(', ');
      await conn.query(`INSERT INTO product_countries (product_slug, country) VALUES ${placeholders}`, values);
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Create product error:', err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Product slug already exists' });
    }
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Delete product
router.delete('/products/:slug', async (req, res) => {
  const slug = req.params.slug;
  
  try {
    await pool.query('DELETE FROM products WHERE slug = ?', [slug]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update product security info
router.put('/product-security/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { backup, mfa, encryption, sso, data_residency, sla_uptime } = req.body;
  
  try {
    await pool.query(`
      INSERT INTO product_security (product_slug, backup, mfa, encryption, sso, data_residency, sla_uptime) 
      VALUES (?, ?, ?, ?, ?, ?, ?) 
      ON CONFLICT(product_slug) DO UPDATE SET backup = excluded.backup, mfa = excluded.mfa, encryption = excluded.encryption, sso = excluded.sso, data_residency = excluded.data_residency, sla_uptime = excluded.sla_uptime
    `, [slug, backup, mfa ? 1 : 0, encryption, sso ? 1 : 0, data_residency, sla_uptime || '']);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update product security error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update product certification summary
router.put('/product-certifications/:slug/summary', async (req, res) => {
  const slug = req.params.slug;
  const { is_applicable, summary } = req.body;
  
  try {
    await pool.query('INSERT INTO product_certification_summary (product_slug, is_applicable, summary) VALUES (?, ?, ?) ON CONFLICT(product_slug) DO UPDATE SET is_applicable = excluded.is_applicable, summary = excluded.summary', [slug, is_applicable ? 1 : 0, summary]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update certification summary error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Add a certification
router.post('/product-certifications/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { name, certificate_url, soa_available, type, logo_url } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO product_certifications (product_slug, name, certificate_url, soa_available, type, logo_url) VALUES (?, ?, ?, ?, ?, ?)',
      [slug, name, certificate_url, soa_available ? 1 : 0, type || 'certificate', logo_url || null]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Add certification error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update a certification
router.put('/product-certifications/:id', async (req, res) => {
  const id = req.params.id;
  const { name, certificate_url, soa_available, type, logo_url } = req.body;
  try {
    await pool.query(
      'UPDATE product_certifications SET name = ?, certificate_url = ?, soa_available = ?, type = ?, logo_url = ? WHERE id = ?',
      [name, certificate_url, soa_available ? 1 : 0, type || 'certificate', logo_url || null, id]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update certification error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Delete a certification
router.delete('/product-certifications/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM product_certifications WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete certification error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Add a legal document version
router.post('/product-legal/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { document_type, url, file_url, effective_date, version, is_current } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (is_current) {
      await conn.query('UPDATE product_legal_documents SET is_current = 0 WHERE product_slug = ? AND document_type = ?', [slug, document_type]);
    }
    await conn.query(`
      INSERT INTO product_legal_documents (product_slug, document_type, url, file_url, effective_date, version, is_current)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [slug, document_type, url || '', file_url || null, effective_date || null, version || null, is_current ? 1 : 0]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Add legal document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Update a legal document version
router.put('/product-legal/:id', async (req, res) => {
  const id = req.params.id;
  const { url, file_url, effective_date, version, is_current, product_slug, document_type } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (is_current) {
      await conn.query('UPDATE product_legal_documents SET is_current = 0 WHERE product_slug = ? AND document_type = ?', [product_slug, document_type]);
    }
    await conn.query(`
      UPDATE product_legal_documents 
      SET url = ?, file_url = ?, effective_date = ?, version = ?, is_current = ?
      WHERE id = ?
    `, [url || '', file_url || null, effective_date || null, version || null, is_current ? 1 : 0, id]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update legal document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Delete a legal document version
router.delete('/product-legal/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM product_legal_documents WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete legal document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Add a policy
router.post('/product-policies/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { name, description, is_requestable, effective_date, version } = req.body;
  
  try {
    await pool.query('INSERT INTO product_policies (product_slug, name, description, is_requestable, effective_date, version) VALUES (?, ?, ?, ?, ?, ?)', [slug, name, description, is_requestable === undefined ? 1 : is_requestable, effective_date || null, version || null]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Add policy error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update a policy
router.put('/product-policies/:id', async (req, res) => {
  const id = req.params.id;
  const { name, description, is_requestable, effective_date, version } = req.body;
  
  try {
    await pool.query(
      'UPDATE product_policies SET name = ?, description = ?, is_requestable = ?, effective_date = ?, version = ? WHERE id = ?',
      [name, description, is_requestable === undefined ? 1 : is_requestable, effective_date || null, version || null, id]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Update policy error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Delete a policy
router.delete('/product-policies/:id', async (req: any, res) => {
  const id = req.params.id;
  try {
    const [existing]: any = await pool.query('SELECT name, product_slug FROM product_policies WHERE id = ?', [id]);
    const policyName = existing?.[0]?.name || `Policy #${id}`;
    const productSlug = existing?.[0]?.product_slug;

    await pool.query('DELETE FROM product_policies WHERE id = ?', [id]);

    logActivity({
      type: 'document_update',
      action: 'delete',
      title: `Deleted policy '${policyName}' (ID: ${id})`,
      actor: req.user?.username || 'Admin',
      target_type: 'policy',
      target_name: policyName,
      ip_address: req.ip || req.socket.remoteAddress,
      details: { id, name: policyName, productSlug }
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete policy error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update product controls
router.put('/product-controls/:slug', async (req, res) => {
  const slug = req.params.slug;
  const controls = req.body; // Array of { topic_id, status, description }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (controls && controls.length > 0) {
      const topicIds = controls.map((c: any) => c.topic_id);
      const placeholdersFormat = topicIds.map(() => '?').join(',');
      // Delete controls that are no longer in the list
      await conn.query(`DELETE FROM product_controls WHERE product_slug = ? AND topic_id NOT IN (${placeholdersFormat})`, [slug, ...topicIds]);

      const values: any[] = [];
      const placeholders: string[] = [];
      for (const ctrl of controls) {
        values.push(slug, ctrl.topic_id, ctrl.status, ctrl.description);
        placeholders.push('(?, ?, ?, ?, CURRENT_TIMESTAMP)');
      }
      await conn.query(`
        INSERT INTO product_controls (product_slug, topic_id, status, description, updated_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT(product_slug, topic_id) DO UPDATE SET status = excluded.status, description = excluded.description, updated_at = CURRENT_TIMESTAMP
      `, values);
    } else {
      // If empty array passed, delete all controls for this product
      await conn.query('DELETE FROM product_controls WHERE product_slug = ?', [slug]);
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update controls error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Add a subprocessor
router.post('/product-subprocessors/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { 
    name, 
    category, 
    region, 
    purpose, 
    website_url, 
    contact_details, 
    org_number,
    lei_number,
    nature_of_processing, 
    data_categories, 
    certifications, 
    dpa_url,
    dpa_requestable,
    recipients,
    transfers,
    retention,
    security_measures,
    countries 
  } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result]: any = await conn.query(
      'INSERT INTO product_subprocessors (product_slug, name, category, region, purpose, website_url, contact_details, org_number, lei_number, nature_of_processing, data_categories, certifications, dpa_url, dpa_requestable, recipients, transfers, retention, security_measures) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        slug, 
        name, 
        category, 
        region, 
        purpose, 
        website_url || null,
        contact_details || null,
        org_number || null,
        lei_number || null,
        nature_of_processing || null,
        data_categories || null,
        certifications || null,
        dpa_url || null,
        dpa_requestable ? 1 : 0,
        recipients || null,
        transfers || null,
        retention || null,
        security_measures || null
      ]
    );
    
    const subprocessorId = result.insertId;
    
    if (countries && Array.isArray(countries)) {
      for (const country of countries) {
        await conn.query('INSERT INTO subprocessor_countries (subprocessor_id, country) VALUES (?, ?)', [subprocessorId, country]);
      }
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Add subprocessor error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Delete a subprocessor
router.delete('/product-subprocessors/:id', async (req, res) => {
  const id = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM subprocessor_countries WHERE subprocessor_id = ?', [id]);
    await conn.query('DELETE FROM product_subprocessors WHERE id = ?', [id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Delete subprocessor error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Update a subprocessor
router.put('/product-subprocessors/:id', async (req, res) => {
  const id = req.params.id;
  const { 
    name, 
    category, 
    region, 
    purpose, 
    website_url, 
    contact_details, 
    org_number,
    lei_number,
    nature_of_processing, 
    data_categories, 
    certifications, 
    dpa_url, 
    dpa_requestable,
    recipients,
    transfers,
    retention,
    security_measures,
    countries 
  } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE product_subprocessors SET name = ?, category = ?, region = ?, purpose = ?, website_url = ?, contact_details = ?, org_number = ?, lei_number = ?, nature_of_processing = ?, data_categories = ?, certifications = ?, dpa_url = ?, dpa_requestable = ?, recipients = ?, transfers = ?, retention = ?, security_measures = ? WHERE id = ?',
      [
        name, 
        category, 
        region, 
        purpose, 
        website_url || null,
        contact_details || null,
        org_number || null,
        lei_number || null,
        nature_of_processing || null,
        data_categories || null,
        certifications || null,
        dpa_url || null,
        dpa_requestable ? 1 : 0,
        recipients || null,
        transfers || null,
        retention || null,
        security_measures || null,
        id
      ]
    );
    
    await conn.query('DELETE FROM subprocessor_countries WHERE subprocessor_id = ?', [id]);
    if (countries && Array.isArray(countries)) {
      for (const country of countries) {
        await conn.query('INSERT INTO subprocessor_countries (subprocessor_id, country) VALUES (?, ?)', [id, country]);
      }
    }
    
    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update subprocessor error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Add a subprocessor history entry
router.post('/subprocessor-history/:slug', async (req, res) => {
  const slug = req.params.slug;
  const { version, date, description } = req.body;
  
  try {
    await pool.query('INSERT INTO subprocessor_history (product_slug, version, date, description) VALUES (?, ?, ?, ?)', [slug, version, date, description]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Add history entry error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Delete a subprocessor history entry
router.delete('/subprocessor-history/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM subprocessor_history WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete history entry error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Get all documents (admin view)
router.get('/documents', async (req, res) => {
  const [documents]: any = await pool.query('SELECT * FROM documents');
  res.json(documents);
});

// Create a document
router.post('/documents', async (req: any, res) => {
  const { name, slug, type, category, requires_nda, url, provider, findings_status, products, description } = req.body;
  
  if (!slug || !name || !type) return res.status(400).json({ error: 'Missing required fields' });
  
  try {
    await pool.query(`
      INSERT INTO documents (name, slug, type, category, requires_nda, url, provider, findings_status, products, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, slug, type, category, requires_nda ? 1 : 0, url, provider, findings_status, JSON.stringify(products || []), description || null]);
    
    logActivity({
      type: 'document_update',
      action: 'create',
      title: `Created document '${name}' (${type})`,
      actor: req.user?.username || 'Admin',
      target_type: 'document',
      target_name: name,
      ip_address: req.ip || req.socket.remoteAddress,
      details: { slug, type, category, requires_nda: !!requires_nda }
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Create document error:', err);
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Document slug already exists' });
    }
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update a document
router.put('/documents/:id', async (req: any, res) => {
  const id = req.params.id;
  const { name, slug, type, category, requires_nda, url, provider, findings_status, products, description } = req.body;
  
  try {
    await pool.query(`
      UPDATE documents 
      SET name = ?, slug = ?, type = ?, category = ?, requires_nda = ?, url = ?, provider = ?, findings_status = ?, products = ?, description = ?
      WHERE id = ?
    `, [name, slug, type, category, requires_nda ? 1 : 0, url, provider, findings_status, JSON.stringify(products || []), description || null, id]);
    
    logActivity({
      type: 'document_update',
      action: 'update',
      title: `Updated document '${name}' (ID: ${id})`,
      actor: req.user?.username || 'Admin',
      target_type: 'document',
      target_name: name,
      ip_address: req.ip || req.socket.remoteAddress,
      details: { id, slug, type, category, requires_nda: !!requires_nda }
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Update document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Delete a document
router.delete('/documents/:id', async (req: any, res) => {
  const id = req.params.id;
  try {
    const [existing]: any = await pool.query('SELECT name FROM documents WHERE id = ?', [id]);
    const docName = existing?.[0]?.name || `Document #${id}`;

    await pool.query('DELETE FROM documents WHERE id = ?', [id]);

    logActivity({
      type: 'document_update',
      action: 'delete',
      title: `Deleted document '${docName}' (ID: ${id})`,
      actor: req.user?.username || 'Admin',
      target_type: 'document',
      target_name: docName,
      ip_address: req.ip || req.socket.remoteAddress,
      details: { id, name: docName }
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Update dashboard settings
router.put('/dashboard-settings', async (req, res) => {
  const settings = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const entries = Object.entries(settings);
    if (entries.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];
      for (const [key, value] of entries) {
        const valStr = typeof value === 'string' ? value : JSON.stringify(value);
        values.push(key, valStr);
        placeholders.push('(?, ?)');
      }
      await conn.query(`INSERT INTO dashboard_settings ("key", "value") VALUES ${placeholders.join(', ')} ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`, values);
    }

    // Keep active NDA version synchronized if nda_notice or nda_url was changed directly in site settings
    if (settings.nda_notice !== undefined || settings.nda_url !== undefined) {
      try {
        const [activeRows]: any = await conn.query('SELECT id, content, nda_url FROM nda_versions WHERE is_current = 1 LIMIT 1');
        if (activeRows && activeRows.length > 0) {
          const current = activeRows[0];
          const newContent = settings.nda_notice !== undefined ? settings.nda_notice : current.content;
          const newUrl = settings.nda_url !== undefined ? settings.nda_url : current.nda_url;
          await conn.query('UPDATE nda_versions SET content = ?, nda_url = ? WHERE id = ?', [newContent, newUrl, current.id]);
        }
      } catch (syncErr) {
        console.error('Failed to sync active NDA version:', syncErr);
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Update dashboard settings error:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

// Upload logo
router.post('/upload-logo', (req: any, res: any) => {
  upload.single('logo')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error uploading image' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const logoUrl = `/uploads/${req.file.filename}`;
    res.json({ url: logoUrl });
  });
});

// Upload favicon
router.post('/upload-favicon', uploadFavicon.single('favicon'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const faviconUrl = `/uploads/${req.file.filename}`;
  res.json({ url: faviconUrl });
});

// Upload pdf
router.post('/upload-pdf', requireAdminOrMod, uploadPdf.single('document'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT id, event_type, product_slug, item_name, user_email, created_at
      FROM metrics_events
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NDA Versions endpoints
router.get('/nda-versions', async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT id, version, content, nda_url, change_summary, created_by, effective_date, is_current, created_at
      FROM nda_versions
      ORDER BY id DESC
    `);
    res.json(rows);
  } catch (err: any) {
    console.error('Error fetching NDA versions:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

router.post('/nda-versions', async (req: any, res) => {
  const { version, content, nda_url, change_summary, effective_date, set_as_current } = req.body;
  if (!version || !content) {
    return res.status(400).json({ error: 'Version string and NDA content are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const isCurrent = set_as_current !== false ? 1 : 0;
    if (isCurrent === 1) {
      await conn.query('UPDATE nda_versions SET is_current = 0');
    }

    const createdBy = req.user?.username || 'Admin';
    const effDate = effective_date || new Date().toISOString().split('T')[0];

    const [result]: any = await conn.query(`
      INSERT INTO nda_versions (version, content, nda_url, change_summary, created_by, effective_date, is_current)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [version.trim(), content, nda_url ? nda_url.trim() : '', change_summary ? change_summary.trim() : 'Updated NDA terms', createdBy, effDate, isCurrent]);

    if (isCurrent === 1) {
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_notice', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [content]);
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_url', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [nda_url ? nda_url.trim() : '']);
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_version', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [version.trim()]);
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_effective_date', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [effDate]);
    }

    await conn.commit();

    logActivity({
      type: 'document_update',
      action: 'create',
      title: `Created Non-Disclosure Agreement (NDA) v${version.trim()}`,
      actor: createdBy,
      target_type: 'nda',
      target_name: `NDA v${version.trim()}`,
      ip_address: req.ip || req.socket.remoteAddress,
      details: { version: version.trim(), change_summary, isCurrent }
    });

    const [allVersions]: any = await pool.query('SELECT * FROM nda_versions ORDER BY id DESC');
    res.json({ success: true, id: result.insertId, versions: allVersions });
  } catch (err: any) {
    await conn.rollback();
    console.error('Error creating NDA version:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

router.put('/nda-versions/:id', async (req: any, res) => {
  const id = req.params.id;
  const { version, change_summary, effective_date, content, nda_url } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing]: any = await conn.query('SELECT * FROM nda_versions WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Version not found' });
    }

    const row = existing[0];
    const newVersion = version !== undefined ? version.trim() : row.version;
    const newSummary = change_summary !== undefined ? change_summary.trim() : row.change_summary;
    const newEffDate = effective_date !== undefined ? effective_date : row.effective_date;
    const newContent = content !== undefined ? content : row.content;
    const newUrl = nda_url !== undefined ? nda_url.trim() : row.nda_url;

    await conn.query(`
      UPDATE nda_versions 
      SET version = ?, change_summary = ?, effective_date = ?, content = ?, nda_url = ?
      WHERE id = ?
    `, [newVersion, newSummary, newEffDate, newContent, newUrl, id]);

    if (row.is_current === 1) {
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_notice', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [newContent]);
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_url', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [newUrl]);
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_version', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [newVersion]);
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_effective_date', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [newEffDate]);
    }

    await conn.commit();

    const [allVersions]: any = await pool.query('SELECT * FROM nda_versions ORDER BY id DESC');
    res.json({ success: true, versions: allVersions });
  } catch (err: any) {
    await conn.rollback();
    console.error('Error updating NDA version:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

router.post('/nda-versions/:id/restore', async (req: any, res) => {
  const id = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query('SELECT * FROM nda_versions WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Version not found' });
    }

    const versionToRestore = rows[0];

    // Mark all as non-current, then activate this one
    await conn.query('UPDATE nda_versions SET is_current = 0');
    await conn.query('UPDATE nda_versions SET is_current = 1 WHERE id = ?', [id]);

    // Update dashboard_settings
    await conn.query(`
      INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_notice', ?)
      ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
    `, [versionToRestore.content]);
    await conn.query(`
      INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_url', ?)
      ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
    `, [versionToRestore.nda_url || '']);
    await conn.query(`
      INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_version', ?)
      ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
    `, [versionToRestore.version]);
    if (versionToRestore.effective_date) {
      await conn.query(`
        INSERT INTO dashboard_settings ("key", "value") VALUES ('nda_effective_date', ?)
        ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"
      `, [versionToRestore.effective_date]);
    }

    await conn.commit();

    const [allVersions]: any = await pool.query('SELECT * FROM nda_versions ORDER BY id DESC');
    res.json({ success: true, restored: versionToRestore, versions: allVersions });
  } catch (err: any) {
    await conn.rollback();
    console.error('Error restoring NDA version:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  } finally {
    conn.release();
  }
});

router.delete('/nda-versions/:id', async (req: any, res) => {
  const id = req.params.id;
  try {
    const [rows]: any = await pool.query('SELECT * FROM nda_versions WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }
    if (rows[0].is_current === 1) {
      return res.status(400).json({ error: 'Cannot delete the active NDA version. Restore another version first before deleting.' });
    }

    await pool.query('DELETE FROM nda_versions WHERE id = ?', [id]);
    const [allVersions]: any = await pool.query('SELECT * FROM nda_versions ORDER BY id DESC');
    res.json({ success: true, versions: allVersions });
  } catch (err: any) {
    console.error('Error deleting NDA version:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// ---------------------------------------------------------------------------
// Activity Logs & Audit Trails
// ---------------------------------------------------------------------------

router.get('/activity-logs', async (req: any, res) => {
  try {
    const { type, search, limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
    const offsetNum = Math.max(parseInt(String(offset), 10) || 0, 0);

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (type && type !== 'all') {
      whereClauses.push('type = ?');
      params.push(type);
    }

    if (search && String(search).trim() !== '') {
      const q = `%${String(search).trim()}%`;
      whereClauses.push('(title LIKE ? OR actor LIKE ? OR target_name LIKE ? OR ip_address LIKE ? OR details LIKE ?)');
      params.push(q, q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fetch filtered logs
    const [logs]: any = await pool.query(`
      SELECT id, type, action, title, actor, target_type, target_name, details, ip_address, status, created_at
      FROM activity_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offsetNum]);

    // Fetch count for current filter
    const [totalRows]: any = await pool.query(`
      SELECT count(*) as count FROM activity_logs ${whereSql}
    `, params);
    const total = totalRows?.[0]?.count || 0;

    // Fetch overall stats
    const [statsRows]: any = await pool.query(`
      SELECT 
        count(*) as total,
        sum(case when type = 'document_update' then 1 else 0 end) as document_updates,
        sum(case when type = 'access_request' then 1 else 0 end) as access_requests,
        sum(case when type = 'user_login' then 1 else 0 end) as user_logins
      FROM activity_logs
    `);

    const stats = {
      total: statsRows?.[0]?.total || 0,
      document_updates: statsRows?.[0]?.document_updates || 0,
      access_requests: statsRows?.[0]?.access_requests || 0,
      user_logins: statsRows?.[0]?.user_logins || 0
    };

    const mappedLogs = (logs || []).map((l: any) => {
      let parsedDetails = null;
      if (l.details) {
        try {
          parsedDetails = JSON.parse(l.details);
        } catch (e) {
          parsedDetails = l.details;
        }
      }
      return {
        ...l,
        details: parsedDetails
      };
    });

    // Ensure all access_request entries have requestId linked
    for (const l of mappedLogs) {
      if (l.type === 'access_request' && !l.details?.requestId && l.details?.requester) {
        try {
          const [match]: any = await pool.query(
            'SELECT id FROM access_requests WHERE requester_name = ? AND document_name = ? LIMIT 1',
            [l.details.requester, l.target_name || '']
          );
          if (match && match.length > 0) {
            l.details.requestId = match[0].id;
          }
        } catch (e) {}
      }
    }

    // Enrich access request entries with current watermarked files & status from access_requests table
    const requestIds = mappedLogs
      .filter((l: any) => l.type === 'access_request' && l.details?.requestId)
      .map((l: any) => l.details.requestId);

    if (requestIds.length > 0) {
      const placeholders = requestIds.map(() => '?').join(',');
      const [reqRows]: any = await pool.query(
        `SELECT id, status, document_file_url, watermarked_file_url, document_name, requester_name, business_email, company FROM access_requests WHERE id IN (${placeholders})`,
        requestIds
      );
      const reqMap = new Map();
      for (const r of reqRows) {
        reqMap.set(r.id, r);
      }
      for (const l of mappedLogs) {
        if (l.type === 'access_request' && l.details?.requestId) {
          const reqItem = reqMap.get(l.details.requestId);
          if (reqItem) {
            l.details.status = reqItem.status;
            l.details.document_file_url = reqItem.document_file_url;
            l.details.watermarked_file_url = reqItem.watermarked_file_url;
            if (!l.details.documentName) l.details.documentName = reqItem.document_name;
            if (!l.details.requester) l.details.requester = reqItem.requester_name;
            if (!l.details.email) l.details.email = reqItem.business_email;
            if (!l.details.company) l.details.company = reqItem.company;
          }
        }
      }
    }

    res.json({
      logs: mappedLogs,
      total,
      stats
    });
  } catch (err: any) {
    console.error('Error fetching activity logs:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

router.get('/access-requests', async (req: any, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT * FROM access_requests ORDER BY created_at DESC
    `);
    res.json(rows || []);
  } catch (err: any) {
    console.error('Error fetching access requests:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

router.put('/access-requests/:id/status', async (req: any, res) => {
  const id = req.params.id;
  const { status } = req.body;
  if (!status || !['pending', 'approved', 'rejected', 'fulfilled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const [existing]: any = await pool.query('SELECT * FROM access_requests WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Access request not found' });
    }
    const reqItem = existing[0];

    await pool.query('UPDATE access_requests SET status = ? WHERE id = ?', [status, id]);

    logActivity({
      type: 'access_request',
      action: `request_${status}`,
      title: `Access request for '${reqItem.document_name}' (${reqItem.requester_name}) marked as ${status.toUpperCase()}`,
      actor: req.user?.username || 'Admin',
      target_type: 'access_request',
      target_name: reqItem.document_name,
      ip_address: req.ip || req.socket.remoteAddress,
      status: status === 'rejected' ? 'failed' : 'success',
      details: {
        requestId: id,
        documentName: reqItem.document_name,
        requester: reqItem.requester_name,
        email: reqItem.business_email,
        company: reqItem.company,
        previousStatus: reqItem.status,
        newStatus: status,
        updatedBy: req.user?.username
      }
    });

    res.json({ success: true, status });
  } catch (err: any) {
    console.error('Error updating access request status:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Upload document for an access request and automatically generate a watermarked version
router.post('/access-requests/:id/upload-and-watermark', requireAdminOrMod, uploadPdf.single('document'), async (req: any, res) => {
  const id = req.params.id;
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  try {
    const [existing]: any = await pool.query('SELECT * FROM access_requests WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Access request not found' });
    }
    const reqItem = existing[0];
    const uploadedOriginalUrl = `/uploads/${req.file.filename}`;
    const originalFilePath = path.join(process.cwd(), 'public', 'uploads', req.file.filename);

    // Read original PDF
    const originalPdfBytes = fs.readFileSync(originalFilePath);
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();
    const recipientName = reqItem.requester_name || 'Authorized Recipient';
    const recipientEmail = reqItem.business_email || '';
    const recipientCompany = reqItem.company || '';
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    // Build watermark texts
    const diagonalMain = `CONFIDENTIAL - LICENSED TO: ${recipientCompany ? recipientCompany.toUpperCase() : recipientName.toUpperCase()}`;
    const diagonalSub = `${recipientName} (${recipientEmail}) • Request ID #${id}`;
    const headerFooterBanner = `AUTHORIZED COPY: ${recipientName} | ${recipientEmail} | ${recipientCompany} | Request #${id} | ${timestamp}`;

    for (const page of pages) {
      const { width, height } = page.getSize();

      // Top running banner
      page.drawRectangle({
        x: 0,
        y: height - 20,
        width: width,
        height: 20,
        color: rgb(0.96, 0.97, 0.99),
        opacity: 0.92,
      });
      page.drawText(headerFooterBanner, {
        x: 15,
        y: height - 14,
        size: 7.5,
        font: helveticaFont,
        color: rgb(0.2, 0.25, 0.35),
      });

      // Bottom running banner
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 18,
        color: rgb(0.96, 0.97, 0.99),
        opacity: 0.92,
      });
      page.drawText(`Björn Lunden Trust Center • Protected under NDA • Distribution, copying, or forwarding strictly prohibited.`, {
        x: 15,
        y: 5,
        size: 7,
        font: helveticaFont,
        color: rgb(0.4, 0.45, 0.55),
      });

      // Diagonal semi-transparent watermark across the center
      const fontSize = Math.min(width, height) > 500 ? 19 : 14;
      const subFontSize = fontSize * 0.7;
      
      const centerX = width / 2;
      const centerY = height / 2;

      // Diagonal angle: 45 degrees
      page.drawText(diagonalMain, {
        x: centerX - 180,
        y: centerY - 10,
        size: fontSize,
        font: helveticaBold,
        color: rgb(0.72, 0.15, 0.15), // Muted red/burgundy security stamp
        opacity: 0.22,
        rotate: degrees(45),
      });

      page.drawText(diagonalSub, {
        x: centerX - 180,
        y: centerY - 32,
        size: subFontSize,
        font: helveticaFont,
        color: rgb(0.3, 0.35, 0.45),
        opacity: 0.24,
        rotate: degrees(45),
      });
    }

    const watermarkedPdfBytes = await pdfDoc.save();
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const watermarkedFileName = `watermarked-req-${id}-${Date.now()}.pdf`;
    const watermarkedFilePath = path.join(uploadsDir, watermarkedFileName);
    fs.writeFileSync(watermarkedFilePath, watermarkedPdfBytes);
    const watermarkedFileUrl = `/uploads/${watermarkedFileName}`;

    // Update the request record in database
    const newStatus = req.body?.status || (reqItem.status === 'pending' ? 'fulfilled' : reqItem.status);
    await pool.query(
      'UPDATE access_requests SET document_file_url = ?, watermarked_file_url = ?, status = ? WHERE id = ?',
      [uploadedOriginalUrl, watermarkedFileUrl, newStatus, id]
    );

    await logActivity({
      type: 'access_request',
      action: 'document_watermarked',
      title: `Watermarked PDF generated for '${reqItem.document_name}' (${reqItem.requester_name} - ${reqItem.company})`,
      actor: req.user?.username || 'Admin',
      target_type: 'access_request',
      target_name: reqItem.document_name,
      ip_address: req.ip || req.socket.remoteAddress,
      status: 'success',
      details: {
        requestId: id,
        documentName: reqItem.document_name,
        requester: reqItem.requester_name,
        email: reqItem.business_email,
        company: reqItem.company,
        status: newStatus,
        originalFile: uploadedOriginalUrl,
        watermarkedFile: watermarkedFileUrl
      }
    });

    res.json({
      success: true,
      status: newStatus,
      document_file_url: uploadedOriginalUrl,
      watermarked_file_url: watermarkedFileUrl,
      requester: {
        name: recipientName,
        email: recipientEmail,
        company: recipientCompany
      }
    });
  } catch (err: any) {
    console.error('Error watermarking PDF for request:', err);
    res.status(500).json({ error: err.message || 'Failed to watermark PDF' });
  }
});

// Regenerate or watermark an existing uploaded PDF for an access request
router.post('/access-requests/:id/generate-watermark', requireAdminOrMod, async (req: any, res) => {
  const id = req.params.id;
  const { sourceFileUrl } = req.body;

  try {
    const [existing]: any = await pool.query('SELECT * FROM access_requests WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Access request not found' });
    }
    const reqItem = existing[0];
    const fileToUse = sourceFileUrl || reqItem.document_file_url;

    if (!fileToUse) {
      return res.status(400).json({ error: 'No source PDF found to watermark' });
    }

    const relativePath = fileToUse.replace(/^\//, '');
    const originalFilePath = path.join(process.cwd(), 'public', relativePath.replace(/^public\//, ''));
    if (!fs.existsSync(originalFilePath)) {
      return res.status(404).json({ error: 'Source file could not be found on server' });
    }

    const originalPdfBytes = fs.readFileSync(originalFilePath);
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();
    const recipientName = reqItem.requester_name || 'Authorized Recipient';
    const recipientEmail = reqItem.business_email || '';
    const recipientCompany = reqItem.company || '';
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    const diagonalMain = `CONFIDENTIAL - LICENSED TO: ${recipientCompany ? recipientCompany.toUpperCase() : recipientName.toUpperCase()}`;
    const diagonalSub = `${recipientName} (${recipientEmail}) • Request ID #${id}`;
    const headerFooterBanner = `AUTHORIZED COPY: ${recipientName} | ${recipientEmail} | ${recipientCompany} | Request #${id} | ${timestamp}`;

    for (const page of pages) {
      const { width, height } = page.getSize();

      page.drawRectangle({
        x: 0,
        y: height - 20,
        width: width,
        height: 20,
        color: rgb(0.96, 0.97, 0.99),
        opacity: 0.92,
      });
      page.drawText(headerFooterBanner, {
        x: 15,
        y: height - 14,
        size: 7.5,
        font: helveticaFont,
        color: rgb(0.2, 0.25, 0.35),
      });

      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 18,
        color: rgb(0.96, 0.97, 0.99),
        opacity: 0.92,
      });
      page.drawText(`Björn Lunden Trust Center • Protected under NDA • Distribution, copying, or forwarding strictly prohibited.`, {
        x: 15,
        y: 5,
        size: 7,
        font: helveticaFont,
        color: rgb(0.4, 0.45, 0.55),
      });

      const fontSize = Math.min(width, height) > 500 ? 19 : 14;
      const subFontSize = fontSize * 0.7;
      const centerX = width / 2;
      const centerY = height / 2;

      page.drawText(diagonalMain, {
        x: centerX - 180,
        y: centerY - 10,
        size: fontSize,
        font: helveticaBold,
        color: rgb(0.72, 0.15, 0.15),
        opacity: 0.22,
        rotate: degrees(45),
      });

      page.drawText(diagonalSub, {
        x: centerX - 180,
        y: centerY - 32,
        size: subFontSize,
        font: helveticaFont,
        color: rgb(0.3, 0.35, 0.45),
        opacity: 0.24,
        rotate: degrees(45),
      });
    }

    const watermarkedPdfBytes = await pdfDoc.save();
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const watermarkedFileName = `watermarked-req-${id}-${Date.now()}.pdf`;
    const watermarkedFilePath = path.join(uploadsDir, watermarkedFileName);
    fs.writeFileSync(watermarkedFilePath, watermarkedPdfBytes);
    const watermarkedFileUrl = `/uploads/${watermarkedFileName}`;

    await pool.query(
      'UPDATE access_requests SET watermarked_file_url = ? WHERE id = ?',
      [watermarkedFileUrl, id]
    );

    res.json({
      success: true,
      watermarked_file_url: watermarkedFileUrl
    });
  } catch (err: any) {
    console.error('Error generating watermark:', err);
    res.status(500).json({ error: err.message || 'Failed to generate watermarked document' });
  }
});

router.get('/activity-logs/export', async (req: any, res) => {
  try {
    const [logs]: any = await pool.query(`
      SELECT id, type, action, title, actor, target_type, target_name, details, ip_address, status, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 1000
    `);

    const format = req.query.format === 'json' ? 'json' : 'csv';

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-activity-log-${new Date().toISOString().slice(0, 10)}.json"`);
      return res.json(logs);
    }

    // CSV format
    const headers = ['ID', 'Timestamp', 'Type', 'Action', 'Title', 'Actor', 'Target Type', 'Target Name', 'IP Address', 'Status'];
    const rows = (logs || []).map((l: any) => [
      l.id,
      `"${l.created_at || ''}"`,
      `"${l.type || ''}"`,
      `"${l.action || ''}"`,
      `"${(l.title || '').replace(/"/g, '""')}"`,
      `"${l.actor || ''}"`,
      `"${l.target_type || ''}"`,
      `"${(l.target_name || '').replace(/"/g, '""')}"`,
      `"${l.ip_address || ''}"`,
      `"${l.status || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-activity-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    console.error('Error exporting activity logs:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

export default router;
