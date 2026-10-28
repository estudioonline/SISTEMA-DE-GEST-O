import { jsPDF } from 'jspdf'
import type { InvoiceCompany } from './invoicePdf'

export type CommissionReportRow = {
  pagamento_id: string
  venda_id: string
  vendedor_id: string | null
  fatura_numero: number
  parcela_numero: number | null
  data_pagamento: string
  cliente: string
  vendedor: string
  forma_pagamento: string
  valor_venda: number
  valor_recebido: number
  percentual_comissao: number
  comissao_apurada: number
}

type CommissionReportData = {
  inicio: string
  fim: string
  company?: InvoiceCompany | null
  vendedorFiltro?: string | null
  rows: CommissionReportRow[]
}

const blue:[number,number,number]=[34,99,190]
const darkBlue:[number,number,number]=[24,52,86]
const paleBlue:[number,number,number]=[242,247,254]
const rowAlt:[number,number,number]=[248,250,252]
const text:[number,number,number]=[31,41,55]
const muted:[number,number,number]=[102,112,128]
const border:[number,number,number]=[215,223,233]

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const invoiceNo=(n:number|null|undefined)=>String(n||0).padStart(7,'0')
const dateBr=(value:string)=>{
  if(!value)return '-'
  const d=/^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0,4)),Number(value.slice(5,7))-1,Number(value.slice(8,10)),12)
    : new Date(value)
  return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('pt-BR').format(d)
}
const safe=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()

function header(doc:jsPDF,data:CommissionReportData,continued=false){
  const company=data.company?.nome_fantasia||data.company?.razao_social||'SUA EMPRESA'
  doc.setFillColor(...paleBlue)
  doc.rect(0,0,297,31,'F')

  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(15)
  doc.text(company,12,12)

  doc.setTextColor(...blue)
  doc.setFontSize(12)
  doc.text(continued?'Relatório de Comissões - continuação':'Relatório de Comissões sobre Vendas Recebidas',12,20)

  doc.setTextColor(...muted)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8)
  doc.text(`Período: ${dateBr(data.inicio)} a ${dateBr(data.fim)}`,285,10,{align:'right'})
  doc.text(`Vendedor: ${data.vendedorFiltro||'Todos'}`,285,16,{align:'right'})
  doc.text(`Emitido em: ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date())}`,285,22,{align:'right'})
}

function tableHeader(doc:jsPDF,y:number){
  const cols=[
    {x:12,w:25,label:'Fatura'},
    {x:37,w:25,label:'Recebimento'},
    {x:62,w:54,label:'Cliente'},
    {x:116,w:44,label:'Vendedor'},
    {x:160,w:23,label:'Forma'},
    {x:183,w:32,label:'Recebido'},
    {x:215,w:18,label:'%'},
    {x:233,w:52,label:'Comissão'}
  ]

  doc.setFillColor(...darkBlue)
  doc.rect(12,y,273,8,'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(7.1)
  cols.forEach(c=>{
    const numeric=['Recebido','%','Comissão'].includes(c.label)
    doc.text(c.label,numeric?c.x+c.w-2:c.x+2,y+5.2,{align:numeric?'right':'left'})
  })
  return y+8
}

function fitText(doc:jsPDF,value:string,width:number){
  const t=String(value||'')
  if(doc.getTextWidth(t)<=width)return t
  let out=t
  while(out.length>1&&doc.getTextWidth(out+'...')>width)out=out.slice(0,-1)
  return out+'...'
}

function addFooter(doc:jsPDF,data:CommissionReportData){
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
    doc.text(`Página ${p}/${pages}`,285,204,{align:'right'})
  }
}

export function generateCommissionReportPdf(data:CommissionReportData){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  doc.setProperties({
    title:`Relatório de Comissões ${dateBr(data.inicio)} a ${dateBr(data.fim)}`,
    subject:'Comissões sobre recebimentos líquidos de estornos',
    author:data.company?.nome_fantasia||data.company?.razao_social||'Sistema de Gestão'
  })

  header(doc,data)
  let y=39

  const totalReceived=data.rows.reduce((s,r)=>s+Number(r.valor_recebido),0)
  const totalCommission=data.rows.reduce((s,r)=>s+Number(r.comissao_apurada),0)
  const sellers=new Set(data.rows.map(r=>r.vendedor).filter(Boolean)).size
  const sales=new Set(data.rows.map(r=>r.venda_id)).size

  const cards=[
    {x:12,label:'Vendas recebidas',value:String(sales)},
    {x:78,label:'Recebido líquido de estornos',value:money(totalReceived)},
    {x:144,label:'Comissão apurada',value:money(totalCommission)},
    {x:210,label:'Vendedores',value:String(sellers)}
  ]
  cards.forEach(c=>{
    doc.setFillColor(250,251,253)
    doc.setDrawColor(...border)
    doc.roundedRect(c.x,y,59,19,3,3,'FD')
    doc.setTextColor(...muted)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.2)
    doc.text(c.label,c.x+4,y+6)
    doc.setTextColor(...darkBlue)
    doc.setFont('helvetica','bold')
    doc.setFontSize(11)
    doc.text(c.value,c.x+4,y+14)
  })

  y+=26

  if(!data.rows.length){
    doc.setTextColor(...muted)
    doc.setFont('helvetica','normal')
    doc.setFontSize(10)
    doc.text('Nenhum recebimento de venda encontrado no período selecionado.',12,y+10)
    addFooter(doc,data)
    doc.save(`relatorio-comissoes-${data.vendedorFiltro?safe(data.vendedorFiltro)+'-':''}${safe(data.inicio)}-a-${safe(data.fim)}.pdf`)
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
    doc.setFontSize(7)

    const fatura=`#${invoiceNo(row.fatura_numero)}${row.parcela_numero?' / '+row.parcela_numero:''}`
    doc.text(fatura,14,y+5.1)
    doc.text(dateBr(row.data_pagamento),39,y+5.1)
    doc.text(fitText(doc,row.cliente,50),64,y+5.1)
    doc.text(fitText(doc,row.vendedor,40),118,y+5.1)
    doc.text((row.forma_pagamento||'').toUpperCase(),162,y+5.1)
    doc.text(money(Number(row.valor_recebido)),213,y+5.1,{align:'right'})
    doc.text(Number(row.percentual_comissao).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%',231,y+5.1,{align:'right'})
    doc.setFont('helvetica','bold')
    doc.setTextColor(...blue)
    doc.text(money(Number(row.comissao_apurada)),283,y+5.1,{align:'right'})
    y+=8
  })

  if(y+18>194){
    doc.addPage()
    header(doc,data,true)
    y=39
  }

  doc.setFillColor(...paleBlue)
  doc.roundedRect(177,y+4,108,14,3,3,'F')
  doc.setFont('helvetica','bold')
  doc.setFontSize(8)
  doc.setTextColor(...darkBlue)
  doc.text('TOTAL RECEBIDO',181,y+10)
  doc.text(money(totalReceived),230,y+10,{align:'right'})
  doc.text('COMISSÃO',236,y+10)
  doc.setTextColor(...blue)
  doc.text(money(totalCommission),281,y+10,{align:'right'})

  addFooter(doc,data)
  doc.save(`relatorio-comissoes-${data.vendedorFiltro?safe(data.vendedorFiltro)+'-':''}${safe(data.inicio)}-a-${safe(data.fim)}.pdf`)
}
