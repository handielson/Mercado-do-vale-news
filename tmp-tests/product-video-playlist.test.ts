import assert from 'node:assert/strict';
import {
  INSTITUTIONAL_VIDEO_URL,
  buildProductVideoPlaylist,
} from '../utils/product-video-playlist';

const productVideo = 'https://videos.mercadodovale.com.br/P5550A.mp4';

assert.deepEqual(
  buildProductVideoPlaylist(productVideo),
  [productVideo, INSTITUTIONAL_VIDEO_URL],
  'MP4 product videos should continue into the institutional video',
);

assert.deepEqual(
  buildProductVideoPlaylist('https://youtube.com/watch?v=abc123'),
  ['https://youtube.com/watch?v=abc123'],
  'External embedded videos should not receive an MP4 continuation',
);

assert.deepEqual(
  buildProductVideoPlaylist(null),
  [],
  'Products without video should not force the institutional video',
);

console.log('product-video-playlist tests passed');
