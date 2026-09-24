const { randomInt } = require('node:crypto');
const { inspectNfceSale } = require('./fiscalNfceSalePreflight.cjs');
const { reserveNfceForSale } = require('./fiscalNfceNumbering.cjs');
const { buildHomologationNfceDraft } = require('./fiscalNfceDraft.cjs');
const { prepareReservedNfce } = require('./fiscalNfcePersistence.cjs');

const fail = message => { throw Object.assign(new Error(message), { statusCode:409 }); };
const digits = value => String(value || '').replace(/\D/g, '');
const issueDatePe = now => new Date(now.getTime() - 3 * 3600000).toISOString().slice(0,19) + '-03:00';

function issuerForNfce(company) {
  const address = company.address || {};
  return { ufCode:'26', cnpj:digits(company.cnpj), name:company.legalName || company.name,
    stateRegistration:digits(company.stateRegistration),
    address:{ street:address.street,number:address.number,district:address.neighborhood,
      municipalityCode:digits(company.municipalityCode),city:address.city,state:company.uf,postalCode:digits(address.zipCode) } };
}

/** Reserva a venda lida sob lock e persiste seu XML assinado, sem contato com a SEFAZ. */
async function prepareHomologationNfceForSale(pool, { profileId, settingsId, saleId, company, series }, options = {}) {
  if (!Number.isSafeInteger(series) || series < 0 || series > 999) fail('Série de homologação inválida.');
  const issuer = issuerForNfce(company || {});
  const issuedAt = issueDatePe(options.now || new Date());
  const numericCode = (options.randomInt || randomInt)(0, 100000000);
  const inspect = options.inspect || inspectNfceSale;
  const build = options.build || buildHomologationNfceDraft;
  const reserve = options.reserve || reserveNfceForSale;
  const prepare = options.prepare || prepareReservedNfce;
  const makeDraft = (plan, number) => build({ issuer, series, number, issuedAt, numericCode, nature:'VENDA', items:plan.items, payments:plan.payments });
  const reservation = await reserve(pool, { profileId,saleId,environment:'homologation',series }, {
    validate:async (db, profile) => {
      if (String(profile.settings_id) !== String(settingsId)) fail('Venda pertence a outra empresa.');
      const preview = await inspect(db,{profileId,settingsId,saleId,includePlan:true,lock:true});
      if (!preview.saleDataReady || !preview.plan) fail('Venda possui pendências fiscais; nenhuma numeração foi reservada.');
      try { makeDraft(preview.plan, 1); } catch (error) { fail(`Dados fiscais da venda inválidos: ${error.message}`); }
      return preview;
    },
  });
  if (reservation.existing && reservation.status !== 'reserved') return { issuanceId:reservation.id,status:reservation.status,existing:true };
  const draft = makeDraft(reservation.validation.plan, Number(reservation.document_number));
  const prepared = await prepare(pool,{issuanceId:reservation.id,draft},options.persistenceOptions || {});
  return { issuanceId:reservation.id,status:'prepared',accessKey:prepared.accessKey,signedXmlSha256:prepared.signedXmlSha256,
    existing:reservation.existing || prepared.existing };
}

module.exports = { issuerForNfce, prepareHomologationNfceForSale };
