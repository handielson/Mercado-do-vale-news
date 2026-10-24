import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductFamilyEditor, type FamilyRow } from '../components/products/ProductFamilyEditor';

function Fixture() {
    const [rows, setRows] = useState<FamilyRow[]>([{ key: 'preto', data: { name: 'Teste - Preto', eans: [], images: [], specs: { color: 'Preto' } } as FamilyRow['data'], inheritImages: false }]);
    const [tick, setTick] = useState(0);
    return <form onChangeCapture={() => setTick(value => value + 1)}>
        <output data-testid="render-tick">{tick}</output>
        <ProductFamilyEditor parent={{ name: 'Teste', images: [] } as FamilyRow['data']} rows={rows} onChange={setRows} disabled={false} />
        <output data-testid="ean-state">{JSON.stringify(rows[0].data.eans)}</output>
    </form>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
