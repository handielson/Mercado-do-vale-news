/** The DOM canvas is shared: compose serially; only safe preparation is retried. */
export async function runSceneBatch(job, { progress, validate, prepare, compose, cancelled = () => false, onJob = () => {}, delay = ms => new Promise(r => setTimeout(r, ms)) }) {
  const update = async changes => { job = await progress(job.id, changes); onJob(job); return job; };
  if (job.cancelled) await update({ cancelled: false });
  for (const original of job.items) {
    if (cancelled()) { await update({ cancelled: true }); break; }
    if (['completed', 'completed_with_warning'].includes(original.status)) continue;
    let item = original;
    try {
      if (item.status === 'review_required') continue;
      await update({ productId: item.productId, status: 'validating' }); await validate(item);
      await update({ productId: item.productId, status: 'resolving_context' });
      await update({ productId: item.productId, status: 'selecting_background' });
      let prepared;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled()) break;
        try { prepared = await prepare(item); break; }
        catch (error) { if (attempt === 2) throw error; await delay(500 * 2 ** attempt); }
      }
      if (cancelled()) { await update({ cancelled: true }); break; }
      await update({ productId: item.productId, status: 'generating_copy' });
      await update({ productId: item.productId, status: 'composing' });
      const result = await compose(item, prepared, async slideNumber => update({ productId: item.productId, status: 'composing', completedSlide: slideNumber }));
      await update({ productId: item.productId, status: result?.warning ? 'completed_with_warning' : 'completed', ...result });
    } catch (error) {
      await update({ productId: item.productId, status: error.reviewRequired ? 'review_required' : 'failed', message: error.message || 'Falha na composição.' });
    }
  }
  return job;
}
