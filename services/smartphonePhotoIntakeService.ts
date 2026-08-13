import { buildAuthHeaders } from './authSession';
import { getCompanyId } from './companyContext';
import { vpsClient } from './vpsClient';
import { buildVpsUrl, getVpsSyncHeaders } from './vpsProxyBase';
import type {
  SmartphoneBrandPriceMargin,
  SmartphonePhotoIntake,
  SmartphonePhotoIntakeGroupPriceResult,
  SmartphonePhotoIntakePriceConfirmation,
  SmartphonePhotoIntakeUpdate,
} from '../types/smartphone-photo-intake';

type IntakeListResponse =
  | SmartphonePhotoIntake[]
  | { items?: SmartphonePhotoIntake[]; rows?: SmartphonePhotoIntake[]; data?: SmartphonePhotoIntake[] };

type IntakeResponse = SmartphonePhotoIntake | { intake?: SmartphonePhotoIntake; item?: SmartphonePhotoIntake };

function extractIntakes(response: IntakeListResponse): SmartphonePhotoIntake[] {
  if (Array.isArray(response)) return response;
  return response.items || response.rows || response.data || [];
}

function extractIntake(response: IntakeResponse): SmartphonePhotoIntake {
  if ('id' in response) return response;
  const intake = response.intake || response.item;
  if (!intake) throw new Error('A VPS não retornou o pré-cadastro criado.');
  return intake;
}

async function upload(file: File, batchId?: string): Promise<SmartphonePhotoIntake> {
  const companyId = await getCompanyId();
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('company_id', companyId);
  if (batchId) formData.append('batch_id', batchId);
  return extractIntake(await vpsClient.upload<IntakeResponse>('/smartphone-photo-intakes', formData));
}

async function list(): Promise<SmartphonePhotoIntake[]> {
  return extractIntakes(await vpsClient.get<IntakeListResponse>('/smartphone-photo-intakes?status=all'));
}

async function getById(id: string): Promise<SmartphonePhotoIntake> {
  return extractIntake(await vpsClient.get<IntakeResponse>(`/smartphone-photo-intakes/${encodeURIComponent(id)}`));
}

async function analyze(id: string): Promise<SmartphonePhotoIntake> {
  return extractIntake(await vpsClient.post<IntakeResponse>(
    `/smartphone-photo-intakes/${encodeURIComponent(id)}/analyze`,
    {},
  ));
}

async function retry(id: string): Promise<SmartphonePhotoIntake> {
  return extractIntake(await vpsClient.post<IntakeResponse>(
    `/smartphone-photo-intakes/${encodeURIComponent(id)}/analyze`,
    {},
  ));
}

async function update(id: string, input: SmartphonePhotoIntakeUpdate): Promise<SmartphonePhotoIntake> {
  return extractIntake(await vpsClient.patch<IntakeResponse>(
    `/smartphone-photo-intakes/${encodeURIComponent(id)}`,
    input,
  ));
}

async function attachModel(id: string, modelId: string): Promise<SmartphonePhotoIntake> {
  return update(id, { matched_model_id: modelId });
}

async function confirmGroupPrices(
  id: string,
  input: SmartphonePhotoIntakePriceConfirmation,
): Promise<SmartphonePhotoIntakeGroupPriceResult> {
  return vpsClient.post<SmartphonePhotoIntakeGroupPriceResult>(
    `/smartphone-photo-intakes/${encodeURIComponent(id)}/confirm-group-prices`,
    input,
  );
}

async function finalize(id: string, input: { sku?: string; product_id?: string } = {}): Promise<SmartphonePhotoIntake> {
  return extractIntake(await vpsClient.post<IntakeResponse>(
    `/smartphone-photo-intakes/${encodeURIComponent(id)}/finalize`,
    input,
  ));
}

async function loadProtectedPhoto(id: string): Promise<Blob> {
  const path = `/smartphone-photo-intakes/${encodeURIComponent(id)}/photo`;
  const response = await fetch(buildVpsUrl(path, { method: 'GET' }), {
    headers: await buildAuthHeaders({
      ...getVpsSyncHeaders(),
      Accept: 'image/*',
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Não foi possível carregar a foto protegida (${response.status}): ${detail}`);
  }
  return response.blob();
}

type MarginListResponse =
  | SmartphoneBrandPriceMargin[]
  | { items?: SmartphoneBrandPriceMargin[]; rows?: SmartphoneBrandPriceMargin[]; data?: SmartphoneBrandPriceMargin[] };

async function listMargins(): Promise<SmartphoneBrandPriceMargin[]> {
  const response = await vpsClient.get<MarginListResponse>('/smartphone-brand-margins');
  if (Array.isArray(response)) return response;
  return response.items || response.rows || response.data || [];
}

async function saveMargin(
  brandId: string,
  input: Pick<SmartphoneBrandPriceMargin, 'retail_margin_cents' | 'reseller_margin_cents' | 'wholesale_margin_cents' | 'active'>,
): Promise<SmartphoneBrandPriceMargin> {
  const companyId = await getCompanyId();
  return vpsClient.put<SmartphoneBrandPriceMargin>(
    `/smartphone-brand-margins/${encodeURIComponent(brandId)}`,
    { ...input, company_id: companyId },
  );
}

export const smartphonePhotoIntakeService = {
  upload,
  list,
  getById,
  analyze,
  retry,
  update,
  attachModel,
  confirmGroupPrices,
  finalize,
  loadProtectedPhoto,
  listMargins,
  saveMargin,
};
