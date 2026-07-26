package br.com.mercadodovale.adminestoque.printing

import android.annotation.SuppressLint
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.util.Log
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.Adler32
import java.util.zip.Deflater

enum class PrinterConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    PRINTING,
    ERROR,
}

class P50PrinterClient(
    private val context: Context,
    private val listener: Listener,
) {
    interface Listener {
        fun onPrinterState(state: PrinterConnectionState, message: String)
    }

    private val serviceUuid = UUID.fromString("0000ff00-0000-1000-8000-00805f9b34fb")
    private val readUuid = UUID.fromString("0000ff01-0000-1000-8000-00805f9b34fb")
    private val writeUuid = UUID.fromString("0000ff02-0000-1000-8000-00805f9b34fb")
    private val flowControlUuid = UUID.fromString("0000ff03-0000-1000-8000-00805f9b34fb")
    private val clientConfigurationUuid =
        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    private var gatt: BluetoothGatt? = null
    private var writeCharacteristic: BluetoothGattCharacteristic? = null
    private var readCharacteristic: BluetoothGattCharacteristic? = null
    private var flowControlCharacteristic: BluetoothGattCharacteristic? = null
    private val printing = AtomicBoolean(false)
    private val flowControlLock = Object()
    private val printerResultLock = Object()

    @Volatile
    private var usesFlowControl = false

    private var flowControlCredits = 0
    private var notificationSetupPending: BluetoothGattCharacteristic? = null

    @Volatile
    private var pendingPrinterResult: CountDownLatch? = null

    @Volatile
    private var printerResultSuccess = false

    @Volatile
    private var pendingWrite: CountDownLatch? = null

    @Volatile
    private var pendingWriteStatus = BluetoothGatt.GATT_FAILURE

    @Volatile
    var state: PrinterConnectionState = PrinterConnectionState.DISCONNECTED
        private set

    val isReady: Boolean
        get() = gatt != null && writeCharacteristic != null

    @SuppressLint("MissingPermission")
    fun connect() {
        if (state == PrinterConnectionState.CONNECTING || isReady) return
        val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null || !adapter.isEnabled) {
            update(PrinterConnectionState.ERROR, "Ative o Bluetooth do celular.")
            return
        }
        val device = findPairedPrinter(adapter)
        if (device == null) {
            update(PrinterConnectionState.ERROR, "P50 não encontrada entre os dispositivos pareados.")
            return
        }
        close()
        update(PrinterConnectionState.CONNECTING, "Conectando a ${device.name}…")
        gatt = device.connectGatt(context, false, callback, BluetoothDeviceTransport.LE)
    }

    fun print(
        bitmap: Bitmap,
        copies: Int,
        completion: (Result<Unit>) -> Unit,
    ) {
        if (!isReady) {
            completion(Result.failure(IllegalStateException("Conecte a P50 antes de imprimir.")))
            return
        }
        if (!printing.compareAndSet(false, true)) {
            completion(Result.failure(IllegalStateException("Aguarde a impressão atual terminar.")))
            return
        }
        update(PrinterConnectionState.PRINTING, "Enviando $copies etiqueta(s) para a P50…")
        Thread {
            val result = runCatching {
                val imagePacket = encodeBleImagePacket(bitmap)
                repeat(copies) { copy ->
                    val isFirst = copy == 0
                    val isLast = copy == copies - 1
                    val jobParts = mutableListOf<ByteArray>()
                    if (isFirst) {
                        jobParts += PAPER_TYPE_GAP
                        jobParts += DENSITY_NORMAL
                        jobParts += WAKEUP
                    }
                    jobParts += BLE_JOB_START
                    if (isFirst) jobParts += ALIGN_LABEL_START
                    jobParts += imagePacket
                    jobParts += LOCATE_NEXT_GAP
                    jobParts += BLE_JOB_END
                    if (isLast) jobParts += FEED_LABEL_END

                    val copyJob = join(*jobParts.toTypedArray())
                    Log.i(
                        TAG,
                        "BLE official job copy=${copy + 1}/$copies bytes=${copyJob.size} " +
                            "first=$isFirst last=$isLast",
                    )
                    sendJobAndAwaitPrinter(copyJob)
                }
            }
            printing.set(false)
            if (result.isSuccess) {
                update(PrinterConnectionState.CONNECTED, "$copies etiqueta(s) enviada(s) para impressão.")
            } else {
                Log.e(TAG, "print failed", result.exceptionOrNull())
                update(
                    stateAfterOperationFailure(),
                    result.exceptionOrNull()?.message ?: "Falha ao imprimir.",
                )
            }
            completion(result)
        }.start()
    }

    @SuppressLint("MissingPermission")
    fun close() {
        pendingWrite?.countDown()
        pendingWrite = null
        pendingPrinterResult?.countDown()
        pendingPrinterResult = null
        writeCharacteristic = null
        readCharacteristic = null
        flowControlCharacteristic = null
        notificationSetupPending = null
        synchronized(flowControlLock) {
            usesFlowControl = false
            flowControlCredits = 0
            flowControlLock.notifyAll()
        }
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        printing.set(false)
        if (state != PrinterConnectionState.ERROR) {
            update(PrinterConnectionState.DISCONNECTED, "Impressora desconectada.")
        }
    }

    private val callback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(currentGatt: BluetoothGatt, status: Int, newState: Int) {
            if (currentGatt !== gatt && newState == BluetoothProfile.STATE_DISCONNECTED) {
                currentGatt.close()
                return
            }
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    gatt = currentGatt
                    currentGatt.requestMtu(247)
                    currentGatt.discoverServices()
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    writeCharacteristic = null
                    readCharacteristic = null
                    flowControlCharacteristic = null
                    notificationSetupPending = null
                    synchronized(flowControlLock) {
                        usesFlowControl = false
                        flowControlCredits = 0
                        flowControlLock.notifyAll()
                    }
                    pendingWrite?.countDown()
                    pendingPrinterResult?.countDown()
                    if (!printing.get()) {
                        update(PrinterConnectionState.DISCONNECTED, "P50 desconectada.")
                    }
                }
            }
        }

        override fun onServicesDiscovered(currentGatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                update(PrinterConnectionState.ERROR, "Não foi possível descobrir os serviços da P50.")
                return
            }
            val service = findPrinterService(currentGatt.services)
            val characteristic = service?.characteristics?.firstOrNull { matches(it.uuid, writeUuid) }
            if (characteristic == null) {
                update(
                    PrinterConnectionState.ERROR,
                    "A P50 conectou, mas a característica FF02 não foi encontrada.",
                )
                return
            }
            service.characteristics.forEach {
                Log.i(TAG, "GATT characteristic=${it.uuid} properties=${it.properties}")
            }
            writeCharacteristic = characteristic
            val resultCharacteristic =
                service.characteristics.firstOrNull { matches(it.uuid, readUuid) }
            val flowCharacteristic =
                service.characteristics.firstOrNull { matches(it.uuid, flowControlUuid) }
            readCharacteristic = resultCharacteristic
            flowControlCharacteristic = flowCharacteristic
            synchronized(flowControlLock) {
                flowControlCredits = 0
                usesFlowControl = false
            }
            beginNotificationSetup(currentGatt, flowCharacteristic, resultCharacteristic)
        }

        override fun onCharacteristicWrite(
            currentGatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int,
        ) {
            if (matches(characteristic.uuid, writeUuid)) {
                pendingWriteStatus = status
                pendingWrite?.countDown()
            }
        }

        override fun onDescriptorWrite(
            currentGatt: BluetoothGatt,
            descriptor: BluetoothGattDescriptor,
            status: Int,
        ) {
            if (!matches(descriptor.uuid, clientConfigurationUuid)) return
            val characteristic = descriptor.characteristic
            Log.i(TAG, "${characteristic.uuid} notification descriptor status=$status")
            if (matches(characteristic.uuid, flowControlUuid)) {
                synchronized(flowControlLock) {
                    usesFlowControl = status == BluetoothGatt.GATT_SUCCESS
                    if (!usesFlowControl) flowControlCredits = 0
                    flowControlLock.notifyAll()
                }
            }
            val next = notificationSetupPending
            notificationSetupPending = null
            if (next != null) {
                if (!enableNotifications(currentGatt, next)) finishConnectionSetup()
            } else {
                finishConnectionSetup()
            }
        }

        @Deprecated("Deprecated in API 33")
        override fun onCharacteristicChanged(
            currentGatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
        ) {
            @Suppress("DEPRECATION")
            handleNotification(characteristic, characteristic.value ?: return)
        }

        override fun onCharacteristicChanged(
            currentGatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
        ) {
            handleNotification(characteristic, value)
        }
    }

    @SuppressLint("MissingPermission")
    private fun beginNotificationSetup(
        currentGatt: BluetoothGatt,
        flowCharacteristic: BluetoothGattCharacteristic?,
        resultCharacteristic: BluetoothGattCharacteristic?,
    ) {
        notificationSetupPending = resultCharacteristic
        if (flowCharacteristic != null && enableNotifications(currentGatt, flowCharacteristic)) return
        notificationSetupPending = null
        if (resultCharacteristic != null && enableNotifications(currentGatt, resultCharacteristic)) return
        finishConnectionSetup()
    }

    private fun finishConnectionSetup() {
        val flowMessage =
            if (usesFlowControl) "controle FF03 ativo" else "fluxo BLE confirmado"
        val resultMessage =
            if (readCharacteristic != null) "retorno FF01 ativo" else "sem retorno FF01"
        update(
            PrinterConnectionState.CONNECTED,
            "P50 conectada e pronta ($flowMessage; $resultMessage).",
        )
    }

    @SuppressLint("MissingPermission")
    private fun enableNotifications(
        currentGatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
    ): Boolean {
        if (!currentGatt.setCharacteristicNotification(characteristic, true)) {
            Log.w(TAG, "A P50 recusou ativar notificações FF03.")
            return false
        }
        val descriptor = characteristic.getDescriptor(clientConfigurationUuid)
        if (descriptor == null) {
            Log.w(TAG, "FF03 não expõe o descritor de notificações.")
            return false
        }
        val enableValue =
            if (characteristic.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) {
                BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            } else {
                BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
            }
        val accepted = if (Build.VERSION.SDK_INT >= 33) {
            currentGatt.writeDescriptor(
                descriptor,
                enableValue,
            ) == BluetoothGatt.GATT_SUCCESS
        } else {
            @Suppress("DEPRECATION")
            descriptor.value = enableValue
            @Suppress("DEPRECATION")
            currentGatt.writeDescriptor(descriptor)
        }
        Log.i(TAG, "FF03 notification request accepted=$accepted")
        return accepted
    }

    private fun handleNotification(
        characteristic: BluetoothGattCharacteristic,
        value: ByteArray,
    ) {
        if (matches(characteristic.uuid, flowControlUuid)) {
            if (value.size < 2 || value[0].toInt() and 0xFF != FLOW_CONTROL_PROTOCOL) return
            val announcedCredits = value[1].toInt() and 0xFF
            val credits = if (announcedCredits == 0x04) 4 else announcedCredits
            synchronized(flowControlLock) {
                flowControlCredits += credits
                Log.d(TAG, "FF03 credits +$credits total=$flowControlCredits")
                flowControlLock.notifyAll()
            }
            return
        }
        if (matches(characteristic.uuid, readUuid)) {
            val isPrinterStatus =
                value.size == 5 &&
                    value[0] == 0x1A.toByte() &&
                    value[1] == 0x1F.toByte() &&
                    value[2] == 0x07.toByte()
            if (isPrinterStatus || value.isEmpty()) return
            synchronized(printerResultLock) {
                if (pendingPrinterResult == null) return
                val result = value[0].toInt() and 0xFF
                printerResultSuccess =
                    result == PRINTER_RESULT_OK_AA ||
                        result == PRINTER_RESULT_OK_O ||
                        result == PRINTER_RESULT_OK_K
                Log.i(
                    TAG,
                    "FF01 print result=${value.joinToString(" ") { "%02X".format(it) }} " +
                        "success=$printerResultSuccess",
                )
                pendingPrinterResult?.countDown()
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun findPairedPrinter(adapter: android.bluetooth.BluetoothAdapter): BluetoothDevice? =
        adapter.bondedDevices.firstOrNull {
            val name = it.name.orEmpty()
            name.contains("P50", ignoreCase = true) || name.contains("MARKLIFE", ignoreCase = true)
        }

    private fun findPrinterService(services: List<BluetoothGattService>): BluetoothGattService? =
        services.firstOrNull { matches(it.uuid, serviceUuid) }

    private fun matches(actual: UUID, expected: UUID): Boolean =
        actual == expected ||
            actual.toString().contains(expected.toString().substring(4, 8), ignoreCase = true)

    private fun sendJobAndAwaitPrinter(payload: ByteArray) {
        val resultLatch = if (readCharacteristic != null) CountDownLatch(1) else null
        synchronized(printerResultLock) {
            printerResultSuccess = false
            pendingPrinterResult = resultLatch
        }
        try {
            sendPayload(payload)
            if (resultLatch != null) {
                if (!resultLatch.await(PRINTER_RESULT_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                    Log.w(
                        TAG,
                        "FF01 não confirmou em ${PRINTER_RESULT_TIMEOUT_SECONDS}s; " +
                            "a etiqueta já foi entregue pelo fluxo FF03.",
                    )
                    return
                }
                if (!printerResultSuccess) {
                    error("A P50 informou falha ao concluir a etiqueta.")
                }
            }
        } finally {
            synchronized(printerResultLock) {
                if (pendingPrinterResult === resultLatch) pendingPrinterResult = null
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun sendPayload(payload: ByteArray) {
        val currentGatt = gatt ?: error("Conexão Bluetooth encerrada.")
        val characteristic = writeCharacteristic ?: error("Canal de impressão FF02 indisponível.")
        val supportsWriteWithoutResponse =
            characteristic.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0
        var offset = 0
        while (offset < payload.size) {
            if (gatt == null || writeCharacteristic == null) {
                error("A P50 desconectou durante a impressão.")
            }
            acquireFlowControlCredit()
            val chunk = payload.copyOfRange(offset, minOf(offset + CHUNK_SIZE, payload.size))
            if (supportsWriteWithoutResponse) {
                writeChunkWithoutResponse(currentGatt, characteristic, chunk)
            } else {
                writeChunkWithResponse(currentGatt, characteristic, chunk)
            }
            Thread.sleep(if (usesFlowControl) FLOW_CONTROL_DELAY_MS else FALLBACK_DELAY_MS)
            offset += chunk.size
        }
    }

    private fun acquireFlowControlCredit() {
        synchronized(flowControlLock) {
            if (!usesFlowControl) return
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(FLOW_CONTROL_TIMEOUT_SECONDS)
            while (usesFlowControl && flowControlCredits <= 0) {
                val remainingNanos = deadline - System.nanoTime()
                if (remainingNanos <= 0) {
                    error("A P50 parou de liberar o envio Bluetooth (FF03).")
                }
                TimeUnit.NANOSECONDS.timedWait(flowControlLock, remainingNanos)
            }
            if (usesFlowControl) flowControlCredits--
        }
    }

    @SuppressLint("MissingPermission")
    private fun writeChunkWithResponse(
        currentGatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        chunk: ByteArray,
    ) {
        val latch = CountDownLatch(1)
        pendingWriteStatus = BluetoothGatt.GATT_FAILURE
        pendingWrite = latch
        val accepted = writeCharacteristic(
            currentGatt,
            characteristic,
            chunk,
            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT,
        )
        if (!accepted) {
            pendingWrite = null
            error("A P50 recusou um pacote Bluetooth.")
        }
        if (!latch.await(WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            pendingWrite = null
            error("A P50 não confirmou o recebimento dos dados.")
        }
        pendingWrite = null
        if (pendingWriteStatus != BluetoothGatt.GATT_SUCCESS) {
            error("Falha Bluetooth ${pendingWriteStatus} ao enviar a etiqueta.")
        }
    }

    @SuppressLint("MissingPermission")
    private fun writeChunkWithoutResponse(
        currentGatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        chunk: ByteArray,
    ) {
        val accepted = writeCharacteristic(
            currentGatt,
            characteristic,
            chunk,
            BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE,
        )
        if (!accepted) error("A P50 recusou um pacote Bluetooth.")
    }

    @SuppressLint("MissingPermission")
    private fun writeCharacteristic(
        currentGatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        chunk: ByteArray,
        writeType: Int,
    ): Boolean = if (Build.VERSION.SDK_INT >= 33) {
        currentGatt.writeCharacteristic(characteristic, chunk, writeType) ==
            BluetoothGatt.GATT_SUCCESS
    } else {
        @Suppress("DEPRECATION")
        characteristic.writeType = writeType
        @Suppress("DEPRECATION")
        characteristic.value = chunk
        @Suppress("DEPRECATION")
        currentGatt.writeCharacteristic(characteristic)
    }

    /**
     * Mantém a arte horizontal 240 x 160 e o envelope ZLIB 1F 10 exigido pelo
     * Bluetooth. O avanço até o próximo intervalo vem do form-feed USB 1D 0C.
     */
    private fun encodeBleImagePacket(source: Bitmap): ByteArray {
        val rowBytes = (source.width + 7) / 8
        val monochrome = ByteArray(rowBytes * source.height)
        for (y in 0 until source.height) {
            for (x in 0 until source.width) {
                val pixel = source.getPixel(x, y)
                val alpha = pixel ushr 24 and 0xFF
                val red = pixel ushr 16 and 0xFF
                val green = pixel ushr 8 and 0xFF
                val blue = pixel and 0xFF
                val luminance = (red * 299 + green * 587 + blue * 114) / 1000
                if (alpha > 0 && luminance < 128) {
                    val index = y * rowBytes + x / 8
                    monochrome[index] =
                        (monochrome[index].toInt() or (0x80 ushr (x % 8))).toByte()
                }
            }
        }
        val compressed = printerZlib(monochrome)
        Log.i(
            TAG,
            "horizontal raster=${source.width}x${source.height} raw=${monochrome.size} zlib=${compressed.size}",
        )
        return ByteArrayOutputStream(10 + compressed.size).apply {
            write(0x1F)
            write(0x10)
            write(rowBytes ushr 8)
            write(rowBytes)
            write(source.height ushr 8)
            write(source.height)
            write(compressed.size ushr 24)
            write(compressed.size ushr 16)
            write(compressed.size ushr 8)
            write(compressed.size)
            write(compressed)
        }.toByteArray()
    }

    private fun printerZlib(input: ByteArray): ByteArray {
        val deflater = Deflater(Deflater.NO_COMPRESSION, true)
        val rawDeflate = try {
            deflater.setInput(input)
            deflater.finish()
            ByteArrayOutputStream(input.size + 64).apply {
                val buffer = ByteArray(1024)
                while (!deflater.finished()) {
                    val count = deflater.deflate(buffer)
                    write(buffer, 0, count)
                }
            }.toByteArray()
        } finally {
            deflater.end()
        }
        val checksum = Adler32().apply { update(input) }.value
        return ByteArrayOutputStream(rawDeflate.size + 6).apply {
            write(0x28)
            write(0x15)
            write(rawDeflate)
            write((checksum ushr 24).toInt())
            write((checksum ushr 16).toInt())
            write((checksum ushr 8).toInt())
            write(checksum.toInt())
        }.toByteArray()
    }

    private fun join(vararg parts: ByteArray): ByteArray = ByteArrayOutputStream().apply {
        parts.forEach(::write)
    }.toByteArray()

    private fun stateAfterOperationFailure(): PrinterConnectionState =
        if (gatt != null && writeCharacteristic != null) {
            PrinterConnectionState.CONNECTED
        } else {
            PrinterConnectionState.DISCONNECTED
        }

    private fun update(newState: PrinterConnectionState, message: String) {
        state = newState
        listener.onPrinterState(newState, message)
    }

    private object BluetoothDeviceTransport {
        const val LE = 2
    }

    companion object {
        private const val TAG = "MDV-P50"
        private const val CHUNK_SIZE = 200
        private const val FLOW_CONTROL_PROTOCOL = 0x01
        private const val FLOW_CONTROL_DELAY_MS = 1L
        private const val FALLBACK_DELAY_MS = 8L
        private const val FLOW_CONTROL_TIMEOUT_SECONDS = 5L
        private const val WRITE_TIMEOUT_SECONDS = 5L
        private const val PRINTER_RESULT_TIMEOUT_SECONDS = 3L
        private const val PRINTER_RESULT_OK_AA = 0xAA
        private const val PRINTER_RESULT_OK_O = 0x4F
        private const val PRINTER_RESULT_OK_K = 0x4B
        private val PAPER_TYPE_GAP = byteArrayOf(0x1F, 0x80.toByte(), 0x02, 0x20)
        private val DENSITY_NORMAL = byteArrayOf(0x1F, 0x70, 0x02, 0x0A)
        private val WAKEUP = ByteArray(6)
        private val BLE_JOB_START = byteArrayOf(0x1F, 0xC0.toByte(), 0x01, 0x00)
        private val BLE_JOB_END = byteArrayOf(0x1F, 0xC0.toByte(), 0x01, 0x01)
        private val ALIGN_LABEL_START = byteArrayOf(0x1F, 0x11, 0x51)
        private val LOCATE_NEXT_GAP = byteArrayOf(0x1F, 0x12, 0x20, 0x00)
        private val FEED_LABEL_END = byteArrayOf(0x1F, 0x11, 0x50)
    }
}
