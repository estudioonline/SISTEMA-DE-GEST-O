import { jsPDF } from 'jspdf'
import type { InvoiceCompany } from './invoicePdf'

export type FinanceReportRow={
  descricao:string
  entidade:string
  vencimento:string
  valor:number
  pago:number
  saldo:number
  status:string
  categoria:string
  centro_custo:string
  forma_pagamento?:string
  tipo?:'receber'|'pagar'
  funcionario_tipo?:'gasto'|'vale'|null
  competencia?:string|null
  vale_descontado_em?:string|null
}

export type FinanceReportSection={
  title:string
  rows:FinanceReportRow[]
  note?:string
}

type FinanceReportData={
  title:string
  company?:InvoiceCompany|null
  inicio?:string
  fim?:string
  filters?:string[]
  sections:FinanceReportSection[]
  summary?:{label:string;value:string}[]
  filename?:string
}

const blue:[number,number,number]=[34,99,190]
const darkBlue:[number,number,number]=[24,52,86]
const paleBlue:[number,number,number]=[242,247,254]
const rowAlt:[number,number,number]=[248,250,252]
const text:[number,number,number]=[31,41,55]
const muted:[number,number,number]=[102,112,128]
const border:[number,number,number]=[215,223,233]

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const dateBr=(value:string)=>{
  if(!value)return '-'
  const d=/^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0,4)),Number(value.slice(5,7))-1,Number(value.slice(8,10)),12)
    : new Date(value)
  return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('pt-BR').format(d)
}
const safe=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()
const fit=(doc:jsPDF,value:string,width:number)=>{
  const t=String(value||'-')
  if(doc.getTextWidth(t)<=width)return t
  let out=t
  while(out.length>1&&doc.getTextWidth(out+'...')>width)out=out.slice(0,-1)
  return out+'...'
}

function drawHeader(doc:jsPDF,data:FinanceReportData,continued=false){
  const company=data.company?.nome_fantasia||data.company?.razao_social||'SUA EMPRESA'
  doc.setFillColor(...paleBlue);doc.rect(0,0,297,31,'F')
  doc.setTextColor(...darkBlue);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(company,12,11)
  doc.setTextColor(...blue);doc.setFontSize(11.5);doc.text(data.title+(continued?' - continuação':''),12,19)
  doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7.2)
  const period=data.inicio||data.fim?(data.inicio?dateBr(data.inicio):'início')+' a '+(data.fim?dateBr(data.fim):'hoje'):'Período completo'
  doc.text('Período: '+period,285,8,{align:'right'})
  doc.text('Emitido: '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date()),285,14,{align:'right'})
  if(data.filters?.length)doc.text(fit(doc,data.filters.join(' | '),112),285,20,{align:'right'})
}

function footer(doc:jsPDF,data:FinanceReportData){
  const pages=doc.getNumberOfPages()
  for(let p=1;p<=pages;p++){
    doc.setPage(p);doc.setDrawColor(...border);doc.line(12,199,285,199)
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7)
    doc.text([data.company?.email||'',data.company?.cnpj||''].filter(Boolean).join(' | '),12,204)
    doc.text('Página '+p+'/'+pages,285,204,{align:'right'})
  }
}

function ensure(doc:jsPDF,data:FinanceReportData,y:number,needed:number){
  if(y+needed<=194)return y
  doc.addPage();drawHeader(doc,data,true);return 38
}

function sectionTableHeader(doc:jsPDF,y:number){
  const cols=[
    {x:12,w:52,label:'Descrição'},
    {x:64,w:47,label:'Cliente / Fornecedor'},
    {x:111,w:25,label:'Vencimento'},
    {x:136,w:32,label:'Valor'},
    {x:168,w:31,label:'Pago'},
    {x:199,w:31,label:'Saldo'},
    {x:230,w:26,label:'Status'},
    {x:256,w:29,label:'Categoria'}
  ]
  doc.setFillColor(...darkBlue);doc.rect(12,y,273,8,'F')
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(6.8)
  cols.forEach(c=>doc.text(c.label,['Valor','Pago','Saldo'].includes(c.label)?c.x+c.w-2:c.x+2,y+5.2,{align:['Valor','Pago','Saldo'].includes(c.label)?'right':'left'}))
  return y+8
}

export function generateFinanceReportPdf(data:FinanceReportData){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  doc.setProperties({title:data.title,subject:'Relatório financeiro do ERP',author:data.company?.nome_fantasia||data.company?.razao_social||'Sistema de Gestão'})
  drawHeader(doc,data)
  let y=38

  if(data.summary?.length){
    const cards=data.summary.slice(0,4)
    const cardW=(273-(cards.length-1)*6)/Math.max(cards.length,1)
    cards.forEach((card,index)=>{
      const x=12+index*(cardW+6)
      doc.setFillColor(250,251,253);doc.setDrawColor(...border);doc.roundedRect(x,y,cardW,18,3,3,'FD')
      doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(card.label,x+4,y+6)
      doc.setTextColor(...darkBlue);doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(fit(doc,card.value,cardW-8),x+4,y+13.5)
    })
    y+=25
  }

  data.sections.forEach((section,sectionIndex)=>{
    y=ensure(doc,data,y,22)
    if(sectionIndex>0)y+=3
    doc.setTextColor(...darkBlue);doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(section.title,12,y+5)
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7)
    const total=section.rows.reduce((s,r)=>s+Number(r.valor),0)
    const paid=section.rows.reduce((s,r)=>s+Number(r.pago),0)
    const balance=section.rows.reduce((s,r)=>s+Number(r.saldo),0)
    doc.text(`${section.rows.length} lançamento(s) • Total ${money(total)} • Pago/Recebido ${money(paid)} • Saldo ${money(balance)}`,285,y+5,{align:'right'})
    if(section.note){doc.text(section.note,12,y+11);y+=5}
    y+=9
    if(!section.rows.length){
      doc.setTextColor(...muted);doc.setFontSize(8);doc.text('Nenhum lançamento nesta seção.',14,y+6);y+=12;return
    }
    y=sectionTableHeader(doc,y)
    section.rows.forEach((row,index)=>{
      y=ensure(doc,data,y,9)
      if(y===38)y=sectionTableHeader(doc,y)
      if(index%2===0){doc.setFillColor(...rowAlt);doc.rect(12,y,273,8,'F')}
      doc.setDrawColor(235,239,244);doc.line(12,y+8,285,y+8)
      doc.setTextColor(...text);doc.setFont('helvetica','normal');doc.setFontSize(6.6)
      doc.text(fit(doc,row.descricao,48),14,y+5.1)
      doc.text(fit(doc,row.entidade,43),66,y+5.1)
      doc.text(dateBr(row.vencimento),113,y+5.1)
      doc.text(money(row.valor),166,y+5.1,{align:'right'})
      doc.text(money(row.pago),197,y+5.1,{align:'right'})
      doc.setFont('helvetica','bold');doc.text(money(row.saldo),228,y+5.1,{align:'right'})
      doc.setFont('helvetica','normal');doc.text(fit(doc,row.status,22),232,y+5.1)
      doc.text(fit(doc,row.categoria,25),258,y+5.1)
      y+=8
    })
    y+=3
  })

  footer(doc,data)
  doc.save((data.filename||safe(data.title)||'relatorio-financeiro')+'.pdf')
}
