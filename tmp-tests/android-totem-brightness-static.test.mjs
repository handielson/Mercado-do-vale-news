import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const activity = readFileSync('android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt', 'utf8');

const awakeBody = activity.match(/private fun setDisplayAwake\(awake: Boolean\) \{[\s\S]*?\n    \}/)?.[0] || '';
const sleepBody = activity.match(/private fun allowDisplayToSleep\(lockNow: Boolean\) \{[\s\S]*?\n    \}/)?.[0] || '';

assert.match(awakeBody, /FLAG_KEEP_SCREEN_ON/, 'awake mode must keep the display on');
assert.match(
  awakeBody,
  /screenBrightness\s*=\s*WindowManager\.LayoutParams\.BRIGHTNESS_OVERRIDE_FULL/,
  'awake mode must force full window brightness instead of leaving Android free to dim the totem',
);
assert.doesNotMatch(
  awakeBody,
  /screenBrightness\s*=\s*WindowManager\.LayoutParams\.BRIGHTNESS_OVERRIDE_NONE/,
  'awake mode must not use normal brightness policy because the dedicated totem can still dim',
);
assert.match(
  sleepBody,
  /screenBrightness\s*=\s*0\.01f/,
  'manual sleep mode must still dim the screen intentionally',
);

console.log('android totem brightness static checks passed');
