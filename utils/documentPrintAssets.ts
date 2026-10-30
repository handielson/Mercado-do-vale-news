const ASSET_TIMEOUT_MS = 15000;
const IMAGE_ERROR = 'A logomarca ou outra imagem do termo não carregou. Tente imprimir novamente.';

function bounded<T>(work: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        work.then(resolve, reject).finally(() => clearTimeout(timer));
    });
}

function waitForImage(image: HTMLImageElement, timeoutMs: number): Promise<void> {
    image.loading = 'eager';
    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            clearTimeout(timer);
            image.removeEventListener('load', loaded);
            image.removeEventListener('error', failed);
        };
        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (error) reject(error);
            else resolve();
        };
        const failed = () => finish(new Error(IMAGE_ERROR));
        const loaded = async () => {
            if (!image.naturalWidth || !image.naturalHeight) { failed(); return; }
            try {
                if (image.decode) await image.decode();
                finish();
            } catch { failed(); }
        };
        const timer = setTimeout(failed, timeoutMs);
        image.addEventListener('load', loaded);
        image.addEventListener('error', failed);
        // complete is also true for broken images: dimensions must be checked.
        if (image.complete) void loaded();
    });
}

/** Shared readiness gate for warranty printing and PDF capture. Never skip failed images. */
export async function waitForDocumentAssets(
    root: Document | HTMLElement,
    timeoutMs = ASSET_TIMEOUT_MS,
): Promise<void> {
    const owner = root.nodeType === 9 ? root as Document : root.ownerDocument!;
    await Promise.all([
        bounded(Promise.resolve(owner.fonts?.ready), timeoutMs, 'As fontes do termo não carregaram. Tente novamente.'),
        ...Array.from(root.querySelectorAll('img')).map(image => waitForImage(image, timeoutMs)),
    ]);
}

export async function printDocumentWhenReady(printWindow: Window): Promise<void> {
    await waitForDocumentAssets(printWindow.document);
    if (printWindow.closed) return;
    printWindow.focus();
    printWindow.print();
}

/** Embed each URL once per PDF so html-to-image does not fetch the logo again for every copy. */
export async function embedDocumentImages(
    root: HTMLElement,
    cache: Map<string, Promise<string>>,
): Promise<void> {
    await Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
        const source = image.currentSrc || image.src;
        if (source.startsWith('data:')) return;
        let embedded = cache.get(source);
        if (!embedded) {
            embedded = (async () => {
                const response = await fetch(source, { signal: AbortSignal.timeout(ASSET_TIMEOUT_MS) });
                if (!response.ok) throw new Error(IMAGE_ERROR);
                const blob = await response.blob();
                return bounded(new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(new Error(IMAGE_ERROR));
                    reader.readAsDataURL(blob);
                }), ASSET_TIMEOUT_MS, IMAGE_ERROR);
            })();
            cache.set(source, embedded);
        }
        try {
            image.removeAttribute('srcset');
            image.src = await embedded;
        } catch { throw new Error(IMAGE_ERROR); }
    }));
}
