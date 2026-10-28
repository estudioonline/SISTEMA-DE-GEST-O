export type StatementKind='cliente'|'fornecedor'
type Parent={cliente_id?:string;fornecedor_id?:string;fatura_numero:number|null;status:string}
export type StatementWire={id:string;tipo:string;descricao:string;vencimento:string;valor:number|string;valor_pago:number|string;status:string;parcela_numero:number|null;vendas?:Parent|Parent[]|null;compras?:Parent|Parent[]|null}
export type StatementRow={id:string;invoice:number|null;installment:number|null;description:string;due:string;amountCents:number;paidCents:number;balanceCents:number}
export type Statement={asOf:string;overdue:StatementRow[];upcoming:StatementRow[];overdueCents:number;upcomingCents:number;totalCents:number}
export function buildStatement(rows:StatementWire[],kind:StatementKind,entityId:string,asOf:string):Statement{
 const result:Statement={asOf,overdue:[],upcoming:[],overdueCents:0,upcomingCents:0,totalCents:0}
 for(const row of rows){
  const relation=kind==='cliente'?row.vendas:row.compras
  const parent=Array.isArray(relation)?relation[0]:relation
  if(!parent||(kind==='cliente'?parent.cliente_id:parent.fornecedor_id)!==entityId)continue
  if(!(kind==='cliente'?['pedido','faturado']:['pedido_aprovado','pedido_recebido']).includes(parent.status))continue
  if(row.tipo!==(kind==='cliente'?'receber':'pagar')||!['aberto','parcial'].includes(row.status))continue
  const amountCents=Math.round(Number(row.valor)*100),paidCents=Math.round(Number(row.valor_pago)*100)
  if(!Number.isFinite(amountCents)||!Number.isFinite(paidCents)||!/^\d{4}-\d{2}-\d{2}$/.test(row.vencimento))throw new Error('Fatura com valores ou vencimento inválidos. Revise o lançamento antes de emitir o relatório.')
  const balanceCents=Math.max(0,amountCents-paidCents)
  if(!balanceCents)continue
  const item={id:row.id,invoice:parent.fatura_numero,installment:row.parcela_numero,description:row.descricao,due:row.vencimento,amountCents,paidCents,balanceCents}
  if(row.vencimento<asOf){result.overdue.push(item);result.overdueCents+=balanceCents}else{result.upcoming.push(item);result.upcomingCents+=balanceCents}
 }
 for(const group of [result.overdue,result.upcoming])group.sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id))
 result.totalCents=result.overdueCents+result.upcomingCents
 return result
}
