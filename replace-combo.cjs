const fs = require('fs');

const FILE_PATH = 'c:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/pages/admin/products/ProductCombosPage.tsx';
let data = fs.readFileSync(FILE_PATH, 'utf8');

const startStr = `      // Buscando dados Ricos (Descrições) diretamente do Supabase local!`;
const endStr = `      let currentTags = editingCombo.tags || [];`;

const startIndex = data.indexOf(startStr);
const endIndex = data.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
    console.error("Não encontrou os marcadores 1.");
    process.exit(1);
}

const replacement1 = `      // Buscando dados enriquecidos diretamente da VPS (já pré-carregados no allProducts e vpsApiService)
      for (const c of editingCombo.combo_children) {
        let prodData = allProducts.find(p => p.id === c.id);

        let effectiveDesc = prodData?.description || '';
        let effectiveSpecs = prodData?.technical_specifications || prodData?.specs?.technical_specifications || '';

        // Se o cache allProducts da tela de Combo não tiver descrição rica, faz um fetch leve por id na VPS
        if (!effectiveDesc && !effectiveSpecs) {
            try {
                const vpsRich = await vpsApiService.getProductById(c.id);
                if (vpsRich && !vpsRich.error) {
                    prodData = { ...(prodData || {}), ...vpsRich, name: vpsRich.name || c.name };
                    if (!effectiveDesc) effectiveDesc = vpsRich.description || '';
                    if (!effectiveSpecs) effectiveSpecs = vpsRich.technical_specifications || '';
                }
            } catch(e) {
                console.warn('Falha ao buscar dados ricos da VPS para', c.id);
            }
        }

        if (prodData) {
          total_weight_kg += (prodData.weight_kg || 0) * c.quantity;
          if (prodData.dimensions) {
            total_height += (prodData.dimensions.height_cm || 0) * c.quantity;
            total_width = Math.max(total_width, prodData.dimensions.width_cm || 0);
            total_depth = Math.max(total_depth, prodData.dimensions.depth_cm || 0);
          }
          
          if (effectiveDesc) {
            mergedDescription += (mergedDescription ? '<hr class="my-6 border-slate-200">' : '') + \`<h4 class="text-lg font-bold text-slate-800 mb-3">\${c.quantity}x \${prodData.name}</h4><div>\${effectiveDesc}</div>\`;
          }
          if (effectiveSpecs) {
            mergedSpecs += (mergedSpecs ? '<hr class="my-6 border-slate-200">' : '') + \`<h4 class="text-lg font-bold text-slate-800 mb-3">Especificações: \${prodData.name}</h4><div>\${effectiveSpecs}</div>\`;
          }
          
          // Imagens diretamente da VPS
          let parsedImages = prodData.images;
          if (typeof parsedImages === 'string') {
              try { parsedImages = JSON.parse(parsedImages); } catch { parsedImages = []; }
          }
          if (!Array.isArray(parsedImages)) parsedImages = [];

          const urlImages = parsedImages.filter((img: string) => typeof img === 'string' && !img.startsWith('data:'));
          const firstImage = urlImages.length > 0 ? urlImages[0] : parsedImages[0];
          
          if (firstImage) {
            autoImages.push(firstImage);
          }
        }
      }

      // Mantém imagens existentes do combo se auto-galeria não encontrar nenhuma
      let finalImages = editingCombo.images || [];
      if (!editingCombo.id || imageStyle === 'auto' || imageStyle === 'mosaic') {
        if (imageStyle === 'manual') {
          finalImages = [];
        } else if (autoImages.length > 0) {
          finalImages = autoImages; 
        }
      }

`;

data = data.substring(0, startIndex) + replacement1 + data.substring(endIndex);

// Second replacement: removing Supabase insert/update around line 276
const startStr2 = `      const supaPayload = {`;
const endStr2 = `      if (res && res.ok) {`;

const startIndex2 = data.indexOf(startStr2);
const endIndex2 = data.indexOf(endStr2);

if (startIndex2 === -1 || endIndex2 === -1) {
    console.error("Não encontrou os marcadores 2.");
    process.exit(1);
}

const replacement2 = `      let res;
      if (editingCombo.id) {
        res = await vpsApiService.updateCombo(editingCombo.id, payload);
      } else {
        res = await vpsApiService.createCombo(payload);
      }

`;

data = data.substring(0, startIndex2) + replacement2 + data.substring(endIndex2);

fs.writeFileSync(FILE_PATH, data, 'utf8');
console.log("Substituicao Combo finalizada");
