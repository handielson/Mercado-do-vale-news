package br.com.mercadodovale.adminestoque.printing

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import br.com.mercadodovale.adminestoque.domain.LabelSize
import br.com.mercadodovale.adminestoque.domain.ProductLabelProduct
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix
import kotlin.math.max
import kotlin.math.min

/**
 * Replica o padrão da impressão por cabo definido em LabelPrintModal.tsx.
 * O bitmap é produzido diretamente em 203 dpi (aprox. 8 dots/mm), sem
 * redimensionamento antes de ser enviado à P50.
 */
object LabelRenderer {
    private const val DOTS_PER_MM = 8
    private const val MAX_PRINTER_WIDTH = 384
    private const val SCREEN_PX_TO_PRINTER_DOTS = 203f / 96f
    private const val CONTENT_TOP_OFFSET_MM = 1
    private const val BARCODE_HEIGHT_REDUCTION_MM = 2

    fun render(product: ProductLabelProduct, size: LabelSize): Bitmap {
        val width = min(MAX_PRINTER_WIDTH, size.widthMm * DOTS_PER_MM)
        val height = size.heightMm * DOTS_PER_MM
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val padding = max(4f, size.paddingMm * DOTS_PER_MM)
        val innerWidth = width - padding * 2
        val namePaint = paint(size.fontName * SCREEN_PX_TO_PRINTER_DOTS, bold = true)
        val skuPaint = paint(
            max(size.fontName + 1f, size.fontName * 1.2f) * SCREEN_PX_TO_PRINTER_DOTS,
            bold = true,
            monospace = true,
        )
        val pricePaint = paint(size.fontPrice * SCREEN_PX_TO_PRINTER_DOTS, bold = true)
        val barcodeValuePaint = paint(size.barcodeFont * SCREEN_PX_TO_PRINTER_DOTS)

        var y = padding + CONTENT_TOP_OFFSET_MM * DOTS_PER_MM - namePaint.ascent()
        y = drawWrappedText(canvas, product.name.uppercase(), width / 2f, y, innerWidth, namePaint, 2)
        if (product.sku.isNotBlank()) {
            canvas.drawText(ellipsize(product.sku, innerWidth, skuPaint), width / 2f, y, skuPaint)
            y += skuPaint.fontSpacing
        }

        val barcodeValue = product.ean.ifBlank { product.sku }
        val barcodeBlockHeight = if (barcodeValue.isBlank()) 0f else height * 0.40f
        val barcodeTop = height - padding - barcodeBlockHeight
        val valueGap = max(2, (0.4f * DOTS_PER_MM).toInt())
        val valueHeight = barcodeValuePaint.fontMetrics.run { descent - ascent }
        val originalBarsHeight = if (barcodeValue.isBlank()) {
            0
        } else {
            max(16, (barcodeBlockHeight - valueGap - valueHeight).toInt())
        }
        val barsHeight = if (barcodeValue.isBlank()) {
            0
        } else {
            max(16, originalBarsHeight - BARCODE_HEIGHT_REDUCTION_MM * DOTS_PER_MM)
        }
        val barsTop = barcodeTop + originalBarsHeight - barsHeight

        val priceSlotTop = y
        val priceSlotBottom = if (barcodeValue.isBlank()) {
            height - padding
        } else {
            barsTop - max(2f, padding * 0.4f)
        }
        val availablePriceHeight = max(1f, priceSlotBottom - priceSlotTop)
        val naturalPriceHeight = pricePaint.fontMetrics.run { descent - ascent }
        if (naturalPriceHeight > availablePriceHeight) {
            pricePaint.textSize *= availablePriceHeight / naturalPriceHeight
        }
        val priceBaseline = (y + priceSlotBottom) / 2f -
            (pricePaint.ascent() + pricePaint.descent()) / 2f
        canvas.drawText(product.formattedPrice, width / 2f, priceBaseline, pricePaint)

        if (barcodeValue.isNotBlank()) {
            val barcodeWidth = (width - 2f * 2.5f * DOTS_PER_MM).toInt()
            val format = if (isValidEan13(barcodeValue)) BarcodeFormat.EAN_13 else BarcodeFormat.CODE_128
            matrixBitmap(barcodeValue, format, barcodeWidth, barsHeight)?.let {
                val left = (width - it.width) / 2f
                canvas.drawBitmap(it, left, barsTop, null)
                val valueBaseline = barsTop + it.height + valueGap - barcodeValuePaint.ascent()
                canvas.drawText(barcodeValue, width / 2f, valueBaseline, barcodeValuePaint)
            }
        }
        return bitmap
    }

