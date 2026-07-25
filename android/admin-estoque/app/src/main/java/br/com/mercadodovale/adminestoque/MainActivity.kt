package br.com.mercadodovale.adminestoque

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import br.com.mercadodovale.adminestoque.data.ApiConfig

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(createDashboard())
    }

    private fun createDashboard(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 48)
            setBackgroundColor(Color.rgb(248, 250, 248))

            addView(title("MDV Admin Estoque", 28, Color.rgb(11, 107, 58)))
            addView(title("Operacao conectada exclusivamente a VPS/MySQL", 15, Color.DKGRAY))
            addView(card("Movimentar estoque", "Leia o QR ou pesquise o produto para consultar onde ele esta e transferir entre locais."))
            addView(card("Imprimir etiquetas", "Selecione o tamanho centralizado da etiqueta e a quantidade. A conexao Marklife P50 sera habilitada apos homologacao do protocolo."))
            addView(title("API configurada: ${ApiConfig.baseUrl}", 12, Color.GRAY))
        }
    }

    private fun title(text: String, size: Int, color: Int) = TextView(this).apply {
        this.text = text
        textSize = size.toFloat()
        setTextColor(color)
        setPadding(0, 0, 0, 24)
    }

    private fun card(heading: String, detail: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(28, 28, 28, 28)
        setBackgroundColor(Color.WHITE)
        addView(title(heading, 20, Color.rgb(11, 107, 58)))
        addView(title(detail, 15, Color.DKGRAY))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            bottomMargin = 24
        }
    }
}
