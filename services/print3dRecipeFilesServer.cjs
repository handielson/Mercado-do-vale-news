'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 50 * 1024 * 1024;
const EXTENSIONS = Object.freeze({
  model: ['.stl', '.obj', '.step', '.stp'],
  project: ['.3mf', '.f3d'],
  gcode: ['.gcode', '.gco'],
  'print-json': ['.json'],
  preview: ['.png', '.jpg', '.jpeg', '.webp'],
  instructions: ['.txt', '.pdf'],
});

function isPrivatePrint3dRoot(value) {
  const root = String(value || '').trim();
  return /^\/(?:home|volume\d+)\/[A-Za-z0-9._/-]+\/producao-3d$/.test(root)
    && !root.split('/').some((part, index) => index > 0 && (!part || part === '.' || part === '..'));
}

function registerPrint3dRecipeFileRoutes(app, {
  pool, getBearerAuthContext,
  enabled = process.env.MDV_PRINT3D_RECIPES_ENABLED === '1',
  privateRoot = process.env.MDV_PRINT3D_SYNOLOGY_FOLDER || '',
  uploadPrivate,
  downloadPrivate,
}) {
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
    req.print3dActor = String(auth.userId);
  };
  const ready = (reply) => {
    if (enabled && isPrivatePrint3dRoot(privateRoot) && uploadPrivate && downloadPrivate) return true;
    reply.code(503).send({ error: 'Arquivos 3D privados ainda não habilitados.' });
    return false;
  };
  const recipeId = (req, reply) => {
    const id = String(req.params?.recipeId || '');
    if (UUID.test(id)) return id;
    reply.code(400).send({ error: 'Identificador de ficha inválido.' });
    return null;
  };
  const findFile = async (id, kind, sha) => {
    const [rows] = await pool.query(
      'SELECT id,recipe_id,kind,printer_profile,original_name,byte_size,sha256,created_at FROM print3d_recipe_files WHERE recipe_id=? AND kind=? AND sha256=? LIMIT 1',
      [id, kind, sha]
    );
    return rows[0] || null;
  };

  app.get('/admin/print3d/files/status', { preHandler: admin }, async () => ({
    enabled: Boolean(enabled && isPrivatePrint3dRoot(privateRoot) && uploadPrivate && downloadPrivate),
    maxBytes: MAX_BYTES,
  }));

  app.get('/admin/print3d/recipes/:recipeId/files', { preHandler: admin }, async (req, reply) => {
    if (!ready(reply)) return;
    const id = recipeId(req, reply);
    if (!id) return;
    const [recipes] = await pool.query('SELECT id FROM print3d_recipe_revisions WHERE id=? LIMIT 1', [id]);
    if (!recipes[0]) return reply.code(404).send({ error: 'Ficha não encontrada.' });
    const [rows] = await pool.query(
      'SELECT id,recipe_id,kind,printer_profile,original_name,byte_size,sha256,created_at FROM print3d_recipe_files WHERE recipe_id=? ORDER BY created_at,id', [id]
    );
    return { files: rows.map(({ id: fileId, recipe_id, kind, printer_profile, original_name, byte_size, sha256, created_at }) => ({
      id: fileId, recipe_id, kind, printer_profile, original_name, byte_size, sha256, created_at,
    })) };
  });

  app.post('/admin/print3d/recipes/:recipeId/files', { preHandler: admin }, async (req, reply) => {
    if (!ready(reply)) return;
    const id = recipeId(req, reply);
    if (!id) return;
    const kind = String(req.query?.kind || '');
    if (!Object.hasOwn(EXTENSIONS, kind)) return reply.code(400).send({ error: 'Tipo de arquivo inválido.' });
    const printerProfile = String(req.query?.printerProfile || '').trim();
    if (kind === 'gcode' && (!printerProfile || printerProfile.length > 120 || /[\x00-\x1f\x7f]/.test(printerProfile))) {
      return reply.code(400).send({ error: 'Informe a impressora e o perfil compatíveis com o G-code.' });
    }
    const [recipes] = await pool.query(
      'SELECT id,sku_snapshot,revision,draft_json FROM print3d_recipe_revisions WHERE id=? LIMIT 1', [id]
    );
    const recipe = recipes[0];
    if (!recipe) return reply.code(404).send({ error: 'Ficha não encontrada.' });
    const draft = typeof recipe.draft_json === 'string' ? JSON.parse(recipe.draft_json) : recipe.draft_json;
    let part;
    try { part = await req.file({ limits: { fileSize: MAX_BYTES, files: 1 } }); }
    catch { return reply.code(413).send({ error: 'Envie um arquivo de até 50 MB.' }); }
    if (!part || part.fieldname !== 'file') return reply.code(400).send({ error: 'Campo file obrigatório.' });
    const originalName = String(part.filename || '').trim();
    const ext = path.extname(originalName).toLowerCase();
    if (!originalName || originalName.length > 255 || /[\\/\x00-\x1f\x7f]/.test(originalName) || !EXTENSIONS[kind].includes(ext)) {
      part.file.resume();
      return reply.code(400).send({ error: 'Nome ou extensão incompatível com o tipo escolhido.' });
    }
    let buffer;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of part.file) {
        size += chunk.length;
        if (size > MAX_BYTES) throw new Error('file_too_large');
        chunks.push(chunk);
      }
      if (part.file.truncated || size === 0) throw new Error('empty_or_truncated');
      buffer = Buffer.concat(chunks);
    } catch { return reply.code(413).send({ error: 'Arquivo vazio ou maior que 50 MB.' }); }
    if (kind === 'print-json') {
      let summary;
      try {
        const { parsePrint3dSummary } = await import('../utils/print3dImport.mjs');
        summary = parsePrint3dSummary(buffer.toString('utf8'));
      } catch (error) { return reply.code(400).send({ error: error.message }); }
      if (summary.materialGrams !== draft.printSummary.material_gramas || summary.printMinutes !== draft.printSummary.tempo_impressao_minutos) {
        return reply.code(409).send({ error: 'Material ou tempo do JSON diverge da ficha salva.' });
      }
    }
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const existing = await findFile(id, kind, sha256);
    if (existing) {
      if (kind === 'gcode' && existing.printer_profile !== printerProfile) return reply.code(409).send({ error: 'Este G-code já foi registrado com outro perfil.' });
      return { file: existing, saved: false };
    }
    const storageName = `${kind}-${sha256}${ext}`;
    const folder = `${privateRoot}/produtos/${draft.sku}/revisoes/${draft.revision}`;
    const expectedPath = `${folder}/${storageName}`;
    let nasPath;
    try { nasPath = await uploadPrivate({ folderPath: folder, fileName: storageName, fileBuffer: buffer, allowedRoot: privateRoot }); }
    catch {
      // A previous request may have reached the NAS but failed before MySQL recorded it.
      try {
        const previous = await downloadPrivate({ filePath: expectedPath, allowedRoot: privateRoot, maxBytes: MAX_BYTES });
        if (previous.length === buffer.length && crypto.createHash('sha256').update(previous).digest('hex') === sha256) nasPath = expectedPath;
      } catch { /* NAS unavailable or file absent: leave the revision untouched. */ }
      if (!nasPath) return reply.code(502).send({ error: 'Falha no envio ao Synology. Arquivo não registrado.' });
    }
    if (nasPath !== expectedPath) return reply.code(502).send({ error: 'Caminho inesperado no Synology. Arquivo não registrado.' });
    const fileId = crypto.randomUUID();
    try {
      await pool.query(
        'INSERT INTO print3d_recipe_files (id,recipe_id,kind,printer_profile,original_name,storage_name,synology_path,byte_size,sha256,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [fileId, id, kind, kind === 'gcode' ? printerProfile : null, originalName, storageName, nasPath, buffer.length, sha256, req.print3dActor]
      );
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const concurrent = await findFile(id, kind, sha256);
      if (concurrent) {
        if (kind === 'gcode' && concurrent.printer_profile !== printerProfile) return reply.code(409).send({ error: 'Este G-code já foi registrado com outro perfil.' });
        return { file: concurrent, saved: false };
      }
      return reply.code(409).send({ error: 'Conflito ao registrar arquivo da revisão.' });
    }
    return reply.code(201).send({ file: { id: fileId, recipe_id: id, kind, printer_profile: kind === 'gcode' ? printerProfile : null, original_name: originalName, byte_size: buffer.length, sha256 }, saved: true });
  });

  app.get('/admin/print3d/files/:fileId/download', { preHandler: admin }, async (req, reply) => {
    if (!ready(reply)) return;
    const id = String(req.params?.fileId || '');
    if (!UUID.test(id)) return reply.code(400).send({ error: 'Identificador de arquivo inválido.' });
    const [rows] = await pool.query(
      'SELECT id,storage_name,synology_path,sha256,byte_size FROM print3d_recipe_files WHERE id=? LIMIT 1', [id]
    );
    const file = rows[0];
    if (!file) return reply.code(404).send({ error: 'Arquivo não encontrado.' });
    if (!String(file.synology_path).startsWith(`${privateRoot}/produtos/`)) return reply.code(409).send({ error: 'Caminho privado inválido.' });
    let buffer;
    try { buffer = await downloadPrivate({ filePath: file.synology_path, allowedRoot: privateRoot, maxBytes: MAX_BYTES }); }
    catch { return reply.code(502).send({ error: 'Arquivo indisponível no Synology.' }); }
    const digest = crypto.createHash('sha256').update(buffer).digest('hex');
    if (digest !== file.sha256 || buffer.length !== Number(file.byte_size)) return reply.code(502).send({ error: 'Integridade do arquivo não confere.' });
    reply.header('Content-Disposition', `attachment; filename="${file.storage_name}"`);
    reply.header('Content-Type', 'application/octet-stream');
    return reply.send(buffer);
  });
}

module.exports = { registerPrint3dRecipeFileRoutes, isPrivatePrint3dRoot };
