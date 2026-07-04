import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'android/totem-pix/settings.gradle',
  'android/totem-pix/build.gradle',
  'android/totem-pix/app/build.gradle',
  'android/totem-pix/app/src/main/AndroidManifest.xml',
  'android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt',
];

for (const file of requiredFiles) {
  assert.equal(existsSync(file), true, `${file} must exist`);
}

const manifest = readFileSync('android/totem-pix/app/src/main/AndroidManifest.xml', 'utf8');
const activity = readFileSync('android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt', 'utf8');

assert.match(manifest, /android\.permission\.INTERNET/, 'Android app must request internet');
assert.match(manifest, /android:screenOrientation="portrait"/, 'Totem phone should default to portrait');
assert.match(activity, /WebView/, 'MainActivity must use WebView');
assert.match(activity, /FLAG_KEEP_SCREEN_ON/, 'Totem should keep screen on while plugged in');
assert.match(activity, /https:\/\/www\.mercadodovale\.com\.br\/display/, 'WebView must open the display route');

console.log('android totem pix static checks passed');
