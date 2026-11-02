// Leitura de código de barras pela câmera do celular, direto no navegador.
// Android (Chrome) usa o leitor nativo (BarcodeDetector) quando existe; iPhone e o resto
// usam o zxing (WebAssembly), carregado só quando o leitor abre (~1 MB, do próprio site).

export interface ScannedRead {
  text: string;
  /** posição vertical na imagem, para ordenar de cima para baixo */
  y: number;
}

type Decoder = (source: ImageData) => Promise<ScannedRead[]>;

const ZXING_FORMATS = ['Code128', 'EAN13', 'EAN8', 'UPCA', 'Code39', 'DataMatrix', 'QRCode'] as const;
const NATIVE_FORMATS = ['code_128', 'ean_13', 'ean_8', 'upc_a', 'code_39', 'data_matrix', 'qr_code'];

let decoderPromise: Promise<Decoder> | null = null;

async function createNativeDecoder(): Promise<Decoder | null> {
  const Detector = (globalThis as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const supported: string[] = typeof Detector.getSupportedFormats === 'function' ? await Detector.getSupportedFormats() : [];
    const formats = NATIVE_FORMATS.filter(format => supported.includes(format));
    if (!formats.includes('code_128')) return null;
    const detector = new Detector({ formats });
    return async (source: ImageData) => {
      const results: Array<{ rawValue?: string; boundingBox?: { y?: number } }> = await detector.detect(source);
      return results.filter(result => result.rawValue).map(result => ({ text: String(result.rawValue), y: Number(result.boundingBox?.y) || 0 }));
    };
  } catch {
    return null;
  }
}

async function createZxingDecoder(): Promise<Decoder> {
  const [zxing, wasm] = await Promise.all([
    import('zxing-wasm/reader'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  const wasmUrl = (wasm as { default: string }).default;
  // Usa o .wasm publicado junto com o site (sem depender de CDN externo).
  await zxing.prepareZXingModule({ overrides: { locateFile: () => wasmUrl }, fireImmediately: true });
  return async (source: ImageData) => {
    const results = await zxing.readBarcodes(source, {
      formats: [...ZXING_FORMATS],
      tryHarder: true,
      tryRotate: true,
      tryInvert: false,
      maxNumberOfSymbols: 8,
    });
    return results
      .filter(result => result.isValid && result.text)
      .map(result => ({ text: String(result.text), y: Number(result.position?.topLeft?.y) || 0 }));
  };
}

export function loadBarcodeDecoder(): Promise<Decoder> {
  if (!decoderPromise) {
    decoderPromise = (async () => (await createNativeDecoder()) || createZxingDecoder())().catch(error => {
      decoderPromise = null;
      throw error;
    });
  }
  return decoderPromise;
}

/** Reduz a imagem (lado maior até `maxSide`) e devolve os pixels para o leitor. */
export function imageDataFrom(source: CanvasImageSource, width: number, height: number, maxSide = 1600): ImageData | null {
  if (!width || !height) return null;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Lê uma foto inteira (plano B quando a câmera ao vivo não abre). */
export async function decodeImageFile(file: File): Promise<ScannedRead[]> {
  const decode = await loadBarcodeDecoder();
  const bitmap = await createImageBitmap(file);
  try {
    const reads: ScannedRead[] = [];
    // Foto inteira e, se não achar nada, em resolução maior.
    for (const maxSide of [1600, 3000]) {
      const data = imageDataFrom(bitmap, bitmap.width, bitmap.height, maxSide);
      if (!data) break;
      reads.push(...await decode(data));
      if (reads.length) break;
    }
    return reads;
  } finally {
    bitmap.close?.();
  }
}