    fun renderCustomText(value: String, size: LabelSize, fontPercent: Int = 100): Bitmap {
        val width = min(MAX_PRINTER_WIDTH, size.widthMm * DOTS_PER_MM)
        val height = size.heightMm * DOTS_PER_MM
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val text = value.trim().ifBlank { "TEXTO" }
        val padding = max(4, (size.paddingMm * DOTS_PER_MM).toInt())
        val availableWidth = (width - padding * 2).coerceAtLeast(1)
        val availableHeight = (height - padding * 2).coerceAtLeast(1)
        val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }

        var low = 8f
        var high = availableHeight.toFloat()
        var best = low
        repeat(22) {
            val candidate = (low + high) / 2f
            textPaint.textSize = candidate
            val layout = customTextLayout(text, textPaint, availableWidth)
            if (layout.height <= availableHeight) {
                best = candidate
                low = candidate
            } else {
                high = candidate
            }
        }

        textPaint.textSize = best * fontPercent.coerceIn(40, 100) / 100f
        val layout = customTextLayout(text, textPaint, availableWidth)
        canvas.save()
        canvas.translate(
            padding.toFloat(),
            padding + (availableHeight - layout.height).coerceAtLeast(0) / 2f,
        )
        layout.draw(canvas)
        canvas.restore()
        return bitmap
    }

    @SuppressLint("WrongConstant")
    private fun customTextLayout(value: String, paint: TextPaint, width: Int): StaticLayout =
        StaticLayout.Builder.obtain(value, 0, value.length, paint, width)
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .setIncludePad(false)
            .setLineSpacing(0f, 1f)
            .setBreakStrategy(Layout.BREAK_STRATEGY_SIMPLE)
            .build()

    private fun paint(size: Float, bold: Boolean = false, monospace: Boolean = false) =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = size
            textAlign = Paint.Align.CENTER
            typeface = when {
                monospace && bold -> Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                monospace -> Typeface.MONOSPACE
                bold -> Typeface.DEFAULT_BOLD
                else -> Typeface.DEFAULT
            }
        }

    private fun drawWrappedText(
        canvas: Canvas,
        value: String,
        x: Float,
        firstBaseline: Float,
        maxWidth: Float,
        paint: Paint,
        maxLines: Int,
    ): Float {
        val words = value.trim().split(Regex("\\s+"))
        val lines = mutableListOf<String>()
        var current = ""
        for (word in words) {
            val candidate = if (current.isBlank()) word else "$current $word"
            if (paint.measureText(candidate) <= maxWidth || current.isBlank()) {
                current = candidate
            } else {
                lines += current
                current = word
                if (lines.size == maxLines - 1) break
            }
        }
        if (current.isNotBlank() && lines.size < maxLines) lines += current
        var baseline = firstBaseline
        lines.take(maxLines).forEach { line ->
            canvas.drawText(ellipsize(line, maxWidth, paint), x, baseline, paint)
            baseline += paint.fontSpacing
        }
        return baseline
    }

    private fun ellipsize(value: String, maxWidth: Float, paint: Paint): String {
        if (paint.measureText(value) <= maxWidth) return value
        var shortened = value
        while (shortened.length > 1 && paint.measureText("$shortened…") > maxWidth) {
            shortened = shortened.dropLast(1)
        }
        return "$shortened…"
    }

    private fun isValidEan13(value: String): Boolean {
        if (!value.matches(Regex("\\d{13}"))) return false
        val expected = value.take(12).mapIndexed { index, char ->
            char.digitToInt() * if (index % 2 == 0) 1 else 3
        }.sum().let { (10 - it % 10) % 10 }
        return expected == value.last().digitToInt()
    }

    private fun matrixBitmap(
        value: String,
        format: BarcodeFormat,
        width: Int,
        height: Int,
    ): Bitmap? = runCatching {
        val hints = mapOf(EncodeHintType.MARGIN to 0)
        val matrix: BitMatrix = MultiFormatWriter().encode(value, format, width, height, hints)
        val pixels = IntArray(matrix.width * matrix.height)
        for (y in 0 until matrix.height) {
            for (x in 0 until matrix.width) {
                pixels[y * matrix.width + x] = if (matrix[x, y]) Color.BLACK else Color.WHITE
            }
        }
        Bitmap.createBitmap(matrix.width, matrix.height, Bitmap.Config.ARGB_8888).apply {
            setPixels(pixels, 0, matrix.width, 0, 0, matrix.width, matrix.height)
        }
    }.getOrNull()
}
