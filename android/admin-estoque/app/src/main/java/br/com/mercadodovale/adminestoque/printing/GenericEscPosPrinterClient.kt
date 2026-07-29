package br.com.mercadodovale.adminestoque.printing

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

data class PairedPrinterDevice(
    val address: String,
    val name: String,
) {
    override fun toString(): String = "$name — $address"
}

class GenericEscPosPrinterClient(
    private val context: Context,
    private val listener: PrinterStateListener,
) : BluetoothPrinterClient {
    private val connectionLock = Any()
    private val printing = AtomicBoolean(false)
    private var socket: BluetoothSocket? = null
    private var output: OutputStream? = null

    @Volatile
    override var state: PrinterConnectionState = PrinterConnectionState.DISCONNECTED
        private set

    @Volatile
    var selectedDeviceAddress: String? = null

    override val isReady: Boolean
        get() = socket?.isConnected == true && output != null

    @SuppressLint("MissingPermission")
    fun pairedDevices(): List<PairedPrinterDevice> =
        bluetoothAdapter()
            ?.bondedDevices
            .orEmpty()
            .map { device ->
                PairedPrinterDevice(
                    address = device.address,
                    name = device.name?.takeIf(String::isNotBlank) ?: "Impressora sem nome",
                )
            }
            .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.name })

    override fun connect() {
        if (state == PrinterConnectionState.CONNECTING || isReady) return
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            update(
                PrinterConnectionState.ERROR,
                "Autorize dispositivos próximos para conectar à impressora.",
            )
            return
        }
        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
            update(PrinterConnectionState.ERROR, "Ative o Bluetooth do celular.")
            return
        }
        val address = selectedDeviceAddress
        if (address.isNullOrBlank()) {
            update(PrinterConnectionState.ERROR, "Selecione uma impressora Bluetooth já pareada.")
            return
        }

        update(PrinterConnectionState.CONNECTING, "Conectando à impressora genérica…")
        Thread {
            val result = runCatching {
                val device = adapter.getRemoteDevice(address)
                val newSocket = openSerialSocket(device)
                val newOutput = newSocket.outputStream
                synchronized(connectionLock) {
                    disconnectSilently()
                    socket = newSocket
                    output = newOutput
                }
                device.name?.takeIf(String::isNotBlank) ?: address
            }
            result.fold(
                onSuccess = { name ->
                    update(PrinterConnectionState.CONNECTED, "$name conectada via ESC/POS.")
                },
                onFailure = { error ->
                    Log.e(TAG, "generic printer connection failed", error)
                    synchronized(connectionLock) { disconnectSilently() }
                    update(
                        PrinterConnectionState.ERROR,
                        "Não foi possível conectar à impressora genérica: ${error.message ?: "falha Bluetooth"}.",
                    )
                },
            )
        }.start()
    }

    override fun print(
        bitmap: Bitmap,
        copies: Int,
        completion: (Result<Unit>) -> Unit,
    ) {
        if (!isReady) {
            completion(Result.failure(IllegalStateException("Conecte a impressora genérica antes de imprimir.")))
            return
        }
        if (!printing.compareAndSet(false, true)) {
            completion(Result.failure(IllegalStateException("Aguarde a impressão atual terminar.")))
            return
        }

        update(PrinterConnectionState.PRINTING, "Enviando $copies etiqueta(s) via ESC/POS…")
        Thread {
            val result = runCatching {
                val payload = encodeRaster(bitmap, copies)
                synchronized(connectionLock) {
                    val currentOutput = output ?: error("A conexão Bluetooth foi encerrada.")
                    currentOutput.write(payload)
                    currentOutput.flush()
                }
            }
            printing.set(false)
            result.fold(
                onSuccess = {
                    update(PrinterConnectionState.CONNECTED, "$copies etiqueta(s) enviada(s) via ESC/POS.")
                },
                onFailure = { error ->
                    Log.e(TAG, "generic printer write failed", error)
                    synchronized(connectionLock) { disconnectSilently() }
                    update(
                        PrinterConnectionState.ERROR,
                        error.message ?: "Falha ao enviar para a impressora genérica.",
                    )
                },
            )
            completion(result)
        }.start()
    }

    override fun close() {
        synchronized(connectionLock) { disconnectSilently() }
        printing.set(false)
        update(PrinterConnectionState.DISCONNECTED, "Impressora genérica desconectada.")
    }

    @SuppressLint("MissingPermission")
    private fun openSerialSocket(device: BluetoothDevice): BluetoothSocket {
        val secure = device.createRfcommSocketToServiceRecord(SERIAL_PORT_UUID)
        return try {
            secure.connect()
            secure
        } catch (secureError: Exception) {
            runCatching { secure.close() }
            val insecure = device.createInsecureRfcommSocketToServiceRecord(SERIAL_PORT_UUID)
            try {
                insecure.connect()
                insecure
            } catch (insecureError: Exception) {
                runCatching { insecure.close() }
                insecureError.addSuppressed(secureError)
                throw insecureError
            }
        }
    }

    private fun encodeRaster(bitmap: Bitmap, copies: Int): ByteArray {
        val rowBytes = (bitmap.width + 7) / 8
        val raster = ByteArray(rowBytes * bitmap.height)
        for (y in 0 until bitmap.height) {
            for (x in 0 until bitmap.width) {
                val pixel = bitmap.getPixel(x, y)
                val alpha = pixel ushr 24 and 0xFF
                val red = pixel ushr 16 and 0xFF
                val green = pixel ushr 8 and 0xFF
                val blue = pixel and 0xFF
                val luminance = (red * 299 + green * 587 + blue * 114) / 1000
                if (alpha > 0 && luminance < 128) {
                    val index = y * rowBytes + x / 8
                    raster[index] =
                        (raster[index].toInt() or (0x80 ushr (x % 8))).toByte()
                }
            }
        }

        val image = ByteArrayOutputStream(8 + raster.size).apply {
            write(GS)
            write(0x76)
            write(0x30)
            write(0x00)
            write(rowBytes and 0xFF)
            write(rowBytes ushr 8)
            write(bitmap.height and 0xFF)
            write(bitmap.height ushr 8)
            write(raster)
        }.toByteArray()

        return ByteArrayOutputStream((image.size + 4) * copies + 8).apply {
            write(ESC)
            write(0x40)
            write(ESC)
            write(0x61)
            write(0x01)
            repeat(copies) {
                write(image)
                write(FORM_FEED)
            }
            write(ESC)
            write(0x61)
            write(0x00)
        }.toByteArray()
    }

    private fun bluetoothAdapter(): BluetoothAdapter? =
        context.getSystemService(BluetoothManager::class.java)?.adapter

    private fun disconnectSilently() {
        runCatching { output?.close() }
        runCatching { socket?.close() }
        output = null
        socket = null
    }

    private fun update(newState: PrinterConnectionState, message: String) {
        state = newState
        listener.onPrinterState(newState, message)
    }

    companion object {
        private const val TAG = "MDV-GenericPrinter"
        private const val ESC = 0x1B
        private const val GS = 0x1D
        private const val FORM_FEED = 0x0C
        private val SERIAL_PORT_UUID: UUID =
            UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")
    }
}
