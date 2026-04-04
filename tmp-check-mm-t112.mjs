import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});

(async () => {
    const pSearch = await fetch(`https://api.xiaomipetrolina.com.br/products?search=MM-T112`);
    const pSearchRes = await pSearch.json();
    const mmSearch = pSearchRes.find(p => p.sku === 'MM-T112');
    if (mmSearch) {
        console.log('Found MM-T112:', {
            sku: mmSearch.sku,
            price: mmSearch.price,
            price_retail: mmSearch.price_retail,
            preco: mmSearch.preco,
            preco_venda: mmSearch.preco_venda,
            preco_varejo: mmSearch.preco_varejo,
            status: mmSearch.status,
            stock_quantity: mmSearch.stock_quantity
        });
    } else {
        console.log('Not found by search');
    }
})();
