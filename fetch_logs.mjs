async function run() {
    try {
        const res = await fetch("https://www.xiaomipetrolina.com.br/api/bling?resource=webhook-logs");
        const json = await res.json();
        const simplified = (json.logs || []).map(l => ({
            id: l.id,
            date: l.received_at,
            event: l.payload?.event,
            price: l.payload?.data?.preco,
            codigo: l.payload?.data?.codigo,
            blingId: l.payload?.data?.id
        }));
        console.log(JSON.stringify(simplified, null, 2));
    } catch (e) {
        console.log(e);
    }
}
run();
