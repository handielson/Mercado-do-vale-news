'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  test(`${file}: SQL do cadastro 3D tem parâmetro para cada placeholder`, () => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const matches = [];
    const visit = (node) => {
      if (ts.isCallExpression(node) && node.arguments.length >= 2 && ts.isNoSubstitutionTemplateLiteral(node.arguments[0]) && ts.isArrayLiteralExpression(node.arguments[1])) {
        const sql = node.arguments[0].text;
        if (sql.includes('print3d_preorder_limit') && (sql.includes('INSERT INTO products (') || sql.includes('UPDATE products SET'))) {
          matches.push({ sql, params: node.arguments[1].elements.length });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.equal(matches.length, 2);
    for (const { sql, params } of matches) {
      assert.equal((sql.match(/\?/g) || []).length, params);
    }
  });
}
