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
assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE/, 'Android app must be allowed to keep Pix polling active in a foreground service');
assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE_DATA_SYNC/, 'Android app must declare the dataSync foreground service permission on modern Android');
assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/, 'Android app must request notification permission for active Pix alerts on Android 13+');
assert.match(manifest, /android\.permission\.REORDER_TASKS/, 'Android app must be able to move its own totem task back to the front');
assert.match(manifest, /android\.permission\.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/, 'Android app must let operator allowlist battery optimization for kiosk polling');
assert.match(manifest, /android:name="\.TotemPixMonitorService"/, 'Android app must register the native Pix monitor service');
assert.match(manifest, /android:foregroundServiceType="dataSync"/, 'Pix monitor service must declare its foreground service type');
assert.match(manifest, /android:screenOrientation="portrait"/, 'Totem phone should default to portrait');
assert.match(activity, /WebView/, 'MainActivity must use WebView');
assert.match(activity, /FLAG_KEEP_SCREEN_ON/, 'Totem should keep screen on while plugged in');
assert.match(activity, /https:\/\/www\.mercadodovale\.com\.br\/display/, 'WebView must open the display route');
assert.match(activity, /registerDisplayToken/, 'Totem should expose a native bridge to register the display token for background Pix monitoring');
assert.match(activity, /showPaymentScreenNow/, 'Totem should expose a native bridge to force the payment screen awake');
assert.match(activity, /returnToAppHome/, 'Totem should expose a native return-to-app-home bridge');
assert.match(activity, /FLAG_ACTIVITY_REORDER_TO_FRONT/, 'Totem should bring its activity to the front when returning to app');
assert.match(activity, /private fun returnToAppHome\(\)[\s\S]*setDisplayAwake\(true\)/, 'Totem should wake the screen when returning to app home');
assert.match(buildGradle, /versionCode 122/, 'Android upload versionCode must be bumped for the next Play upload');
assert.match(buildGradle, /versionName '1\.22'/, 'Android versionName must describe the next app release');

const monitorService = readFileSync('android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/TotemPixMonitorService.kt', 'utf8');
assert.match(monitorService, /startForeground/, 'Pix monitor must run as a foreground service');
assert.match(monitorService, /https:\/\/api\.xiaomipetrolina\.com\.br\/pdv\/display-state/, 'Pix monitor must poll the API display state endpoint directly');
assert.match(monitorService, /DISPLAY_STATE_URL\?token=\$encodedToken/, 'Pix monitor must poll the display state endpoint natively');
assert.match(monitorService, /active_pix/, 'Pix monitor must inspect active Pix state');
assert.match(monitorService, /ACTION_SHOW_PAYMENT_SCREEN/, 'Pix monitor must wake the payment screen when Pix is active');
assert.match(monitorService, /ActivityManager/, 'Pix monitor must use ActivityManager to recover its own task from another foreground app');
assert.match(monitorService, /appTasks\.firstOrNull\(\)[\s\S]*moveToFront\(\)/, 'Pix monitor must move the Totem task to the front before opening the QR screen');
assert.match(monitorService, /ACTIVE_PIX_NOTIFICATION_CHANNEL_ID/, 'Pix monitor must publish a dedicated active Pix notification');
assert.match(monitorService, /NotificationManager\.IMPORTANCE_HIGH/, 'active Pix notification must use high importance');
assert.match(monitorService, /buildPaymentScreenPendingIntent/, 'active Pix notification must open the payment screen when tapped');
assert.match(monitorService, /WAKE_REPEAT_INTERVAL_MS = 10_000L/, 'Pix monitor must retry quickly while another app is covering the Totem');
assert.match(monitorService, /WAKE_RETRY_DELAY_MS/, 'Pix monitor must retry shortly after the first foreground attempt');
assert.match(monitorService, /lastActivePixSignature/, 'Pix monitor must remember the active Pix it already woke');
assert.match(monitorService, /WAKE_REPEAT_INTERVAL_MS/, 'Pix monitor must throttle repeated wake attempts for the same Pix');
assert.match(monitorService, /if \(!shouldWakeForActivePix\(signature\)\) return/, 'Pix monitor must not relaunch the payment screen on every poll');
assert.match(monitorService, /lastActivePixSignature = null/, 'Pix monitor must clear the wake guard after Pix disappears');
assert.match(monitorService, /if \(status != "pending"\) return null/, 'Pix monitor must only wake or notify for pending Pix, not approved receipt display');
assert.match(monitorService, /cancelActivePixNotification\(\)/, 'Pix monitor must cancel the active Pix notification when Pix is no longer pending');

const showPaymentScreenNowBody = activity.match(/private fun showPaymentScreenNow\(\) \{[\s\S]*?\n    \}/)?.[0] || '';
assert.match(showPaymentScreenNowBody, /setDisplayAwake\(true\)/, 'native wake must always turn the totem screen on');
assert.match(showPaymentScreenNowBody, /mdv:force-display-refresh/, 'native wake must force the WebView to refresh Pix state immediately');
assert.match(showPaymentScreenNowBody, /if \(!webView\.url\.orEmpty\(\)\.startsWith\(displayHomeUrl\)\)/, 'native wake must only navigate back when WebView left the display app');

assert.match(activity, /areNotificationsEnabled/, 'native bridge must report notification permission status');
assert.match(activity, /requestNotificationPermission/, 'native bridge must explicitly open or request notification permission');
assert.match(activity, /ACTION_APP_NOTIFICATION_SETTINGS/, 'notification permission flow must open the app notification settings when needed');
assert.match(activity, /isIgnoringBatteryOptimizations/, 'native bridge must report battery optimization allowlist status');
assert.match(activity, /requestBatteryOptimizationPermission/, 'native bridge must explicitly request battery optimization allowlist');
assert.match(activity, /ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/, 'battery flow must use Android battery optimization request intent');
assert.match(activity, /openAppPermissionSettings/, 'native bridge must open the app permission details screen');

console.log('android totem pix static checks passed');
