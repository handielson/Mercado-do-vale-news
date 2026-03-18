import fetch from 'node-fetch';

async function run() {
    const searchParams = new URLSearchParams({
        resource: 'products',
        page: '1',
        search: 'pelicula 3d'
    });
    // This requires auth!
}
run();
