const fs = require('node:fs');
const path = require('node:path');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULE = 'services/catalogTitleServer.cjs';
function once(source, before, after) {
    if (source.includes(after)) return source;
    if (source.split(before).length !== 2) throw new Error('Missing or ambiguous release anchor: ' + before.slice(0, 70));
    return source.replace(before, after);
}
function patchEntry(source) {
    let value = source.replace(/\r\n/g, '\n');
    const family = '    LIMIT 1) AS parent_name`;\n}';
    value = once(value, family, '    LIMIT 1) AS parent_name,\n    ${productAlias}.catalog_title_complement,\n    (SELECT family_parent.catalog_title_complement FROM products family_parent\n     WHERE family_parent.id COLLATE utf8mb4_unicode_ci = ${productAlias}.parent_id COLLATE utf8mb4_unicode_ci\n     LIMIT 1) AS parent_catalog_title_complement`;\n}');
    const route = "fastify.patch('/products/:id/seo',";
    value = once(value, route, `require('./${MODULE}').registerCatalogTitleRoutes(fastify, { pool, requireSyncKeyOrAdmin });\n\n${route}`);
    const migration = `  await addColumnIfMissing('products', 'hide_from_catalog', "TINYINT(1) DEFAULT 0");`;
    value = once(value, migration, migration + `\n  await addColumnIfMissing('products', 'catalog_title_complement', "VARCHAR(120) NULL");`);
    const end = "      console.error(`[synology] Background upload error: ${fileName}`, err.message);\n    }\n  });\n});";
    value = once(value, end, end.replace('\n});', '\n  // Keep the async handler pending until response hooks finish serializing the upload receipt.\n  return reply;\n});'));
    return source.includes('\r\n') ? value.replace(/\n/g, '\r\n') : value;
}
async function deployCatalogTitleUpload(options) {
    const moduleSource = fs.readFileSync(path.join(options.root, MODULE), 'utf8');
    await deployProductReadPrivacy({ ...options, files: [MODULE, ...ENTRIES], backupPrefix: 'catalog-title-upload',
        patchFile(source, file) {
            if (file !== MODULE) return patchEntry(source);
            if (source && source.replace(/\r\n/g, '\n') !== moduleSource.replace(/\r\n/g, '\n')) throw new Error('Remote catalog title module drift');
            return moduleSource;
        },
    });
}
module.exports = { patchEntry, deployCatalogTitleUpload };
