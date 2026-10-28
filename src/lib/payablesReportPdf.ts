import { jsPDF } from 'jspdf'
import type { InvoiceCompany } from './invoicePdf'

export type PayablesReportRow={
  descricao:string
  fornecedor:string
  vencimento:string
  valor:number
  pago:number
  saldo:number
  status:string
  categoria:string
  centro_custo:string
  forma_pagamento:string
  parcela_numero:number|null
}

type PayablesReportData={
  inicio?:string
  fim?:string
  statusFiltro?:string
  categoriaFiltro?:string
  centroFiltro?:string
  company?:InvoiceCompany|null
  rows:PayablesReportRow[]
}

const blue:[number,number,number]=[34,99,190]
const darkBlue:[number,number,number]=[24,52,86]
const paleBlue:[number,number,number]=[242,247,254]
const rowAlt:[number,number,number]=[248,250,252]
const text:[number,number,number]=[31,41,55]
const muted:[number,number,number]=[102,112,128]
const border:[number,number,number]=[215,223,233]
const red:[number,number,number]=[220,38,38]

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const dateBr=(value:string)=>{
  if(!value)return '-'
  const d=/^\\d{4}-\\d{2}-\\d{2}$/.test(value)
    ? new Date(Number(value.slice(0,4)),Number(value.slice(5,7))-1,Number(value.slice(8,10)),12)
    : new Date(value)
  return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('pt-BR').format(d)
}
const safe=(value:string)=>value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()
const fitText=(doc:jsPDF,value:string,width:number)=>{
  const t=String(value||'')
  if(doc.getTextWidth(t)<=width)return t
  let out=t
  while(out.length>1&&doc.getTextWidth(out+'...')>width)out=out.slice(0,-1)
  return out+'...'
}

function header(doc:jsPDF,data:PayablesReportData,continued=false){
  const company=data.company?.nome_fantasia||data.company?.razao_social||'SUA EMPRESA'
  doc.setFillColor(...paleBlue)
  doc.rect(0,0,297,31,'F')
  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(15)
  doc.text(company,12,12)
  doc.setTextColor(...blue)
  doc.setFontSize(12)
  doc.text(continued?'Relatório de Contas a Pagar - continuação':'Relatório de Contas a Pagar',12,20)
  doc.setTextColor(...muted)
  doc.setFont('helvetica','normal')
  doc.setFontSize(7.5)
  const period=data.inicio||data.fim?(data.inicio?dateBr(data.inicio):'início')+' a '+(data.fim?dateBr(data.fim):'hoje'):'Todos os vencimentos'
  doc.text('Período: '+period,285,9,{align:'right'})
  doc.text('Status: '+(data.statusFiltro||'Todos')+' | Categoria: '+(data.categoriaFiltro||'Todas'),285,15,{align:'right'})
  doc.text('Centro de custo: '+(data.centroFiltro||'Todos')+' | Emitido: '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date()),285,21,{align:'right'})
}

function tableHeader(doc:jsPDF,y:number){
  const cols=[
    {x:12,w:52,label:'Descrição'},
    {x:64,w:48,label:'Fornecedor'},
    {x:112,w:25,label:'Vencimento'},
    {x:137,w:31,label:'Valor'},
    {x:168,w:31,label:'Pago'},
    {x:199,w:31,label:'Saldo'},
    {x:230,w:25,label:'Status'},
    {x:255,w:30,label:'Categoria'}
  ]
  doc.setFillColor(...darkBlue)
  doc.rect(12,y,273,8,'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(7)
  cols.forEach(c=>{
    const numeric=['Valor','Pago','Saldo'].includes(c.label)
    doc.text(c.label,numeric?c.x+c.w-2:c.x+2,y+5.2,{align:numeric?'right':'left'})
  })
  return y+8
}

function footer(doc:jsPDF,data:PayablesReportData){
  const pages=doc.getNumberOfPages()
  for(let p=1;p<=pages;p++){
    doc.setPage(p)
    doc.setDrawColor(...border)
    doc.line(12,199,285,199)
    doc.setTextColor(...muted)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7)
    const left=[data.company?.email||'',data.company?.cnpj||''].filter(Boolean).join(' | ')
    doc.text(left,12,204)
    doc.text('Página '+p+'/'+pages,285,204,{align:'right'})
  }
}

