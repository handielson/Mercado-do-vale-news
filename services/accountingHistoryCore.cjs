const { createHash } = require('node:crypto');
const { problem } = require('./companyFiscalCore.cjs');
const EVENT = 'pgdas_history_import';
const validMonth = value => /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
const cents = value => Number.isSafeInteger(value) && value >= 0 && value <= 100000000000;
function normalizeAccountingHistory(input, cnpj) {
  if (input?.schema !== 'mdv.pgdas-history.v1' || input.cnpj !== String(cnpj).replace(/\D/g,'')) throw problem('Histórico de outra empresa ou formato inválido.');
  const source = input.source;
  if (!source || source.kind !== 'pgdas_pdf' || !/^[a-f0-9]{64}$/.test(source.sha256 || '') || !validMonth(source.competence) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(source.generatedOn || '') || typeof source.filename !== 'string' || source.filename.length > 200 ||
      !['accrual','cash'].includes(input.basis)) throw problem('Identifique o PDF e o regime de apuração.');
  if (!Array.isArray(input.months) || !input.months.length || input.months.length > 120) throw problem('Histórico mensal inválido.');
  const months = input.months.map(row => {
    if (!validMonth(row?.competence) || row.competence > source.competence || !cents(row.totalCents)) throw problem('Receita mensal inválida.');
    return { competence:row.competence,totalCents:row.totalCents };
  }).sort((a,b)=>a.competence.localeCompare(b.competence));
  if (new Set(months.map(row=>row.competence)).size !== months.length) throw problem('Competência duplicada no histórico.');
  const declared = input.declared;
  const fields = ['rbt12Cents','rpaCents','rbaCents','rbaaCents','dasCents','commerceCents','servicesCents'];
  if (!declared || !fields.every(key=>cents(declared[key]))) throw problem('Totais declarados inválidos.');
  const [year,month] = source.competence.split('-').map(Number);
  const expected = Array.from({length:12},(_,i)=>new Date(Date.UTC(year,month-13+i,1)).toISOString().slice(0,7));
  const byMonth = new Map(months.map(row=>[row.competence,row.totalCents]));
  if (expected.some(key=>!byMonth.has(key)) || expected.reduce((sum,key)=>sum+byMonth.get(key),0) !== declared.rbt12Cents ||
      byMonth.get(source.competence) !== declared.rpaCents || declared.commerceCents+declared.servicesCents !== declared.rpaCents ||
      months.filter(row=>row.competence.startsWith(String(year))).reduce((sum,row)=>sum+row.totalCents,0) !== declared.rbaCents ||
      months.filter(row=>row.competence.startsWith(String(year-1))).reduce((sum,row)=>sum+row.totalCents,0) !== declared.rbaaCents)
    throw problem('As receitas mensais não conferem com os totais do extrato PGDAS-D.');
  const data = {schema:input.schema,cnpj:input.cnpj,basis:input.basis,source:{kind:source.kind,filename:source.filename,sha256:source.sha256,competence:source.competence,generatedOn:source.generatedOn},months,declared:Object.fromEntries(fields.map(key=>[key,declared[key]]))};
  return {...data,fingerprint:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}
async function readAccountingHistory(db, profileId) {
  const [rows] = await db.query('SELECT id,details,created_at FROM company_fiscal_events WHERE profile_id=? AND event=? ORDER BY id DESC LIMIT 1',[profileId,EVENT]);
  if (!rows[0]) return {version:0,history:null};
  const history = typeof rows[0].details === 'string' ? JSON.parse(rows[0].details) : rows[0].details;
  return {version:Number(rows[0].id),importedAt:rows[0].created_at,history};
}
async function saveAccountingHistory(pool, profile, input, actor) {
  const history = normalizeAccountingHistory(input.history,profile.cnpj);
  if (!Number.isSafeInteger(input.version) || input.version < 0) throw problem('Versão do histórico inválida.');
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    await db.query('SELECT id FROM company_fiscal_profiles WHERE id=? FOR UPDATE',[profile.id]);
    const current = await readAccountingHistory(db,profile.id);
    if (current.history?.fingerprint === history.fingerprint) {await db.commit();return {...current,unchanged:true};}
    if (current.version !== input.version) throw problem('Histórico atualizado em outra sessão. Atualize antes de importar.',409);
    if (current.history?.months.some(row=>!history.months.some(next=>next.competence===row.competence))) throw problem('A importação removeria competências já registradas. Inclua o histórico completo.');
    // Immutable source snapshots use the existing fiscal journal; no invoice is created.
    await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)',[profile.id,actor,EVENT,JSON.stringify(history)]);
    const saved = await readAccountingHistory(db,profile.id);
    await db.commit();return saved;
  } catch (error) {await db.rollback();throw error;} finally {db.release();}
}
module.exports = {normalizeAccountingHistory,readAccountingHistory,saveAccountingHistory};
