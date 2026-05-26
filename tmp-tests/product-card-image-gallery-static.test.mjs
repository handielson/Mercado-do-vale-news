import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/ProductCard.tsx', 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes('IMAGE_THUMBNAIL_VISIBLE_LIMIT'),
  'ProductCard should define a visible thumbnail limit for the image gallery.',
);

assert(
  source.includes('h-[72px] w-[72px]'),
  'ProductCard thumbnails should be 72x72 so each photo is easy to identify.',
);

assert(
  !source.includes('product-image-strip overflow-x-auto'),
  'ProductCard image gallery should not use horizontal thumbnail scrolling.',
);

assert(
  source.includes('isImageGalleryExpanded'),
  'ProductCard should allow expanding/collapsing the full image gallery.',
);

assert(
  source.includes('handleSetPrimaryImage'),
  'ProductCard should support setting a thumbnail as the primary image.',
);

assert(
  source.includes('handleProductImageUpload'),
  'ProductCard should support uploading images from the card.',
);

assert(
  source.includes('handleReplaceProductImage'),
  'ProductCard should support replacing a thumbnail image.',
);

assert(
  source.includes('handleDeleteProductImage'),
  'ProductCard should support deleting a thumbnail image.',
);

assert(
  source.includes('uploadImagesToBank'),
  'ProductCard should upload product images through the existing VPS image bank service.',
);

assert(
  source.includes('vpsApiService.updateProductImagesBySku'),
  'ProductCard should persist image array changes through the existing VPS products/images route.',
);

assert(
  source.includes('aria-label="Adicionar foto"') &&
    source.includes('aria-label={`Substituir foto ${imageIndex + 1}`}') &&
    source.includes('aria-label={`Excluir foto ${imageIndex + 1}`}'),
  'ProductCard image gallery icon buttons should have accessible labels.',
);

console.log('product-card image gallery static checks passed');