export function generatePayablesReportPdf(data:PayablesReportData){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  doc.setProperties({
    title:'Relatório de Contas a Pagar',
    subject:'Contas a pagar filtradas no ERP',
    author:data.company?.nome_fantasia||data.company?.razao_social||'Sistema de Gestão'
  })
  header(doc,data)
  let y=39
  const total=data.rows.reduce((s,r)=>s+Number(r.valor),0)
  const paid=data.rows.reduce((s,r)=>s+Number(r.pago),0)
  const balance=data.rows.reduce((s,r)=>s+Number(r.saldo),0)
  const cards=[
    {x:12,label:'Lançamentos',value:String(data.rows.length)},
    {x:78,label:'Valor total',value:money(total)},
    {x:144,label:'Pago',value:money(paid)},
    {x:210,label:'Saldo em aberto',value:money(balance)}
  ]
  cards.forEach(card=>{
    doc.setFillColor(250,251,253)
    doc.setDrawColor(...border)
    doc.roundedRect(card.x,y,59,19,3,3,'FD')
    doc.setTextColor(...muted)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.2)
    doc.text(card.label,card.x+4,y+6)
    doc.setTextColor(...darkBlue)
    doc.setFont('helvetica','bold')
    doc.setFontSize(11)
    doc.text(card.value,card.x+4,y+14)
  })
  y+=26
  if(!data.rows.length){
    doc.setTextColor(...muted)
    doc.setFont('helvetica','normal')
    doc.setFontSize(10)
    doc.text('Nenhuma conta a pagar encontrada com os filtros selecionados.',12,y+10)
    footer(doc,data)
    doc.save('relatorio-contas-a-pagar.pdf')
    return
  }
  y=tableHeader(doc,y)
  data.rows.forEach((row,index)=>{
    if(y+9>194){
      doc.addPage()
      header(doc,data,true)
      y=39
      y=tableHeader(doc,y)
    }
    if(index%2===0){
      doc.setFillColor(...rowAlt)
      doc.rect(12,y,273,8,'F')
    }
    doc.setDrawColor(235,239,244)
    doc.line(12,y+8,285,y+8)
    doc.setTextColor(...text)
    doc.setFont('helvetica','normal')
    doc.setFontSize(6.8)
    doc.text(fitText(doc,row.descricao,48),14,y+5.1)
    doc.text(fitText(doc,row.fornecedor,44),66,y+5.1)
    doc.text(dateBr(row.vencimento),114,y+5.1)
    doc.text(money(row.valor),166,y+5.1,{align:'right'})
    doc.text(money(row.pago),197,y+5.1,{align:'right'})
    doc.setFont('helvetica','bold')
    doc.text(money(row.saldo),228,y+5.1,{align:'right'})
    doc.setFont('helvetica','normal')
    doc.text(fitText(doc,row.status,21),232,y+5.1)
    doc.text(fitText(doc,row.categoria,26),257,y+5.1)
    y+=8
  })
  if(y+19>194){
    doc.addPage()
    header(doc,data,true)
    y=39
  }
  doc.setFillColor(...paleBlue)
  doc.roundedRect(164,y+4,121,15,3,3,'F')
  doc.setFont('helvetica','bold')
  doc.setFontSize(8)
  doc.setTextColor(...darkBlue)
  doc.text('TOTAL',168,y+10)
  doc.text(money(total),203,y+10,{align:'right'})
  doc.text('PAGO',209,y+10)
  doc.text(money(paid),244,y+10,{align:'right'})
  doc.setTextColor(...red)
  doc.text('SALDO',250,y+10)
  doc.text(money(balance),282,y+10,{align:'right'})
  footer(doc,data)
  const suffix=[data.inicio||'',data.fim||''].filter(Boolean).map(safe).join('-a-')
  doc.save('relatorio-contas-a-pagar'+(suffix?'-'+suffix:'')+'.pdf')
}
