import { jsPDF } from 'jspdf'
import type { InvoiceCompany } from './invoicePdf'

export type PurchaseSupplier = {
  nome: string
  documento?: string | null
  email?: string | null
  telefone?: string | null
}

export type PurchasePdfItem = {
  codigo?: string
  descricao: string
  unidade: string
  quantidade: number
  custo_unitario: number
  total: number
}

export type PurchasePdfData = {
  id: string
  fatura_numero?: number | null
  created_at: string
  status: string
  total: number
  observacoes?: string | null
  forma_pagamento: 'pix' | 'cartao' | 'boleto'
  parcelas: number
  primeiro_vencimento: string
  vencimentos_parcelas?: string[]
  fornecedor?: PurchaseSupplier | null
  company?: InvoiceCompany
  items: PurchasePdfItem[]
}

const blue:[number,number,number]=[34,99,190]
const darkBlue:[number,number,number]=[24,52,86]
const paleBlue:[number,number,number]=[244,248,254]
const paleRow:[number,number,number]=[246,248,251]
const text:[number,number,number]=[31,41,55]
const muted:[number,number,number]=[102,112,128]
const line:[number,number,number]=[196,205,218]

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const num=(v:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0)
const invoiceNo=(n:number|null|undefined)=>String(n||0).padStart(7,'0')
const paymentLabel=(v:PurchasePdfData['forma_pagamento'])=>v==='pix'?'PIX':v==='cartao'?'CARTÃO':'BOLETO'

function parseDate(value:string){
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
    const [y,m,d]=value.split('-').map(Number)
    return new Date(y,m-1,d,12)
  }
  return new Date(value)
}
function date(value:string){const d=parseDate(value);return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('pt-BR').format(d)}
function dateTime(value:string){const d=parseDate(value);return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d)}
function addMonths(value:string,months:number){const d=parseDate(value);d.setMonth(d.getMonth()+months);return d}

function companyName(data:PurchasePdfData){
  return data.company?.nome_fantasia||data.company?.razao_social||'SUA EMPRESA'
}

function drawHeader(doc:jsPDF,data:PurchasePdfData){
  doc.setFillColor(...paleBlue)
  doc.rect(0,0,210,49,'F')
  doc.setFillColor(255,255,255)
  doc.triangle(126,49,145,38,145,49,'F')

  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(21)
  doc.text(companyName(data),12,17)

  doc.setTextColor(...blue)
  doc.setFontSize(7.5)
  doc.setCharSpace(1.3)
  doc.text('CONTAS A PAGAR',12,23)
  doc.setCharSpace(0)

  const rightX=196
  const lines=[
    data.company?.razao_social&&data.company.razao_social!==companyName(data)?data.company.razao_social:'',
    data.company?.endereco||'',
    [data.company?.cidade,data.company?.uf].filter(Boolean).join(' - '),
    data.company?.cep||'',
    'Brasil'
  ].filter(Boolean)

  doc.setTextColor(...text)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.2)
  let y=12
  lines.slice(0,5).forEach(v=>{doc.text(v,rightX,y,{align:'right'});y+=5.2})

  doc.setTextColor(...blue)
  doc.setFontSize(18)
  doc.text(`Compra nº ${invoiceNo(data.fatura_numero)}`,196,45,{align:'right'})
}

function drawSupplier(doc:jsPDF,data:PurchasePdfData){
  doc.setTextColor(...text)
  doc.setFont('helvetica','bold')
  doc.setFontSize(9.5)
  doc.text(data.fornecedor?.nome||'FORNECEDOR NÃO INFORMADO',12,61)

  doc.setFont('helvetica','normal')
  doc.setFontSize(8.1)
  let y=67
  const lines=[
    data.fornecedor?.documento?`CPF/CNPJ: ${data.fornecedor.documento}`:'',
    data.fornecedor?.email||'',
    data.fornecedor?.telefone||''
  ].filter(Boolean)
  lines.forEach(v=>{doc.text(v,12,y);y+=5})
  return Math.max(82,y+4)
}

function drawInfo(doc:jsPDF,data:PurchasePdfData,y:number){
  doc.setFont('helvetica','bold')
  doc.setTextColor(...darkBlue)
  doc.setFontSize(8.6)
  doc.text('Data da compra',12,y)
  doc.text('Forma de pagamento',105,y)

  doc.setFont('helvetica','normal')
  doc.setTextColor(...text)
  doc.setFontSize(8.2)
  doc.text(dateTime(data.created_at),12,y+5)
  doc.text(`${paymentLabel(data.forma_pagamento)}${data.parcelas>1?` - ${data.parcelas}x`:''}`,105,y+5)

  doc.setFont('helvetica','bold')
  doc.text(`Status: ${data.status.toUpperCase()}`,12,y+13)
  doc.text(`Primeiro vencimento: ${date(data.vencimentos_parcelas?.[0]||data.primeiro_vencimento)}`,12,y+19)

  return y+29
}

function drawTableHeader(doc:jsPDF,y:number){
  doc.setTextColor(...text)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.2)
  doc.text('Descrição',14,y)
  doc.text('Quantidade',130,y,{align:'right'})
  doc.text('Custo unitário',166,y,{align:'right'})
  doc.text('Valor',196,y,{align:'right'})
  doc.setDrawColor(...line)
  doc.setLineWidth(.3)
  doc.line(12,y+2,196,y+2)
  return y+3
}

