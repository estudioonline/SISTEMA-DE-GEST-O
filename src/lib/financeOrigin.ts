type Title={compra_id?:string|null;venda_id?:string|null;fatura_venda_id?:string|null;funcionario_id?:string|null}
type Sale={id:string;venda_numero:number|null}
type Purchase={id:string;fatura_numero:number|null}
type Invoice={id:string;venda_id:string|null}
type InvoiceLink={fatura_id:string;venda_id:string}

function originSaleIds(title:Title,invoices:Invoice[],links:InvoiceLink[]):string[]{
  const invoice=title.fatura_venda_id?invoices.find(row=>row.id===title.fatura_venda_id):undefined
  return [...new Set([
    title.venda_id,invoice?.venda_id,
    ...links.filter(row=>Boolean(title.fatura_venda_id)&&row.fatura_id===title.fatura_venda_id).map(row=>row.venda_id)
  ].filter((id):id is string=>Boolean(id)))]
}

export function financeOriginDocuments(title:Title,sales:Sale[],purchases:Purchase[],invoices:Invoice[],links:InvoiceLink[]):{kind:'compra'|'venda';id:string;number:number}[]{
  if(title.compra_id){
    const purchase=purchases.find(row=>row.id===title.compra_id)
    return purchase?.fatura_numero!=null?[{kind:'compra',id:purchase.id,number:purchase.fatura_numero}]:[]
  }
  return originSaleIds(title,invoices,links).flatMap(id=>{
    const sale=sales.find(row=>row.id===id)
    return sale?.venda_numero!=null?[{kind:'venda' as const,id:sale.id,number:sale.venda_numero}]:[]
  })
}

export function financeOriginLabel(title:Title,sales:Sale[],purchases:Purchase[],invoices:Invoice[],links:InvoiceLink[]):string {
  if(title.compra_id){
    const purchase=purchases.find(row=>row.id===title.compra_id)
    return purchase?.fatura_numero!=null?'Compra C'+String(purchase.fatura_numero).padStart(5,'0'):'Compra · referência indisponível'
  }
  const saleIds=originSaleIds(title,invoices,links)
  if(saleIds.length){
    const codes=saleIds.map(id=>{
      const sale=sales.find(row=>row.id===id)
      return sale?.venda_numero!=null?'S'+String(sale.venda_numero).padStart(5,'0'):'referência indisponível'
    })
    return `${saleIds.length>1?'Vendas':'Venda'} ${codes.join(', ')}`
  }
  if(title.fatura_venda_id)return 'Venda · referência indisponível'
  return title.funcionario_id?'RH':'Lançamento manual'
}
