import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductCard.tsx', 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes('const handleVideoTileAction'),
  'ProductCard should centralize the video tile action for upload/view behavior.',
);

assert(
  source.includes('aria-label={getVideoTileLabel()}'),
  'ProductCard video thumbnail tile should expose an accessible dynamic label.',
);

assert(
  source.includes('h-[72px] w-[72px]') &&
    source.includes('videoInfo.exists ?') &&
    source.includes('Ver video') &&
    source.includes('Enviar video'),
  'ProductCard should render a 72x72 video thumbnail tile that switches between view and upload states.',
);

assert(
  source.includes('onClick={handleVideoTileAction}'),
  'ProductCard video thumbnail tile should open the existing video when present or trigger upload otherwise.',
);

assert(
  source.includes('disabled={!product.sku || videoInfo.checking || isUploadingVideo}'),
  'ProductCard video thumbnail tile should be disabled while checking/uploading or when SKU is missing.',
);

assert(
  !source.includes('flex items-center justify-end gap-1 overflow-x-auto pb-0.5'),
  'ProductCard should not keep the old tiny video action in the top icon row.',
);

console.log('product-card video thumbnail static checks passed');
