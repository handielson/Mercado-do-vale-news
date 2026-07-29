package br.com.mercadodovale.adminestoque.push

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import java.io.File
import java.time.LocalTime

data class SalesSoundConfig(
    val enabled: Boolean,
    val source: String,
    val systemSoundUri: String,
    val customSoundName: String,
    val volumePercent: Int,
    val scheduleEnabled: Boolean,
    val startMinutes: Int,
    val endMinutes: Int,
)

object SalesSoundSettings {
    const val SOURCE_SYSTEM = "system"
    const val SOURCE_CUSTOM = "custom"
    private const val PREFERENCES = "mdv_sales_sound"
    private const val CUSTOM_SOUND_FILE = "sales-notification-sound"
    private const val MAX_CUSTOM_SOUND_BYTES = 10 * 1024 * 1024

    fun load(context: Context): SalesSoundConfig {
        val preferences = preferences(context)
        return SalesSoundConfig(
            enabled = preferences.getBoolean("enabled", true),
            source = preferences.getString("source", SOURCE_SYSTEM) ?: SOURCE_SYSTEM,
            systemSoundUri = preferences.getString("system_sound_uri", "").orEmpty(),
            customSoundName = preferences.getString("custom_sound_name", "").orEmpty(),
            volumePercent = preferences.getInt("volume_percent", 80).coerceIn(0, 100),
            scheduleEnabled = preferences.getBoolean("schedule_enabled", false),
            startMinutes = preferences.getInt("start_minutes", 8 * 60).coerceIn(0, 1439),
            endMinutes = preferences.getInt("end_minutes", 22 * 60).coerceIn(0, 1439),
        )
    }

    fun setEnabled(context: Context, enabled: Boolean) =
        preferences(context).edit().putBoolean("enabled", enabled).apply()

    fun setVolume(context: Context, percent: Int) =
        preferences(context).edit().putInt("volume_percent", percent.coerceIn(0, 100)).apply()

    fun setScheduleEnabled(context: Context, enabled: Boolean) =
        preferences(context).edit().putBoolean("schedule_enabled", enabled).apply()

    fun setSchedule(context: Context, startMinutes: Int, endMinutes: Int) =
        preferences(context).edit()
            .putInt("start_minutes", startMinutes.coerceIn(0, 1439))
            .putInt("end_minutes", endMinutes.coerceIn(0, 1439))
            .apply()

    fun useSystemSound(context: Context, uri: Uri?) {
        preferences(context).edit()
            .putString("source", SOURCE_SYSTEM)
            .putString("system_sound_uri", uri?.toString().orEmpty())
            .apply()
    }

    fun importCustomSound(context: Context, uri: Uri, displayName: String) {
        val destination = customSoundFile(context)
        runCatching {
            context.contentResolver.openInputStream(uri).use { input ->
                requireNotNull(input) { "Não foi possível abrir o áudio." }
                destination.outputStream().use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        require(total <= MAX_CUSTOM_SOUND_BYTES) {
                            "O áudio deve ter no máximo 10 MB."
                        }
                        output.write(buffer, 0, count)
                    }
                }
            }
        }.onFailure {
            destination.delete()
            throw it
        }
        preferences(context).edit()
            .putString("source", SOURCE_CUSTOM)
            .putString("custom_sound_name", displayName.ifBlank { "Áudio personalizado" })
            .apply()
    }

    fun play(context: Context, ignoreSchedule: Boolean = false): Boolean {
        val config = load(context)
        if (!config.enabled || config.volumePercent <= 0) return false
        if (!ignoreSchedule && config.scheduleEnabled && !isInsideSchedule(config)) return false

        val uri = when {
            config.source == SOURCE_CUSTOM && customSoundFile(context).isFile ->
                Uri.fromFile(customSoundFile(context))
            config.systemSoundUri.isNotBlank() -> Uri.parse(config.systemSoundUri)
            else -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        } ?: return false
        val volume = config.volumePercent / 100f
        return runCatching {
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setDataSource(context, uri)
                setVolume(volume, volume)
                setOnPreparedListener { it.start() }
                setOnCompletionListener(MediaPlayer::release)
                setOnErrorListener { player, _, _ ->
                    player.release()
                    true
                }
                prepareAsync()
            }
        }.isSuccess
    }

    fun selectedSoundLabel(context: Context, config: SalesSoundConfig = load(context)): String =
        if (config.source == SOURCE_CUSTOM && customSoundFile(context).isFile) {
            config.customSoundName.ifBlank { "Áudio personalizado" }
        } else {
            "Toque do sistema"
        }

    fun formatMinutes(minutes: Int): String =
        "%02d:%02d".format(minutes.coerceIn(0, 1439) / 60, minutes.coerceIn(0, 1439) % 60)

    private fun isInsideSchedule(config: SalesSoundConfig): Boolean {
        if (config.startMinutes == config.endMinutes) return true
        val now = LocalTime.now()
        val current = now.hour * 60 + now.minute
        return if (config.startMinutes < config.endMinutes) {
            current in config.startMinutes until config.endMinutes
        } else {
            current >= config.startMinutes || current < config.endMinutes
        }
    }

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    private fun customSoundFile(context: Context): File =
        File(context.filesDir, CUSTOM_SOUND_FILE)
}
