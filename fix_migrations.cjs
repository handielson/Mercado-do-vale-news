const fs = require('fs');

let c = 1;
// 1. Restaurar os nomes originais (removendo os 6 digitos que adicionamos)
let files = fs.readdirSync('supabase/migrations').filter(f => f.match(/^2026\d{10}_/));
files.forEach(f => {
    let orig = f.replace(/^(\d{8})\d{6}_/, '$1_');
    fs.renameSync('supabase/migrations/' + f, 'supabase/migrations/' + orig);
});

// 2. Listar os originais
let origFiles = fs.readdirSync('supabase/migrations').filter(f => f.match(/^2026\d{4}_/));

// 3. Ordenar com peso inteligente para mesma data
origFiles.sort((a, b) => {
    let dateA = a.substring(0, 8);
    let dateB = b.substring(0, 8);
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    let getWeight = (name) => {
        if (name.includes('_create_') || name.includes('_setup_')) return 1;
        if (name.includes('_insert_')) return 2;
        if (name.includes('_migrate_')) return 3;
        if (name.includes('_add_') || name.includes('_update_') || name.includes('_convert_')) return 4;
        if (name.includes('_fix_')) return 5;
        return 6;
    };

    let wA = getWeight(a);
    let wB = getWeight(b);
    if (wA !== wB) return wA - wB;
    return a.localeCompare(b);
});

// 4. Renomear com o novo sequencial
console.log("Nova ordem das migrações:");
origFiles.forEach(f => {
    let newName = f.replace(/^(\d{8})_/, (m, p1) => p1 + String(c++).padStart(6, '0') + '_');
    console.log(newName);
    fs.renameSync('supabase/migrations/' + f, 'supabase/migrations/' + newName);
});
