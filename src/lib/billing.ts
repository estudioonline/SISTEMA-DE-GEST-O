type Sale={id:string;cliente_id:string|null;status:string;total:number}
type Invoice={id:string;venda_id:string;status:string}
type InvoiceLink={fatura_id:string;venda_id:string}
type Title={venda_id:string|null;fatura_venda_id?:string|null}

export function titlesForSale<T extends Title>(saleId:string,titles:T[],invoices:Invoice[],links:InvoiceLink[]):T[]{
  const invoiceIds=new Set(invoices.filter(i=>i.venda_id===saleId||links.some(l=>l.venda_id===saleId&&l.fatura_id===i.id)).map(i=>i.id))
  return titles.filter(t=>t.venda_id===saleId||Boolean(t.fatura_venda_id&&invoiceIds.has(t.fatura_venda_id)))
}

export function validateBilling(saleIds:string[],sales:Sale[],invoices:Invoice[],links:InvoiceLink[],payment:string,lines:{vencimento:string;valor:number}[]){
  if(!saleIds.length||new Set(saleIds).size!==saleIds.length)throw new Error('Selecione ao menos uma venda, sem repetições.')
  const selected=saleIds.map(id=>sales.find(s=>s.id===id))
  if(selected.some(s=>!s||!['pedido','faturado'].includes(s.status)))throw new Error('Uma das vendas foi alterada. Atualize a lista antes de faturar.')
  const rows=selected as Sale[]
  if(new Set(rows.map(s=>s.cliente_id)).size!==1)throw new Error('Todas as vendas devem ser do mesmo cliente.')
  if(rows.some(s=>invoices.some(i=>i.status==='ativa'&&(i.venda_id===s.id||links.some(l=>l.venda_id===s.id&&l.fatura_id===i.id)))))throw new Error('Uma das vendas já possui fatura ativa. Atualize a lista.')
  if(!['pix','cartao','boleto','dinheiro'].includes(payment))throw new Error('Forma de pagamento inválida.')
  if(!lines.length||lines.length>24||payment==='dinheiro'&&lines.length!==1)throw new Error('Dinheiro exige parcela única. Informe de 1 a 24 parcelas.')
  const validDate=(value:string)=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
    const date=new Date(value+'T12:00:00Z')
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value
  }
  if(lines.some(l=>!validDate(l.vencimento)||!Number.isFinite(l.valor)||l.valor<=0||Math.abs(l.valor*100-Math.round(l.valor*100))>0.000001))throw new Error('Preencha vencimento válido e valor com até duas casas decimais em todas as parcelas.')
  const expected=rows.reduce((s,r)=>s+Math.round(Number(r.total)*100),0)
  const actual=lines.reduce((s,r)=>s+Math.round(Number(r.valor)*100),0)
  if(!Number.isFinite(expected)||actual!==expected)throw new Error('A soma das parcelas deve ser igual ao total das vendas selecionadas.')
  return {selected:rows,total:expected/100}
}
