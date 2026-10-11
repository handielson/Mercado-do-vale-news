import { Link } from 'react-router-dom';
import { FilamentCatalog } from '../../../components/print3d/FilamentCatalog';

export function Print3dFilamentsPage() {
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Filamentos e estoque</h1>
        <p className="mt-1 text-sm text-slate-600">Cadastre marca, material e cor, defina o custo por kg e acompanhe entradas, uso e desativação.</p>
      </div>
      <Link to="/admin/loja-3d/calculadora" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-violet-800">Abrir calculadora 3D</Link>
    </header>
    <FilamentCatalog />
  </div>;
}
