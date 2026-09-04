import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModelPricesPanel } from '../components/settings/ModelPricesPanel';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <ModelPricesPanel inline modelId="redmi15c" modelName="Redmi 15c" onClose={() => {}} />,
);
