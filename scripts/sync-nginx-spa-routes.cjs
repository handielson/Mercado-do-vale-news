const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// routes/index.tsx remains the source of truth; comments and the '*' route
// must never expand the server fallback to arbitrary URLs.
function routePatterns(source) {
  const file = ts.createSourceFile('routes.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const paths = new Set();
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'path' && ts.isStringLiteral(node.initializer)) {
      const value = node.initializer.text;
      if (value.startsWith('/')) paths.add(value);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...paths].sort().map(value => value === '/' ? '/' : value.split('/').slice(1).map(segment => {
    if (segment.startsWith(':')) return segment.endsWith('?') ? '(?:/[^/]+)?' : '/[^/]+';
    return '/' + segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join(''));
}

function spaBlock(source) {
  const patterns = routePatterns(source);
  const blocks = [];
  // Keep directives below Nginx's configuration token length limit.
  for (let index = 0; index < patterns.length; index += 25) {
    blocks.push(
      `    location ~ "^(?:${patterns.slice(index, index + 25).join('|')})/?$" {`,
      '        try_files $uri $uri/ /index.html;',
      '    }',
    );
  }
  return [
    '    # BEGIN GENERATED SPA ROUTES - npm/node scripts/sync-nginx-spa-routes.cjs',
    '    # Valid application routes only. Keep product SEO locations above this rule.',
    ...blocks,
    '    # END GENERATED SPA ROUTES',
  ].join('\n');
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const block = spaBlock(fs.readFileSync(path.join(root, 'routes/index.tsx'), 'utf8'));
  for (const name of ['production', 'staging']) {
    const target = path.join(root, `infra/nginx/mdv-site-${name}.conf`);
    const source = fs.readFileSync(target, 'utf8');
    const updated = source.includes('# BEGIN GENERATED SPA ROUTES')
      ? source.replace(/    # BEGIN GENERATED SPA ROUTES[\s\S]*?    # END GENERATED SPA ROUTES/, block)
      : source.replace('    location / {', `${block}\n\n    location / {`);
    if (process.argv.includes('--check')) {
      if (updated !== source) throw new Error(`Regenerate SPA routes in ${target}`);
    } else fs.writeFileSync(target, updated);
  }
}
module.exports = { routePatterns, spaBlock };
