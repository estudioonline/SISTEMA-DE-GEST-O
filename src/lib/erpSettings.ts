export type CommercialSettings = {
  desconto_max_vendedor: number
  margem_minima_percentual: number
  validade_orcamento_dias: number
  sessao_inatividade_minutos: number
  bloquear_cliente_inadimplente: boolean
  exigir_aprovacao_limite_credito: boolean
  campos_obrigatorios: Record<string, unknown>
}

export function readSettings(form: FormData, existing: Record<string, unknown> = {}): CommercialSettings {
  const number = (key: string, min: number, max: number, integer = false) => {
    const raw = String(form.get(key) ?? '').trim()
    const value = Number(raw)
    if (!raw || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`Valor inválido para ${key}: informe de ${min} a ${max}.`)
    }
    return value
  }
  return {
    desconto_max_vendedor: number('desconto_max_vendedor', 0, 100),
    margem_minima_percentual: number('margem_minima_percentual', 0, 100),
    validade_orcamento_dias: number('validade_orcamento_dias', 1, 365, true),
    sessao_inatividade_minutos: number('sessao_inatividade_minutos', 5, 480, true),
    bloquear_cliente_inadimplente: form.has('bloquear_cliente_inadimplente'),
    exigir_aprovacao_limite_credito: form.has('exigir_aprovacao_limite_credito'),
    campos_obrigatorios: {...existing, venda_cliente: form.has('venda_cliente'), venda_vendedor: form.has('venda_vendedor'), compra_fornecedor: form.has('compra_fornecedor')},
  }
}

export function quoteExpiration(base: string, days: number): string {
  const date = new Date(base + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
