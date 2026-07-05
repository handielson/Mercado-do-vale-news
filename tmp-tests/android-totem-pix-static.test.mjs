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
const buildGradle = readFileSync('android/totem-pix/app/build.gradle', 'utf8');

assert.match(manifest, /android\.permission\.INTERNET/, 'Android app must request internet');
assert.match(manifest, /android:screenOrientation="portrait"/, 'Totem phone should default to portrait');
assert.match(activity, /WebView/, 'MainActivity must use WebView');
assert.match(activity, /FLAG_KEEP_SCREEN_ON/, 'Totem should keep screen on while plugged in');
assert.match(activity, /https:\/\/www\.mercadodovale\.com\.br\/display/, 'WebView must open the display route');
assert.match(activity, /returnToAppHome/, 'Totem should expose a native return-to-app-home bridge');
assert.match(activity, /FLAG_ACTIVITY_REORDER_TO_FRONT/, 'Totem should bring its activity to the front when returning to app');
assert.match(buildGradle, /versionCode 113/, 'Android upload versionCode must be bumped for the next Play upload');
assert.match(buildGradle, /versionName '1\.13'/, 'Android versionName must describe the next app release');

console.log('android totem pix static checks passed');
