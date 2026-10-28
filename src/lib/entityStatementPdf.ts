import {jsPDF} from 'jspdf'
import type {InvoiceCompany} from './invoicePdf'
import type {Statement,StatementKind,StatementRow} from './entityStatement'
type Data={kind:StatementKind;entity:{nome:string;documento?:string|null};company?:InvoiceCompany|null;statement:Statement}
const currency=(cents:number)=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const date=(s:string)=>s.split('-').reverse().join('/')
const slug=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,70)||'cadastro'

export function createEntityStatementPdf(data:Data){
 const doc=new jsPDF({format:'a4',unit:'mm'}),left=14,right=196,width=182,bottom=277
 const {statement:s}=data
 let y=0
 doc.setProperties({title:`Faturas em aberto - ${data.entity.nome}`,author:data.company?.nome_fantasia||'Sistema de Gestão',subject:'Faturas vencidas e a vencer, com saldo em aberto'})
 function header(){
  doc.setFillColor(239,245,253);doc.rect(0,0,210,28,'F');doc.setTextColor(24,52,86);doc.setFont('helvetica','bold');doc.setFontSize(12)
  const company=data.company?.nome_fantasia||data.company?.razao_social||'Sistema de Gestão'
  const name=doc.splitTextToSize(company,width) as string[]
  doc.text(name.slice(0,2),left,11)
  doc.setFont('helvetica','normal');doc.setFontSize(8)
  doc.text(`Relatório de faturas ${data.kind==='cliente'?'a receber':'a pagar'} | Posição em ${date(s.asOf)}`,left,24)
  y=37;doc.setFont('helvetica','bold');doc.setFontSize(11)
  const entity=doc.splitTextToSize(`${data.kind==='cliente'?'Cliente':'Fornecedor'}: ${data.entity.nome}`,width) as string[]
  doc.text(entity,left,y);y+=entity.length*5
  doc.setFont('helvetica','normal');doc.setFontSize(8)
  if(data.entity.documento){doc.text(`Documento: ${data.entity.documento}`,left,y);y+=5}
  y+=3
 }
 function page(){doc.addPage();header()}
 function ensure(height:number){if(y+height>bottom)page()}
 const edges=[left,44,62,94,128,162,right]
 function tableHeader(){
  doc.setFillColor(32,88,157);doc.rect(left,y,width,8,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8)
  ;['Fatura','Parcela','Vencimento','Valor original','Pago','Em aberto'].forEach((h,i)=>doc.text(h,i<3?edges[i]+2:edges[i+1]-2,y+5,{align:i<3?'left':'right'}))
  y+=8;doc.setTextColor(31,41,55);doc.setFont('helvetica','normal')
 }
 function group(title:string,rows:StatementRow[],total:number){
  ensure(28);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(24,52,86);doc.text(`${title} (${rows.length})`,left,y);y+=7
  if(!rows.length){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(102,112,128);doc.text('Nenhuma fatura nesta situação.',left,y);y+=11;return}
  tableHeader()
  rows.forEach((r,i)=>{
   if(y+8+(i===rows.length-1?40:0)>bottom){page();doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(title+' - continuação',left,y);y+=6;tableHeader()}
   if(i%2===0){doc.setFillColor(246,248,251);doc.rect(left,y,width,8,'F')}
   doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(31,41,55)
   const cells=[r.invoice===null?'Sem número':'#'+String(r.invoice).padStart(7,'0'),String(r.installment||1),date(r.due),currency(r.amountCents),currency(r.paidCents),currency(r.balanceCents)]
   cells.forEach((text,i)=>doc.text(text,i<3?edges[i]+2:edges[i+1]-2,y+5,{align:i<3?'left':'right'}));y+=8
  })
  ensure(12);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Subtotal em aberto',left,y+6);doc.text(currency(total),right-2,y+6,{align:'right'});y+=18
 }
 header()
 doc.setFontSize(9);doc.setTextColor(31,41,55)
 doc.text(`Vencidas: ${currency(s.overdueCents)}`,left,y);doc.text(`A vencer: ${currency(s.upcomingCents)}`,right,y,{align:'right'});y+=7
 doc.setFont('helvetica','bold');doc.text(`Total em aberto: ${currency(s.totalCents)}`,left,y);y+=12
 group('Faturas vencidas',s.overdue,s.overdueCents)
 group('Faturas a vencer (inclui vencimento hoje)',s.upcoming,s.upcomingCents)
 ensure(20);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(102,112,128)
 doc.text(doc.splitTextToSize('Considera apenas faturas vinculadas às vendas ou compras deste cadastro, com saldo em aberto. Pagamentos parciais são descontados; faturas pagas e canceladas não são incluídas.',width),left,y)
 for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);doc.setDrawColor(215,223,233);doc.line(left,284,right,284);doc.setFontSize(8);doc.setTextColor(102,112,128);doc.text(`Posição: ${date(s.asOf)}`,left,290);doc.text(`Página ${p}/${doc.getNumberOfPages()}`,right,290,{align:'right'})}
 return doc
}
export function downloadEntityStatementPdf(data:Data){createEntityStatementPdf(data).save(`faturas-${data.kind}-${slug(data.entity.nome)}-${data.statement.asOf}.pdf`)}
