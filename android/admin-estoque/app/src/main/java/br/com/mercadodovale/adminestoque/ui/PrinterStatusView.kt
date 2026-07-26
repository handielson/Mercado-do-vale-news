package br.com.mercadodovale.adminestoque.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import br.com.mercadodovale.adminestoque.printing.PrinterConnectionState

class PrinterStatusView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var iconColor = Color.GRAY
    private var pulse = 1f
    private val animator = ValueAnimator.ofFloat(0.55f, 1f).apply {
        duration = 850
        repeatMode = ValueAnimator.REVERSE
        repeatCount = ValueAnimator.INFINITE
        interpolator = AccelerateDecelerateInterpolator()
        addUpdateListener {
            pulse = it.animatedValue as Float
            invalidate()
        }
    }

    init {
        contentDescription = "Impressora Bluetooth desconectada"
    }

    fun setState(state: PrinterConnectionState) {
        iconColor = when (state) {
            PrinterConnectionState.DISCONNECTED -> Color.rgb(100, 116, 139)
            PrinterConnectionState.CONNECTING -> Color.rgb(245, 158, 11)
            PrinterConnectionState.CONNECTED -> Color.rgb(22, 163, 74)
            PrinterConnectionState.PRINTING -> Color.rgb(37, 99, 235)
            PrinterConnectionState.ERROR -> Color.rgb(220, 38, 38)
        }
        contentDescription = when (state) {
            PrinterConnectionState.DISCONNECTED -> "Impressora Bluetooth desconectada"
            PrinterConnectionState.CONNECTING -> "Impressora Bluetooth conectando"
            PrinterConnectionState.CONNECTED -> "Impressora Bluetooth conectada"
            PrinterConnectionState.PRINTING -> "Impressora enviando etiqueta"
            PrinterConnectionState.ERROR -> "Erro na impressora Bluetooth"
        }
        if (state == PrinterConnectionState.CONNECTING || state == PrinterConnectionState.CONNECTED || state == PrinterConnectionState.PRINTING) {
            if (!animator.isStarted) animator.start()
        } else {
            animator.cancel()
            pulse = 1f
        }
        invalidate()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val size = (resources.displayMetrics.density * 68).toInt()
        setMeasuredDimension(resolveSize(size, widthMeasureSpec), resolveSize(size, heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        paint.color = withAlpha(iconColor, pulse)
        val w = width.toFloat()
        val h = height.toFloat()
        val body = RectF(w * 0.16f, h * 0.34f, w * 0.84f, h * 0.76f)
        canvas.drawRoundRect(body, w * 0.07f, w * 0.07f, paint)
        paint.color = Color.WHITE
        canvas.drawRect(w * 0.29f, h * 0.12f, w * 0.71f, h * 0.43f, paint)
        canvas.drawRect(w * 0.27f, h * 0.64f, w * 0.73f, h * 0.9f, paint)
        paint.color = withAlpha(iconColor, pulse)
        canvas.drawRect(w * 0.32f, h * 0.7f, w * 0.68f, h * 0.84f, paint)
        paint.color = Color.WHITE
        canvas.drawCircle(w * 0.72f, h * 0.48f, w * 0.04f, paint)
    }

    override fun onDetachedFromWindow() {
        animator.cancel()
        super.onDetachedFromWindow()
    }

    private fun withAlpha(color: Int, value: Float): Int =
        Color.argb((255 * value).toInt(), Color.red(color), Color.green(color), Color.blue(color))
}
