const fs = require('fs');

const FILE_PATH = 'c:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/pages/store/PublicProductPage.tsx';
let data = fs.readFileSync(FILE_PATH, 'utf8');

const startStr = `                // Busca inicial no Supabase (Resolve relações como Nome da Marca e Nome da Categoria)`;
const endStr = `            } catch (err) {`;

const startIndex = data.indexOf(startStr);
const endIndex = data.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
    console.error("Não encontrou os marcadores.");
    process.exit(1);
}

const replacement = `                // 1. Busca Direta do Produto na VPS
                if (isUuid) {
                    data = await vpsApiService.getProductById(slug, true);
                } else {
                    data = await vpsApiService.getProductBySlug(slug);
                }

                if (!data || data.error || data.status === 'inactive') {
                    console.error('Produto não encontrado ou inativo na VPS:', slug);
                    toast.error('Produto não encontrado');
                    navigate('/');
                    return;
                }

                // Normaliza arrays JSON caso a stringificação tenha vazado
                let parsedImages = data.images;
                if (typeof parsedImages === 'string') {
                    try { parsedImages = JSON.parse(parsedImages); } catch { parsedImages = []; }
                }
                if (!Array.isArray(parsedImages)) parsedImages = [];
                data.images = parsedImages;

                let parsedSpecs = data.specs;
                if (typeof parsedSpecs === 'string') {
                    try { parsedSpecs = JSON.parse(parsedSpecs); } catch { parsedSpecs = {}; }
                }
                data.specs = parsedSpecs || {};

                // Trata Combos e busca Filhos via VPS
                data.exclude_from_seo = Boolean(data.exclude_from_seo);
                if (data.is_combo) {
                    const children = await vpsApiService.getComboChildren(data.id);
                    setComboChildren(children || []);
                }
                
                // Categoria e Config (Mantemos chamada supérflua apenas para pegar configs locais de render das tags, categorias em breve vao pra vps tb)
                if (data.category_id) {
                    const { data: catData } = await supabase.from('categories').select('name, config').eq('id', data.category_id).maybeSingle();
                    if (catData) {
                        data.category = catData.name;
                        if (catData.config) setCategoryConfig(catData.config);
                    }
                }
                
                const formattedProduct = {
                    ...data, 
                    // Garante que o frontend ache que tem uma string de marca
                    brand: typeof data.brand === 'object' ? data.brand?.name : (data.brand || ''),
                };
                
                setProduct(formattedProduct as unknown as CatalogProduct);

                if (data.is_combo && data.tags?.includes('mosaic_combo') && data.images.length > 1) {
                    setSelectedImage('MOSAIC');
                } else if (data.images.length > 0) {
                    setSelectedImage(data.images[0]);
                }
                
                // -- Siblings (Variantes do mesmo modelo) via VPS --
                if (data.model_id) {
                    const sibs = await vpsApiService.getProducts({ model_id: data.model_id, status: 'active', limit: 50 });
                    if (sibs) {
                        const cleanSibs = sibs.map(s => {
                            let imgs = s.images;
                            if (typeof imgs === 'string') try { imgs = JSON.parse(imgs); } catch { imgs = []; }
                            if (!Array.isArray(imgs)) imgs = [];
                            return { ...s, images: imgs };
                        }).filter(s => s.id !== data.id);
                        setSiblings(cleanSibs as unknown as CatalogProduct[]);
                    }
                } else if (data.parent_id) {
                    const sibs = await vpsApiService.getProducts({ parent_id: data.parent_id, status: 'active', limit: 50 });
                     if (sibs) {
                        const cleanSibs = sibs.map(s => {
                            let imgs = s.images;
                            if (typeof imgs === 'string') try { imgs = JSON.parse(imgs); } catch { imgs = []; }
                            if (!Array.isArray(imgs)) imgs = [];
                            return { ...s, images: imgs };
                        }).filter(s => s.id !== data.id);
                        setSiblings(cleanSibs as unknown as CatalogProduct[]);
                     }
                }

                // -- Relacionados (Mesma categoria) via VPS --
                if (data.category_id) {
                    const related = await vpsApiService.getProducts({ category: data.category_id, status: 'active', limit: 5 });
                    if (related) {
                        const cleanRelated = related.map(s => {
                            let imgs = s.images;
                            if (typeof imgs === 'string') try { imgs = JSON.parse(imgs); } catch { imgs = []; }
                            if (!Array.isArray(imgs)) imgs = [];
                            return { ...s, images: imgs };
                        }).filter(s => s.id !== data.id).slice(0, 4);
                        setRelatedProducts(cleanRelated as unknown as CatalogProduct[]);
                    }
                }

                // -- Cross-sells (Recomendações Dinâmicas baseada na primeira tag) via VPS --
                const explicitTags = data.specs['tags_venda'] || data.specs['cross_sell_tags'] || data.specs['tags'];
                if (explicitTags) {
                    const tagList = Array.isArray(explicitTags) ? explicitTags : [explicitTags];
                    // Tenta achar qualquer tag com string minima e limpa
                    const firstTag = tagList.find(t => typeof t === 'string' && t.trim().length > 2);
                    if (firstTag) {
                        const crossSells = await vpsApiService.getProducts({ search: firstTag.trim(), status: 'active', limit: 8 });
                        if (crossSells) {
                            const cleanCross = crossSells.map(s => {
                                let imgs = s.images;
                                if (typeof imgs === 'string') try { imgs = JSON.parse(imgs); } catch { imgs = []; }
                                if (!Array.isArray(imgs)) imgs = [];
                                return { ...s, images: imgs };
                            })
                            // Evita sugerir os que já são relacionados da msm categoria
                            .filter(s => s.id !== data.id && s.category_id !== data.category_id)
                            .slice(0, 4);
                            
                            setCrossSellProducts(cleanCross as unknown as CatalogProduct[]);
                        }
                    }
                }

`;

const newData = data.substring(0, startIndex) + replacement + data.substring(endIndex);

fs.writeFileSync(FILE_PATH, newData, 'utf8');
console.log("Substituicao finalizada");
