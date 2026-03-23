const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'pages', 'store', 'PublicProductPage.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Use regex to find the start of the return block to replace everything until the end
const markerRegex = /return\s*\(\s*<div\s+className="min-h-screen\s+bg-slate-50\s+pb-20">/;
const match = content.match(markerRegex);

if (!match) {
    console.error('Marker not found using Regex!');
    process.exit(1);
}

const splitIndex = match.index;
const beforeRender = content.substring(0, splitIndex);

const newRender = `return (
        <div className="min-h-screen bg-[#FDFDFD] pb-32 font-sans selection:bg-zinc-900 selection:text-white">
            <Helmet>
                <title>{title}</title>
                <meta name="description" content={description} />
                {product.exclude_from_seo && (
                    <meta name="robots" content="noindex, nofollow" />
                )}
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org/",
                        "@type": "Product",
                        "name": toTitleCase(product.name),
                        "image": product.images || [],
                        "description": description,
                        "sku": product.sku || '',
                        "brand": {
                            "@type": "Brand",
                            "name": typeof product.brand === 'string' ? product.brand : 'Mercado do Vale'
                        },
                        "offers": {
                            "@type": "Offer",
                            "url": window.location.href,
                            "priceCurrency": "BRL",
                            "price": discountedPrice.toString(),
                            "availability": product.stock_quantity && product.stock_quantity > 0
                                ? "https://schema.org/InStock"
                                : "https://schema.org/OutOfStock",
                            "itemCondition": "https://schema.org/NewCondition"
                        }
                    })}
                </script>
            </Helmet>

            <PublicHeader />

            <FloatingCartButton onClick={() => navigate('/carrinho')} />
            <QuoteCartSidebar isOpen={false} onClose={() => {}} />

            <main className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
                {/* Breadcrumbs Modernos */}
                <nav className="flex items-center gap-2.5 text-[13px] font-medium text-zinc-400 mb-10 sm:mb-14">
                    <button onClick={() => navigate('/')} className="hover:text-zinc-900 transition-colors">Início</button>
                    {(product as any).category && (
                        <>
                            <span className="text-zinc-300">/</span>
                            <span className="text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer">{typeof (product as any).category === 'string' ? (product as any).category : 'Categoria'}</span>
                        </>
                    )}
                    <span className="text-zinc-300">/</span>
                    <span className="text-zinc-900 truncate max-w-[150px] sm:max-w-xs">{product.name}</span>
                </nav>

                <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">
                    
                    {/* Coluna Esquerda: Galeria Premium */}
                    <div className="w-full lg:w-[48%] space-y-6 lg:sticky lg:top-32">
                        <div className="aspect-[4/4] bg-white rounded-3xl sm:rounded-[2.5rem] ring-1 ring-zinc-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)] overflow-hidden flex items-center justify-center p-8 sm:p-14 transition-all duration-700 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06)] relative group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-zinc-50/50 to-white/0 opacity-50 z-0 pointer-events-none rounded-[2.5rem]"></div>
                            {selectedImage === 'VIDEO' && effectiveVideoUrl ? (
                                effectiveVideoUrl.toLowerCase().endsWith('.mp4') ? (
                                    <video src={effectiveVideoUrl} controls autoPlay className="w-full h-full object-contain shadow-2xl rounded-2xl bg-black relative z-10 scale-95 origin-center" onError={() => { setEffectiveVideoUrl(null); setSelectedImage(product?.images?.[0] || ''); }} />
                                ) : (
                                    <div className="w-full h-full flex flex-col relative z-10 scale-95">
                                        <iframe 
                                            src={effectiveVideoUrl.includes('youtube.com/watch?v=') ? effectiveVideoUrl.replace('watch?v=', 'embed/') : effectiveVideoUrl.includes('youtu.be/') ? effectiveVideoUrl.replace('youtu.be/', 'youtube.com/embed/') : effectiveVideoUrl} 
                                            className="w-full h-full rounded-2xl shadow-xl bg-white" 
                                            allowFullScreen
                                            title="Vídeo do Produto"
                                        ></iframe>
                                        {!effectiveVideoUrl.includes('youtube.com') && !effectiveVideoUrl.includes('youtu.be') && (
                                            <a href={effectiveVideoUrl} target="_blank" rel="noreferrer" className="mt-4 text-sm text-center font-bold text-blue-600 hover:underline">
                                                🔗 O vídeo não carregou? Clique aqui para abrir
                                            </a>
                                        )}
                                    </div>
                                )
                            ) : selectedImage && selectedImage !== 'VIDEO' ? (
                                <img
                                    src={selectedImage}
                                    alt={product.meta_title || toTitleCase(product.name)}
                                    className="w-full h-full object-contain relative z-10 drop-shadow-sm transition-transform duration-700 group-hover:scale-[1.03]"
                                />
                            ) : (
                                <div className="text-zinc-300 font-medium relative z-10 flex items-center gap-2">
                                    <Package size={24} /> Sem Imagem Oficial
                                </div>
                            )}
                        </div>

                        {((product.images && product.images.length > 1) || effectiveVideoUrl) && (
                            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x pt-2 px-1">
                                {effectiveVideoUrl && (
                                    <button
                                        onClick={() => setSelectedImage('VIDEO')}
                                        className={\`w-20 h-20 sm:w-[5.5rem] sm:h-[5.5rem] flex-shrink-0 bg-white rounded-2xl flex items-center justify-center transition-all duration-300 snap-center hover:shadow-md \${selectedImage === 'VIDEO' ? 'ring-2 ring-zinc-900 border-transparent shadow-md scale-105' : 'ring-1 ring-zinc-200/80 hover:ring-zinc-300'}\`}
                                    >
                                        <div className="text-zinc-900 flex flex-col items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                            <span className="text-[10px] font-bold mt-1 tracking-widest uppercase opacity-80">Vídeo</span>
                                        </div>
                                    </button>
                                )}
                                {product.images?.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(img)}
                                        className={\`w-20 h-20 sm:w-[5.5rem] sm:h-[5.5rem] flex-shrink-0 bg-white rounded-2xl overflow-hidden p-2.5 transition-all duration-300 snap-center hover:shadow-md \${selectedImage === img ? 'ring-2 ring-zinc-900 border-transparent shadow-md scale-105' : 'ring-1 ring-zinc-200/80 hover:ring-zinc-300 opacity-60 hover:opacity-100'}\`}
                                    >
                                        <img src={img} alt={\`\${product.meta_title || toTitleCase(product.name)} - Ângulo \${idx + 1}\`} className="w-full h-full object-contain ease-in-out duration-300" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Coluna Direita: Informações e BuyBox */}
                    <div className="w-full lg:w-[52%] flex flex-col space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        
                        {/* 1. Header do Produto */}
                        <div>
                            {product.brand && (
                                <div className="inline-flex items-center px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-[11px] font-bold tracking-widest uppercase mb-4">
                                    {typeof product.brand === 'string' && product.brand ? product.brand : ''}
                                </div>
                            )}
                            <h1 className="text-[2rem] sm:text-4xl lg:text-[2.75rem] font-extrabold text-zinc-900 leading-[1.1] tracking-tight">
                                {toTitleCase(product.name)}
                            </h1>
                            
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 mt-6">
                                <span className="text-sm font-medium text-zinc-500">
                                    SKU: <span className="text-zinc-800 font-semibold">{product.sku || '—'}</span>
                                </span>
                                
                                <div className="h-5 w-px bg-zinc-200 hidden sm:block"></div>
                                
                                <div className="flex items-center gap-3">
                                    <div className="flex -space-x-1" title="Compartilhar">
                                        <button onClick={handleShareInstagram} className="w-9 h-9 rounded-full bg-white ring-1 ring-zinc-200 flex items-center justify-center text-zinc-500 hover:text-pink-600 hover:ring-pink-200 hover:bg-pink-50 transition-all duration-300 shadow-sm hover:scale-110 z-30" title="Copiar para Instagram"><Instagram size={15} /></button>
                                        <button onClick={handleShareWhatsapp} className="w-9 h-9 rounded-full bg-white ring-1 ring-zinc-200 flex items-center justify-center text-zinc-500 hover:text-green-600 hover:ring-green-200 hover:bg-green-50 transition-all duration-300 shadow-sm hover:scale-110 z-20" title="Compartilhar no WhatsApp">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                            </svg>
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleCompare}
                                        className={\`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 \${
                                            isInCompare 
                                                ? 'bg-zinc-900 text-white shadow-md hover:bg-zinc-800' 
                                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                                        }\`}
                                    >
                                        <GitCompare size={14} className={isInCompare ? "text-white" : "text-zinc-500"} /> 
                                        {isInCompare ? 'Adicionado' : 'Comparar'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 2. Variações (Pills Modernos) */}
                        {siblings.length > 1 && (
                            <div className="pt-4 border-t border-zinc-100">
                                <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Selecione a Variação</h3>
                                <div className="flex flex-wrap gap-3">
                                    {(() => {
                                        if (uniqueVariants.length <= 1) return null;
                                        return uniqueVariants.map((sib) => {
                                            const isCurrent = sib.id === product.id;
                                            const variantLabel = (sib as any)._displayLabel;
                                            return (
                                                <button
                                                    key={sib.id}
                                                    onClick={() => handleVariantChange(sib)}
                                                    className={\`px-5 py-3 rounded-xl border text-sm font-semibold transition-all duration-300 \${isCurrent
                                                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] ring-2 ring-zinc-900 ring-offset-2 scale-100'
                                                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 hover:shadow-sm'
                                                        }\`}
                                                >
                                                    {variantLabel}
                                                </button>
                                            );
                                        })
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* 3. BuyBox Premium */}
                        <div className="bg-white p-7 sm:p-9 rounded-[2rem] ring-1 ring-zinc-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col gap-6 group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-zinc-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                            
                            {totalGroupStock !== undefined && totalGroupStock > 0 && totalGroupStock <= 2 && (
                                <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-[11px] uppercase tracking-wider font-bold text-center py-1.5 shadow-sm">
                                    Últimas unidades em estoque 🔥
                                </div>
                            )}

                            {/* Preço Master */}
                            <div className={totalGroupStock !== undefined && totalGroupStock > 0 && totalGroupStock <= 2 ? "mt-4 relative" : "relative"}>
                                {product.discount_percentage && !isKitSelected ? (
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xl text-zinc-400 line-through decoration-zinc-300 decoration-2 font-medium">
                                                R$ {originalPrice.toFixed(2).replace('.', ',')}
                                            </span>
                                            <span className="text-xs font-black bg-emerald-100/80 text-emerald-700 px-2.5 py-1 rounded-full uppercase tracking-widest border border-emerald-200/50">
                                                -{product.discount_percentage}% OFF
                                            </span>
                                        </div>
                                        <div className="text-[2.75rem] font-extrabold text-zinc-900 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-br from-zinc-900 to-zinc-700">
                                            R$ {discountedPrice.toFixed(2).replace('.', ',')}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[2.75rem] font-extrabold text-zinc-900 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-br from-zinc-900 to-zinc-700">
                                        R$ {discountedPrice.toFixed(2).replace('.', ',')}
                                    </div>
                                )}
                                
                                <div className="flex flex-col gap-2 mt-4">
                                    {customerType !== 'wholesale' && (
                                        <p className="text-sm font-semibold text-zinc-600">
                                            ou em até <span className="text-zinc-900 font-bold">12x de R$ {value12x.toFixed(2).replace('.', ',')}</span> s/ juros💳
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {customerType !== 'wholesale' && (companySettings?.pix_discount_percentage || 0) > 0 && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold ring-1 ring-inset ring-emerald-200/60 transition-colors hover:bg-emerald-100">
                                                ✓ {companySettings?.pix_discount_percentage}% de desconto direto no PIX
                                            </div>
                                        )}
                                        {customerType !== 'wholesale' && estimatedCoins > 0 && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold ring-1 ring-inset ring-amber-200/60 transition-colors hover:bg-amber-100">
                                                <span className="text-sm leading-none">🪙</span>
                                                +{estimatedCoins} Moedas do Vale
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Detalhamento Kit/Combo */}
                            {(product as unknown as any)?.is_combo && comboChildren && comboChildren.length > 0 && (
                                <div className="pt-6 border-t border-zinc-100">
                                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Package size={14} className="text-teal-600" /> Itens Inclusos Exclusivos:
                                    </h4>
                                    <div className="flex flex-col gap-2">
                                        {comboChildren.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-zinc-50/80 px-4 py-3 rounded-xl ring-1 ring-zinc-100/50">
                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-black text-teal-600 ring-1 ring-zinc-200/50 text-sm shadow-sm">{item.quantity}x</div>
                                                <span className="text-sm font-semibold text-zinc-700">{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Kit Selector (Descontos) */}
                            {product.kits && product.kits.length > 0 && (
                                <div className="pt-6 border-t border-zinc-100">
                                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Layers size={14} className="text-blue-600" /> Compre mais, pague menos:
                                    </h4>
                                    <div className="grid gap-3">
                                        {/* Opção Padrão */}
                                        <button
                                            onClick={() => setSelectedKitQuantity(1)}
                                            className={\`group flex items-center justify-between p-4 rounded-2xl transition-all duration-300 text-left \${
                                                selectedKitQuantity === 1 
                                                ? 'bg-zinc-900 text-white shadow-lg ring-1 ring-zinc-900' 
                                                : 'bg-white ring-1 ring-zinc-200 hover:ring-zinc-300 hover:bg-zinc-50'
                                            }\`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold text-[15px]">1 Unidade</span>
                                                <span className={\`text-xs mt-0.5 \${selectedKitQuantity === 1 ? 'text-zinc-300' : 'text-zinc-500'}\`}>R$ {baseDiscountedPrice.toFixed(2).replace('.', ',')} / un</span>
                                            </div>
                                            <div className="font-black text-lg">
                                                R$ {baseDiscountedPrice.toFixed(2).replace('.', ',')}
                                            </div>
                                        </button>

                                        {/* Kits Restantes */}
                                        {[...product.kits].sort((a, b) => a.quantity - b.quantity).map((kit, idx) => {
                                            const unitPrice = kit.price / kit.quantity;
                                            const kitPriceDisplay = (kit.price / 100).toFixed(2).replace('.', ',');
                                            const unitPriceDisplay = (unitPrice / 100).toFixed(2).replace('.', ',');
                                            const isSelected = selectedKitQuantity === kit.quantity;
                                            const retailUnit = baseDiscountedPrice;
                                            const kitUnit = unitPrice / 100;
                                            const savingsPct = retailUnit > kitUnit ? Math.round(((retailUnit - kitUnit) / retailUnit) * 100) : 0;

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedKitQuantity(kit.quantity)}
                                                    className={\`group relative flex items-center justify-between p-4 rounded-2xl transition-all duration-300 text-left overflow-hidden \${
                                                        isSelected 
                                                        ? 'bg-zinc-900 text-white shadow-lg ring-1 ring-zinc-900' 
                                                        : 'bg-white ring-1 ring-zinc-200 hover:ring-zinc-300 hover:bg-zinc-50'
                                                    }\`}
                                                >
                                                    {savingsPct > 0 && (
                                                        <div className={\`absolute top-0 right-0 text-[9px] font-black px-3 py-1 rounded-bl-xl tracking-widest \${isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'}\`}>
                                                            ECONOMIZE {savingsPct}%
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col pr-4">
                                                        <span className="font-bold text-[15px]">{kit.name || \`Kit \${kit.quantity} Unidades\`}</span>
                                                        <span className={\`text-xs font-semibold mt-0.5 \${isSelected ? 'text-emerald-400' : 'text-emerald-600'}\`}>R$ {unitPriceDisplay} / un</span>
                                                    </div>
                                                    <div className={\`font-black text-lg \${isSelected ? 'text-white' : 'text-zinc-900'}\`}>
                                                        R$ {kitPriceDisplay}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* CTA Comprar */}
                            <div className="pt-2">
                                <button
                                    onClick={handleAddToCart}
                                    disabled={!product.track_inventory ? false : (product.stock_quantity || 0) <= 0}
                                    className="w-full flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white font-extrabold py-5 px-8 rounded-2xl transition-all duration-300 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)] text-lg hover:-translate-y-0.5 active:translate-y-0.5"
                                >
                                    <ShoppingCart size={22} className={(!product.track_inventory || (product.stock_quantity || 0) > 0) ? "animate-bounce-short" : ""} />
                                    {(!product.track_inventory || (product.stock_quantity || 0) > 0) ? 'Adicionar ao Carrinho' : 'Ops, Fora de Estoque'}
                                </button>
                            </div>
                        </div>

                        {/* 4. Logística e Segurança */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
                            
                            {/* Calculadora Frete */}
                            <div className="bg-white p-6 rounded-3xl ring-1 ring-zinc-100 shadow-sm flex flex-col justify-start">
                                <h3 className="text-sm font-extrabold text-zinc-900 mb-4 flex items-center gap-2">
                                    <Truck size={18} className="text-zinc-400" /> Entrega
                                </h3>
                                <div className="flex flex-col xs:flex-row gap-2">
                                    <input
                                        type="text"
                                        placeholder="Seu CEP..."
                                        maxLength={9}
                                        value={cep}
                                        onChange={(e) => setCep(e.target.value)}
                                        className="w-full xs:flex-1 p-3.5 bg-zinc-50 border-0 ring-1 ring-inset ring-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900 transition-all placeholder:font-medium placeholder:text-zinc-400"
                                    />
                                    <button
                                        onClick={handleCalculateShipping}
                                        disabled={isCalculatingShipping || cep.length < 8}
                                        className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-bold rounded-xl text-sm transition-all min-w-[100px] flex justify-center items-center shadow-sm"
                                    >
                                        {isCalculatingShipping ? <Loader2 size={18} className="animate-spin text-zinc-400" /> : 'OK'}
                                    </button>
                                </div>
                                {shippingResult && (
                                    <div className="mt-5 space-y-2 border-t border-zinc-100 pt-4">
                                        {shippingResult.map((res, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm p-3 rounded-xl bg-zinc-50/80 ring-1 ring-zinc-100">
                                                <div className="flex flex-col">
                                                    <span className="font-extrabold text-zinc-800 tracking-tight">{res.name}</span>
                                                    <span className="text-[11px] text-zinc-500 font-medium">{res.days}</span>
                                                </div>
                                                <div className="font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                                                    {res.price === 'Grátis' ? 'Grátis' : \`R$ \${res.price}\`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Trust Badges */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4 p-5 bg-white rounded-3xl ring-1 ring-zinc-100 shadow-sm transition-all duration-300 hover:shadow-md group">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-500">
                                        <ShieldCheck className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h4 className="font-extrabold text-zinc-900 text-[13px] leading-tight">Garantia {(product as any).store_warranty_period || (product as any).brand_warranty_period || 90} dias</h4>
                                        <p className="text-[11px] text-zinc-500 font-medium mt-1 leading-snug">Cobertura total contra defeitos, certificada pela loja.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-5 bg-white rounded-3xl ring-1 ring-zinc-100 shadow-sm transition-all duration-300 hover:shadow-md group">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-500">
                                        <Truck className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h4 className="font-extrabold text-zinc-900 text-[13px] leading-tight">Envio Rápido e Seguro</h4>
                                        <p className="text-[11px] text-zinc-500 font-medium mt-1 leading-snug">Despachado via Correios com código de rastreio.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* 5. Seção de Fundo Densa: Especificações e Descrição */}
                {(product.description || (product.specs && Object.keys(product.specs).length > 0)) && (
                    <div className="mt-16 lg:mt-24 space-y-12">
                        {/* Descrição */}
                        {product.description && (
                            <div className="bg-white rounded-[2.5rem] ring-1 ring-zinc-100 p-8 sm:p-14 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-50 rounded-bl-[100px] -z-10 opacity-50"></div>
                                <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-8 pb-6 border-b border-zinc-100 flex items-center gap-3">
                                    Descrição Completa
                                </h3>
                                <div
                                    className="prose prose-zinc prose-sm sm:prose-base max-w-none text-zinc-600 leading-loose format-html-description pointer-events-auto"
                                    dangerouslySetInnerHTML={{ __html: product.description }}
                                />
                            </div>
                        )}

                        {/* Especificações Técnicas (Mapeamento Existente) */}
                        {product.specs && Object.keys(product.specs).length > 0 && (
                            <div className="bg-white rounded-[2.5rem] ring-1 ring-zinc-100 p-8 sm:p-14 shadow-sm">
                                <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-8 pb-6 border-b border-zinc-100 flex items-center gap-3">
                                    Ficha Técnica
                                </h3>
                                <div className="mt-2">
                                    {(() => {
                                        // O mesmo script de mapeamento de specs exato, só com estilos atualizados
                                        const HIDDEN_KEYS = new Set([
                                            'imei1', 'imei2', 'imei', 'serial', 'serial_number',
                                            'weight_kg', 'width_cm', 'height_cm', 'depth_cm', 'peso_kg', 'largura_cm', 'altura_cm', 'profundidade_cm',
                                            'tags_venda', 'cross_sell_tags', 'tags',
                                            'slug', 'meta_title', 'meta_description', 'keywords', 'exclude_from_seo'
                                        ]);
                                        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                                        const NATIVE_LABELS: Record<string, string> = {
                                            color: 'Cor', storage: 'Armazenamento', ram: 'Memória RAM',
                                            version: 'Versão', versao: 'Versão',
                                            battery_health: 'Saúde da Bateria', battery_mah: 'Bateria (mAh)',
                                            display: 'Display (pol)',
                                            peso_g: 'Peso (g)',
                                            'dimensions.width_cm': 'Largura (cm)',
                                            'dimensions.height_cm': 'Altura (cm)',
                                            'dimensions.depth_cm': 'Profundidade (cm)',
                                            'dimensions.weight_kg': 'Peso (kg)',
                                            celular_slot_para_cartao: 'Slot para cartão',
                                            celular_biometria: 'Biometria',
                                            celular_tipo_de_protecao_de_tela: 'Proteção de tela',
                                            celular_fps_display: 'Display FPS',
                                            pontuacao_dxomak: 'Pontuação Dxomak',
                                            cam_principal_mpx: 'Câm. Principal (Mpx)',
                                            cam_selfie_mpx: 'Câm. Selfie (Mpx)',
                                            rede_operadora: 'Rede Operadora',
                                            tipo_de_tela: 'Formato de tela',
                                            tipo_de_display: 'Display de',
                                            entrada_fone_de_ouvido: 'Entrada de fone',
                                            antutu: 'Antutu',
                                            chipset: 'Chipset',
                                            processador: 'Processador',
                                            carregamento: 'Carregamento',
                                            gpu: 'GPU',
                                            nfc: 'NFC',
                                            rede: 'Rede',
                                            camera: 'Câmera',
                                        };
                                        const SPEC_GROUPS = [
                                            { id: 'identificacao', label: 'Principal', icon: Smartphone, keys: ['version', 'versao', 'color', 'storage', 'ram'] },
                                            { id: 'tela', label: 'Tela', icon: Monitor, keys: ['display', 'tipo_de_display', 'tipo_de_tela', 'celular_fps_display', 'celular_tipo_de_protecao_de_tela'] },
                                            { id: 'camera', label: 'Câmeras', icon: Camera, keys: ['cam_principal_mpx', 'cam_selfie_mpx', 'camera', 'pontuacao_dxomak'] },
                                            { id: 'desempenho', label: 'Processamento', icon: Cpu, keys: ['chipset', 'processador', 'cpu', 'gpu', 'antutu'] },
                                            { id: 'bateria', label: 'Bateria', icon: Battery, keys: ['battery_mah', 'battery_health', 'carregamento'] },
                                            { id: 'conexoes', label: 'Conectividade', icon: Wifi, keys: ['rede_operadora', 'rede', 'network', 'network_type', 'nfc', 'bluetooth', 'wifi', 'usb', 'sim', 'celular_slot_para_cartao', 'entrada_fone_de_ouvido'] },
                                            { id: 'fisico', label: 'Físico e Segurança', icon: ShieldCheck, keys: ['celular_biometria', 'resistencia', 'peso_g'] }
                                        ];

                                        const specs = product.specs as Record<string, unknown>;
                                        const renderedKeys = new Set<string>();
                                        const allItems: { key: string, label: string, strVal: string }[] = [];

                                        const tryAddItem = (key: string, label: string, value: unknown) => {
                                            if (HIDDEN_KEYS.has(key.toLowerCase())) return;
                                            const strVal = String(value ?? '').trim();
                                            if (!strVal || strVal === '0') return;
                                            if (uuidRegex.test(strVal)) return;
                                            if (renderedKeys.has(key.toLowerCase())) return;
                                            allItems.push({ key: key.toLowerCase(), label, strVal });
                                            renderedKeys.add(key.toLowerCase());
                                        };

                                        if (categoryConfig?.custom_fields && Array.isArray(categoryConfig.custom_fields)) {
                                            for (const field of categoryConfig.custom_fields) {
                                                const key: string = field.key || field.name?.toLowerCase().replace(/\\s+/g, '_') || '';
                                                if (!key) continue;
                                                if (field.requirement === 'off' || field.requirement === 'hidden') continue;
                                                const label: string = customFieldNames[key] || field.label || field.name || key.replace(/_/g, ' ');
                                                tryAddItem(key, label, specs[key]);
                                            }
                                        }

                                        for (const [nk, nl] of Object.entries(NATIVE_LABELS)) { tryAddItem(nk, nl, specs[nk]); }
                                        for (const [key, value] of Object.entries(specs)) { const label = customFieldNames[key] || key.replace(/_/g, ' '); tryAddItem(key, label, value); }

                                        const groupedItems: { group: typeof SPEC_GROUPS[0] | { id: string, label: string, icon: any, keys: string[] }, items: typeof allItems }[] = [];
                                        
                                        SPEC_GROUPS.forEach(group => {
                                            const groupItems = allItems.filter(item => group.keys.includes(item.key));
                                            if (groupItems.length > 0) {
                                                groupItems.sort((a, b) => group.keys.indexOf(a.key) - group.keys.indexOf(b.key));
                                                groupedItems.push({ group, items: groupItems });
                                            }
                                        });

                                        const mappedKeys = new Set(SPEC_GROUPS.flatMap(g => g.keys));
                                        const othersItems = allItems.filter(item => !mappedKeys.has(item.key));
                                        
                                        if (othersItems.length > 0) {
                                            groupedItems.push({ group: { id: 'outros', label: 'Outras Características', icon: Settings, keys: [] }, items: othersItems });
                                        }

                                        return (
                                            <div className="flex flex-col gap-8 w-full">
                                                {groupedItems.map((g, index) => (
                                                    <div key={g.group.id} className={index !== 0 ? "pt-8 border-t border-zinc-100" : ""}>
                                                        <div className="flex items-center gap-2 mb-6 text-zinc-800">
                                                            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600">
                                                                <g.group.icon size={16} />
                                                            </div>
                                                            <h4 className="font-extrabold text-lg">{g.group.label}</h4>
                                                        </div>
                                                        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-8 gap-x-6 pl-2 sm:pl-10 text-[13px]">
                                                            {g.items.map(item => (
                                                                <div key={item.key} className="flex flex-col border-l-2 border-zinc-100 pl-4 transition-colors hover:border-zinc-300">
                                                                    <dt className="text-zinc-400 font-bold uppercase tracking-widest truncate">{item.label}</dt>
                                                                    <dd className="font-bold text-zinc-900 mt-1 break-words leading-snug text-sm">{item.strVal}</dd>
                                                                </div>
                                                            ))}
                                                        </dl>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Relacionados */}
                {false && relatedProducts.length > 0 && <div className="mt-20"><ModernProductCard product={relatedProducts[0]} /></div>}
                {false && crossSellProducts.length > 0 && <div className="mt-20"><ModernProductCard product={crossSellProducts[0]} /></div>}
            </main>

            {/* Sticky Mobile CTA Premium */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-2xl border-t border-zinc-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:hidden z-50 flex items-center gap-4 pb-safe supports-[padding:max(0px)]:pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex-1 flex flex-col justify-center">
                    <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest leading-none mb-1">Preço Atual</p>
                    <p className="text-2xl font-black text-zinc-900 leading-none tracking-tight">R$ {discountedPrice.toFixed(2).replace('.', ',')}</p>
                </div>
                <button
                    onClick={handleAddToCart}
                    disabled={!product.track_inventory ? false : (product.stock_quantity || 0) <= 0}
                    className="flex-shrink-0 flex items-center justify-center gap-2 bg-zinc-900 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white font-extrabold py-4 px-6 rounded-2xl transition-all shadow-xl shadow-zinc-900/10 active:scale-95 text-sm"
                >
                    <ShoppingCart size={18} className={(!product.track_inventory || (product.stock_quantity || 0) > 0) ? "animate-bounce-short" : ""} />
                    {(!product.track_inventory || (product.stock_quantity || 0) > 0) ? 'Comprar' : 'Esgotado'}
                </button>
            </div>
            
        </div>
    );
};
`;

const outputContent = beforeRender + newRender;

fs.writeFileSync(targetPath, outputContent, 'utf8');
console.log('UI Rewrite Completed!');
