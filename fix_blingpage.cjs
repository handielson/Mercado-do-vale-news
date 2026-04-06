const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pages/admin/settings/BlingPage.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Replace lines 855-909 (index 854-908) with new correct JSX for the mappings tab
// Lines before 855 and after 909 stay unchanged

const before = lines.slice(0, 854);  // lines 1-854 (before mappings tab)
const after = lines.slice(-4);       // last 4 lines: </div> ); } empty

const mappingsTab = `            {/* ══════════════════════════════════════ */}
            {/* TAB: MAPEAMENTOS                       */}
            {/* ══════════════════════════════════════ */}
            {activeTab === 'mappings' && (
                <div className="space-y-4">
                    {!isConnected ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
                            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                            <p className="font-semibold text-amber-800">Bling nao conectado</p>
                            <p className="text-sm text-amber-700">Configure as credenciais na aba <strong>Configuracao</strong> primeiro.</p>
                        </div>
                    ) : (
                        <>
                            {/* Secao 1: Mapeamento de Categorias */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-base font-bold text-slate-800">Mapeamento de Categorias</h2>
                                        <p className="text-sm text-slate-500 mt-0.5">
                                            Relacione cada categoria do Bling com uma categoria do sistema.
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setLoadingMappings(true);
                                            try {
                                                const cats = await fetchBlingCategories();
                                                setBlingCategories(cats);
                                                const existing = loadCategoryMappings();
                                                const merged: CategoryMapping[] = [...existing];
                                                for (const bc of cats) {
                                                    if (!merged.find(m => m.blingCategoryId === bc.id)) {
                                                        merged.push({ blingCategoryId: bc.id, blingCategoryName: bc.descricao, ourCategoryId: '', ourCategoryName: '' });
                                                    }
                                                }
                                                setCategoryMappings(merged);
                                                toast.success(\`\${cats.length} categorias carregadas do Bling.\`);
                                            } catch (err: any) {
                                                toast.error('Erro ao carregar categorias: ' + err.message);
                                            } finally {
                                                setLoadingMappings(false);
                                            }
                                        }}
                                        disabled={loadingMappings}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex-shrink-0"
                                    >
                                        {loadingMappings ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        {loadingMappings ? 'Carregando...' : 'Carregar Categorias do Bling'}
                                    </button>
                                </div>

                                {categoryMappings.length === 0 && !loadingMappings && (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        Clique em <strong>"Carregar Categorias do Bling"</strong> para comecar a mapear.
                                    </div>
                                )}

                                {categoryMappings.length > 0 && (
                                    <>
                                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 border-b border-slate-200">
                                                    <tr>
                                                        <th className="text-left px-4 py-3 font-semibold text-slate-600 w-1/2">Categoria no Bling</th>
                                                        <th className="text-center px-2 py-3 text-slate-400">-&gt;</th>
                                                        <th className="text-left px-4 py-3 font-semibold text-slate-600 w-1/2">Categoria no Sistema</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {categoryMappings.map((mapping, idx) => (
                                                        <tr key={mapping.blingCategoryId} className="hover:bg-slate-50">
                                                            <td className="px-4 py-3">
                                                                <p className="font-medium text-slate-700">{mapping.blingCategoryName}</p>
                                                                <p className="text-xs text-slate-400">ID Bling: {mapping.blingCategoryId}</p>
                                                            </td>
                                                            <td className="text-center text-slate-300 px-2">-&gt;</td>
                                                            <td className="px-4 py-3">
                                                                <select
                                                                    value={mapping.ourCategoryId}
                                                                    onChange={e => {
                                                                        const cat = categories.find(c => c.id === e.target.value);
                                                                        const updated = [...categoryMappings];
                                                                        updated[idx] = { ...mapping, ourCategoryId: e.target.value, ourCategoryName: cat?.name || '' };
                                                                        setCategoryMappings(updated);
                                                                    }}
                                                                    className={\`w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent \${mapping.ourCategoryId ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-white'}\`}
                                                                >
                                                                    <option value="">-- Sem mapeamento (usa padrao) --</option>
                                                                    {categories.map(c => (
                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-slate-500">
                                                Produtos sem categoria mapeada usarao a Categoria padrao selecionada na aba Produtos.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    const valid = categoryMappings.filter(m => m.ourCategoryId);
                                                    saveCategoryMappings(valid);
                                                    toast.success(\`\${valid.length} mapeamentos salvos!\`);
                                                }}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                                            >
                                                <Save className="w-4 h-4" />
                                                Salvar Categorias
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Secao 2: Mapeamento de Campos */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-base font-bold text-slate-800">Mapeamento de Campos</h2>
                                        <p className="text-sm text-slate-500 mt-0.5">
                                            Configure qual campo do Bling alimenta qual campo do sistema.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const defaults = getDefaultFieldMappings();
                                            setFieldMappings(defaults);
                                            saveFieldMappings(defaults);
                                            toast.success('Mapeamentos restaurados.');
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 flex-shrink-0"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Restaurar Padrao
                                    </button>
                                </div>
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="text-center px-3 py-3 font-semibold text-slate-600 w-10">Ativo</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-2/5">Campo no Bling</th>
                                                <th className="text-center px-2 py-3 text-slate-400 w-8">-</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Campo no Sistema</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {fieldMappings.map((mapping, idx) => (
                                                <tr key={mapping.blingKey} className={\`hover:bg-slate-50 \${!mapping.enabled ? 'opacity-50' : ''}\`}>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={mapping.enabled}
                                                            onChange={e => {
                                                                const updated = [...fieldMappings];
                                                                updated[idx] = { ...mapping, enabled: e.target.checked };
                                                                setFieldMappings(updated);
                                                            }}
                                                            className="w-4 h-4 accent-green-600"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-medium text-slate-700">{mapping.blingLabel}</p>
                                                        <p className="text-xs text-slate-400 font-mono">{mapping.blingField}</p>
                                                    </td>
                                                    <td className="text-center text-slate-300 px-2">-</td>
                                                    <td className="px-4 py-2.5">
                                                        <select
                                                            value={mapping.systemField}
                                                            disabled={!mapping.enabled}
                                                            onChange={e => {
                                                                const updated = [...fieldMappings];
                                                                updated[idx] = { ...mapping, systemField: e.target.value };
                                                                setFieldMappings(updated);
                                                            }}
                                                            className={\`w-full text-sm border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed \${mapping.systemField ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-white'}\`}
                                                        >
                                                            <option value="">-- Nao importar --</option>
                                                            {Object.entries(
                                                                SYSTEM_FIELDS.reduce((acc, f) => {
                                                                    if (!acc[f.group]) acc[f.group] = [];
                                                                    acc[f.group].push(f);
                                                                    return acc;
                                                                }, {} as Record<string, typeof SYSTEM_FIELDS>)
                                                            ).map(([group, fields]) => (
                                                                <optgroup key={group} label={group}>
                                                                    {fields.map(f => (
                                                                        <option key={f.field} value={f.field}>{f.label}</option>
                                                                    ))}
                                                                </optgroup>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => {
                                            saveFieldMappings(fieldMappings);
                                            toast.success('Mapeamentos de campos salvos!');
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                                    >
                                        <Save className="w-4 h-4" />
                                        Salvar Mapeamentos de Campos
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}`;

const result = before.concat(mappingsTab.split('\n')).concat(after).join('\n');
fs.writeFileSync(filePath, result, 'utf8');
console.log('Done. Total lines:', result.split('\n').length);
