const test=require('node:test'),assert=require('node:assert/strict');
const {assertFamilyRegistrationRelease,MARKERS}=require('../scripts/assert-family-registration-release.cjs');
test('release must include the reachable inline editor, not just an orphan chunk or source files',()=>{
  const files={'index.html':'<script src="/assets/index-A.js"></script>','assets/index-A.js':'import("./ProductForm-A.js")','assets/ProductForm-A.js':MARKERS.join('\n')};
  assert.equal(assertFamilyRegistrationRelease(p=>files[p]).files,2);
  files['assets/ProductForm-A.js']='Família de variações';
  files['assets/orphan.js']=MARKERS.join('\n');
  assert.throws(()=>assertFamilyRegistrationRelease(p=>files[p]),/missing/);
  delete files['assets/ProductForm-A.js'];
  assert.throws(()=>assertFamilyRegistrationRelease(p=>files[p]),/Missing asset/);
});