function drawContinuationHeader(doc:jsPDF,data:PurchasePdfData){
  doc.setFillColor(...paleBlue)
  doc.rect(0,0,210,24,'F')
  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(11)
  doc.text(companyName(data),12,10)
  doc.setTextColor(...blue)
  doc.setFont('helvetica','normal')
  doc.setFontSize(12)
  doc.text(`Compra nº ${invoiceNo(data.fatura_numero)} - continuação`,196,16,{align:'right'})
}

function drawItems(doc:jsPDF,data:PurchasePdfData,startY:number){
  let y=drawTableHeader(doc,startY)
  data.items.forEach((item,index)=>{
    const description=`${item.codigo?`${item.codigo} - `:''}${item.descricao}`
    const lines=doc.splitTextToSize(description,104) as string[]
    const rowH=Math.max(7,lines.length*4.1+2)

    if(y+rowH>240){
      doc.addPage()
      drawContinuationHeader(doc,data)
      y=drawTableHeader(doc,34)
    }

    if(index%2===0){doc.setFillColor(...paleRow);doc.rect(12,y-1,184,rowH,'F')}

    doc.setTextColor(...text)
    doc.setFont('helvetica','normal')
    doc.setFontSize(8.1)
    doc.text(lines,14,y+4.3)
    doc.text(`${num(item.quantidade)} ${item.unidade}`,130,y+4.3,{align:'right'})
    doc.text(money(item.custo_unitario),166,y+4.3,{align:'right'})
    doc.text(money(item.total),196,y+4.3,{align:'right'})

    doc.setDrawColor(225,230,237)
    doc.setLineWidth(.2)
    doc.line(12,y+rowH-1,196,y+rowH-1)
    y+=rowH
  })

  doc.setFillColor(242,244,248)
  doc.rect(105,y,91,7,'F')
  doc.setTextColor(...blue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.5)
  doc.text('Total a pagar',145,y+4.8,{align:'right'})
  doc.text(money(data.total),196,y+4.8,{align:'right'})
  return y+13
}

function installmentValue(total:number,installments:number,index:number){
  const base=Math.floor((total/installments)*100)/100
  return index===installments-1 ? total-(base*(installments-1)) : base
}

function drawSchedule(doc:jsPDF,data:PurchasePdfData,startY:number){
  let y=startY
  const needed=12+(data.parcelas*6)
  if(y+needed>272){
    doc.addPage()
    drawContinuationHeader(doc,data)
    y=34
  }

  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.5)
  doc.text('Parcelas / vencimentos',12,y)
  y+=6

  doc.setFont('helvetica','normal')
  doc.setFontSize(7.7)
  for(let i=0;i<data.parcelas;i++){
    const customDue=data.vencimentos_parcelas?.[i]
    const due=customDue?parseDate(customDue):addMonths(data.primeiro_vencimento,i)
    const dueText=new Intl.DateTimeFormat('pt-BR').format(due)
    const value=installmentValue(data.total,data.parcelas,i)

    if(y+6>274){
      doc.addPage()
      drawContinuationHeader(doc,data)
      y=34
    }

    if(i%2===0){doc.setFillColor(...paleRow);doc.rect(12,y-3.8,184,6,'F')}
    doc.setTextColor(...text)
    doc.text(`Parcela ${i+1}/${data.parcelas}`,14,y)
    doc.text(dueText,112,y,{align:'right'})
    doc.text(paymentLabel(data.forma_pagamento),150,y,{align:'right'})
    doc.text(money(value),196,y,{align:'right'})
    y+=6
  }

  return y+5
}

function drawNotes(doc:jsPDF,data:PurchasePdfData,startY:number){
  let y=startY
  if(y+18>274){doc.addPage();drawContinuationHeader(doc,data);y=34}
  doc.setTextColor(...text)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.3)
  doc.text('Anotações:',12,y)
  y+=6

  const notes=(data.observacoes||'Sem observações.').trim()
  const lines=doc.splitTextToSize(notes,184) as string[]
  doc.setFont('helvetica','normal')
  doc.setFontSize(7.4)
  doc.text(lines,12,y)
}

function addFooters(doc:jsPDF,data:PurchasePdfData){
  const pages=doc.getNumberOfPages()
  for(let p=1;p<=pages;p++){
    doc.setPage(p)
    doc.setDrawColor(...darkBlue)
    doc.setLineWidth(.35)
    doc.line(12,282,196,282)
    doc.setTextColor(...text)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.1)
    const left=[data.company?.email||'',data.company?.cnpj||''].filter(Boolean).join('   ')
    doc.text(left,12,289)
    doc.setTextColor(...muted)
    doc.text(`Página ${p}/${pages}`,196,289,{align:'right'})
  }
}

export function generatePurchaseInvoicePdf(data:PurchasePdfData){
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  doc.setProperties({
    title:`Compra ${invoiceNo(data.fatura_numero)}`,
    subject:'Fatura de compra a pagar',
    author:companyName(data)
  })

  drawHeader(doc,data)
  let y=drawSupplier(doc,data)
  y=drawInfo(doc,data,y)
  y=drawItems(doc,data,y)
  y=drawSchedule(doc,data,y)
  drawNotes(doc,data,y)
  addFooters(doc,data)

  doc.save(`compra-a-pagar-${invoiceNo(data.fatura_numero)}.pdf`)
}
