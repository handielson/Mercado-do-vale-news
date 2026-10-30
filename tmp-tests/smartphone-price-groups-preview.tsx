import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModelPricesPanel } from '../components/settings/ModelPricesPanel';
import { BrowserRouter } from 'react-router-dom';
import { PhotoIntakeReviewCard } from '../components/products/photo-intake/PhotoIntakeReviewCard';
import '../index.css';

function IntakePreview() {
  const [intake, setIntake] = React.useState<any>({ id: 'intake-test', status: 'waiting_price_confirmation', matched_model_id: 'redmi15c', matched_color_id: 'blue', matched_product_id: 'A', detected_brand: 'Redmi', detected_model: '15c', detected_color: 'Azul', detected_ram: '8GB', detected_storage: '256GB', detected_version: 'Global', price_cost: 98400, price_retail: 119000, price_reseller: 114000, price_wholesale: 109000, validation_errors: [], validation_warnings: [], review_confirmed: true, prices_confirmed: new URLSearchParams(window.location.search).has('confirmed') });
  return <BrowserRouter><PhotoIntakeReviewCard intake={intake} models={[{ id: 'redmi15c', name: 'Redmi 15c' } as any]} colors={[{ id: 'blue', name: 'Azul' } as any]} fieldsRef={React.createRef()}
    onUpdate={async input => { setIntake((current: any) => ({ ...current, ...input })); return true; }}
    onConfirmPrices={async input => { (window as any).__confirmed = input; }}
    onAttachModel={async () => true} onRetry={async () => true} onRefreshColors={async () => {}} onFinalize={async () => {}} onRemoveFromQueue={async () => {}} /></BrowserRouter>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(window.location.search).has('photo-intake')
  ? <IntakePreview /> : <ModelPricesPanel inline modelId="redmi15c" modelName="Redmi 15c" onClose={() => {}} />);
