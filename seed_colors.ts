// Script de seed: insere 50 novas cores no Supabase
// Rodar com: npx tsx C:/tmp/seed_colors.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cqbdyxxzmkgeghwkozts.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3NzU4MTUsImV4cCI6MjA1NDM1MTgxNX0.YcPZKqJDzVwdXrTKHNz0bqKFiTdYVZKmVOuKWxbQDQo';
const COMPANY_ID = '9717131e-7b14-4aec-84a4-4317c0489985';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generateSlug(name: string): string {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const newColors = [
    { name: 'Azul Marinho', hex_code: '#001F5B' },
    { name: 'Azul Celeste', hex_code: '#87CEEB' },
    { name: 'Azul Royal', hex_code: '#4169E1' },
    { name: 'Azul Petróleo', hex_code: '#005F6B' },
    { name: 'Azul Bebê', hex_code: '#89CFF0' },
    { name: 'Azul Cobalto', hex_code: '#0047AB' },
    { name: 'Verde Militar', hex_code: '#4B5320' },
    { name: 'Verde Limão', hex_code: '#32CD32' },
    { name: 'Verde Oliva', hex_code: '#808000' },
    { name: 'Verde Água', hex_code: '#00CED1' },
    { name: 'Verde Esmeralda', hex_code: '#50C878' },
    { name: 'Verde Menta', hex_code: '#98FF98' },
    { name: 'Verde Musgo', hex_code: '#8A9A5B' },
    { name: 'Vinho', hex_code: '#722F37' },
    { name: 'Bordô', hex_code: '#800020' },
    { name: 'Borgonha', hex_code: '#800000' },
    { name: 'Framboesa', hex_code: '#C72C6B' },
    { name: 'Cereja', hex_code: '#DE3163' },
    { name: 'Coral', hex_code: '#FF7F50' },
    { name: 'Salmão', hex_code: '#FA8072' },
    { name: 'Terracota', hex_code: '#E2725B' },
    { name: 'Ferrugem', hex_code: '#C23B22' },
    { name: 'Bege', hex_code: '#F5F5DC' },
    { name: 'Creme', hex_code: '#FFFDD0' },
    { name: 'Off White', hex_code: '#FAF9F6' },
    { name: 'Champagne', hex_code: '#F7E7CE' },
    { name: 'Nude', hex_code: '#F5CBA7' },
    { name: 'Pêssego', hex_code: '#FFCBA4' },
    { name: 'Marrom', hex_code: '#8B4513' },
    { name: 'Caramelo', hex_code: '#AF6E2C' },
    { name: 'Khaki', hex_code: '#C3B091' },
    { name: 'Cobre', hex_code: '#B87333' },
    { name: 'Bronze', hex_code: '#CD7F32' },
    { name: 'Ouro', hex_code: '#FFD700' },
    { name: 'Grafite', hex_code: '#2F4F4F' },
    { name: 'Carvão', hex_code: '#36454F' },
    { name: 'Branco Perolado', hex_code: '#F5F5F5' },
    { name: 'Lilás', hex_code: '#C8A2C8' },
    { name: 'Lavanda', hex_code: '#E6E6FA' },
    { name: 'Violeta', hex_code: '#EE82EE' },
    { name: 'Magenta', hex_code: '#FF00FF' },
    { name: 'Fúcsia', hex_code: '#FF77FF' },
    { name: 'Índigo', hex_code: '#4B0082' },
    { name: 'Ciano', hex_code: '#00FFFF' },
    { name: 'Turquesa', hex_code: '#40E0D0' },
    { name: 'Tiffany', hex_code: '#0ABAB5' },
    { name: 'Mostarda', hex_code: '#FFDB58' },
    { name: 'Mel', hex_code: '#FFC30B' },
    { name: 'Tangerina', hex_code: '#F28500' },
    { name: 'Pistache', hex_code: '#93C572' },
];

async function seed() {
    const { data: existing } = await supabase.from('colors').select('name').eq('company_id', COMPANY_ID);
    const existingNames = new Set((existing || []).map((c: any) => c.name.toLowerCase()));
    console.log(`Cores já cadastradas: ${existingNames.size}`);

    let inserted = 0;
    let skipped = 0;

    for (const color of newColors) {
        if (existingNames.has(color.name.toLowerCase())) {
            console.log(`⏭️  Pulando: ${color.name}`);
            skipped++;
            continue;
        }
        const { error } = await supabase.from('colors').insert({
            company_id: COMPANY_ID,
            name: color.name,
            slug: generateSlug(color.name),
            hex_code: color.hex_code,
            active: true
        });
        if (error) {
            console.error(`❌ Erro: ${color.name} → ${error.message}`);
        } else {
            console.log(`✅ ${color.name} (${color.hex_code})`);
            inserted++;
        }
    }
    console.log(`\n🎉 ${inserted} inseridas, ${skipped} ignoradas.`);
}

seed().catch(console.error);
