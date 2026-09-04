import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { vpsClient } from '../../../services/vpsClient';
import type { SmartphonePhotoIntake } from '../../../types/smartphone-photo-intake';

export function PhotoIntakeBlingMapping({ intake, busy }: { intake: SmartphonePhotoIntake; busy?: boolean }) {
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState('');
  const [childId, setChildId] = useState('');
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const path = `/smartphone-photo-intakes/${encodeURIComponent(intake.id)}/bling-mapping`;
  useEffect(() => {
    let active = true;
    setState(null); setError(''); setChildId('');
    vpsClient.get<any>(path).then(result => {
      if (!active) return;
      setState(result); setChildId(String(result.child?.id || ''));
    }).catch(err => { if (active) setError(err.message || 'Falha ao consultar o vínculo.'); });
    return () => { active = false; };
  }, [path, intake.updated_at, intake.matched_model_id, revision]);

  const save = async () => {
    setSaving(true);
    try {
      const result = await vpsClient.put<any>(path, { child_id: Number(childId), configuration_key: state.configuration_key });
      setState(result);
      toast.success('Mapeamento salvo para os próximos aparelhos com esta memória e cor.');
    } catch (err: any) { toast.error(err.message || 'Não foi possível salvar o mapeamento.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-bold text-blue-950">Vínculo com Bling</h3>
      <button type="button" disabled={saving || busy} onClick={() => setRevision(value => value + 1)} className="text-xs font-bold text-blue-700">Atualizar vínculo</button>
    </div>
    {error ? <p className="text-sm text-red-700">{error}</p> : !state ? <p className="text-sm">Consultando vínculo…</p> : !state.family ?
      <p className="text-sm text-blue-900">Vincule o SKU pai no cadastro do modelo e clique em Atualizar vínculo. Sem essa associação, o aparelho será cadastrado somente no sistema.</p> : <>
        <p className="text-sm">Pai: <strong>{state.family.parent_sku}</strong> · {state.family.parent_name}</p>
        <p className="text-xs">{intake.detected_ram} · {intake.detected_storage} · {intake.detected_color}. Salve a conferência antes de mapear alterações nesses dados.</p>
        <label className="block text-sm font-semibold">SKU filho correspondente
          <select value={childId} onChange={event => setChildId(event.target.value)} disabled={saving || busy}
            className="mt-1 w-full rounded-lg border border-blue-200 bg-white p-2">
            <option value="">Selecione a variação correta</option>
            {state.family.children.filter((child: any) => child.active !== false).map((child: any) =>
              <option key={child.id} value={child.id}>{child.sku} — {child.name}</option>)}
          </select>
        </label>
        <p className="text-xs">{state.child ? `Mapeamento salvo: ${state.child.sku}. Será reutilizado automaticamente.` : 'Confirme o filho uma vez para reutilizar a associação nos próximos aparelhos iguais.'}</p>
        <button type="button" disabled={!childId || saving || busy || !intake.matched_color_id} onClick={() => void save()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar mapeamento'}</button>
      </>}
  </div>;
}
