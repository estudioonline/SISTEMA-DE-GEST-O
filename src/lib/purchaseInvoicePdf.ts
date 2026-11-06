import { purchaseCode } from './purchaseCode'
import { financialInvoiceCode } from './invoiceCode'
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
const paymentLabel=(v:PurchasePdfData['forma_pagamento'])=>v==='pix'?'PIX':v==='cartao'?'CARTÃO':'BOLETO'
const safeFilePart=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase().slice(0,60)||'fornecedor'

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
  const leftWidth=94
  const rightWidth=78
  doc.setFont('helvetica','bold')
  doc.setFontSize(17)
  const companyLines=doc.splitTextToSize(companyName(data),leftWidth) as string[]
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.2)
  const addressLines=[
    data.company?.razao_social&&data.company.razao_social!==companyName(data)?data.company.razao_social:'',
    data.company?.endereco||'',
    [data.company?.cidade,data.company?.uf].filter(Boolean).join(' - '),
    data.company?.cep||'',
    'Brasil'
  ].filter(Boolean).flatMap(value=>doc.splitTextToSize(value,rightWidth) as string[])
  const height=Math.max(54,18+companyLines.length*6.5,16+addressLines.length*4)
  doc.setFillColor(...paleBlue)
  doc.rect(0,0,210,height,'F')
  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(17)
  doc.text(companyLines,12,16)
  doc.setTextColor(...blue)
  doc.setFontSize(8.5)
  doc.text('CONTAS A PAGAR',12,20+companyLines.length*6.5)
  doc.setTextColor(...text)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.2)
  addressLines.forEach((value,index)=>doc.text(value,196,12+index*4,{align:'right'}))
  return height
}

function drawSupplier(doc:jsPDF,data:PurchasePdfData,startY:number){
  const y=startY+10
  doc.setTextColor(...blue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(14)
  doc.text('Compra '+purchaseCode(data.fatura_numero),12,y)
  const quote=data.status.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()==='cotacao'
  if(!quote){
    doc.setFontSize(10)
    doc.text('Fatura '+financialInvoiceCode(data.fatura_numero),196,y,{align:'right'})
  }
  doc.setTextColor(...muted)
  doc.setFontSize(8)
  doc.text('FORNECEDOR',12,y+10)
  doc.setTextColor(...text)
  doc.setFont('helvetica','bold')
  doc.setFontSize(10.5)
  const nameLines=doc.splitTextToSize(data.fornecedor?.nome||'FORNECEDOR NÃO INFORMADO',184) as string[]
  doc.text(nameLines,12,y+16)
  let nextY=y+16+nameLines.length*4.5
  doc.setFont('helvetica','normal')
  doc.setFontSize(9)
  const document=data.fornecedor?.documento||''
  const digits=document.replace(/\D/g,'')
  const formattedDocument=digits.length===14?digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):document
  const details=[formattedDocument?'CPF/CNPJ: '+formattedDocument:'',data.fornecedor?.email||'',data.fornecedor?.telefone||''].filter(Boolean)
  details.forEach(value=>{
    const lines=doc.splitTextToSize(value,184) as string[]
    doc.text(lines,12,nextY)
    nextY+=lines.length*4.5
  })
  return nextY+10
}

function drawInfo(doc:jsPDF,data:PurchasePdfData,y:number){
  doc.setFont('helvetica','bold')
  doc.setTextColor(...darkBlue)
  doc.setFontSize(9.6)
  doc.text('Data da compra',12,y)
  doc.text('Forma de pagamento',105,y)

  doc.setFont('helvetica','normal')
  doc.setTextColor(...text)
  doc.setFontSize(9.2)
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
  doc.setFontSize(9.2)
  doc.text('Descrição',14,y)
  doc.text('Quantidade',136,y,{align:'right'})
  doc.text('Custo unitário',166,y,{align:'right'})
  doc.text('Valor',194,y,{align:'right'})
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
  doc.setFontSize(12)
  doc.text(doc.splitTextToSize(companyName(data),110) as string[],12,10)
  doc.setTextColor(...blue)
  doc.setFont('helvetica','normal')
  doc.setFontSize(13)
  doc.text(`Compra nº ${purchaseCode(data.fatura_numero)} - continuação`,196,16,{align:'right'})
}

function fitSingleLine(doc:jsPDF,value:string,maxWidth:number,fontSize:number,minFontSize=6.2){
  let size=fontSize
  doc.setFontSize(size)
  while(doc.getTextWidth(value)>maxWidth&&size>minFontSize){
    size=Math.max(minFontSize,size-.2)
    doc.setFontSize(size)
  }
  if(doc.getTextWidth(value)<=maxWidth)return {text:value,size}
  let text=value
  while(text.length>1&&doc.getTextWidth(text+'…')>maxWidth)text=text.slice(0,-1)
  return {text:text+'…',size}
}

function drawItems(doc:jsPDF,data:PurchasePdfData,startY:number){
  let y=drawTableHeader(doc,startY)
  const rowH=12
  data.items.forEach((item,index)=>{
    if(y+rowH>254){
      doc.addPage()
      drawContinuationHeader(doc,data)
      y=drawTableHeader(doc,34)
    }
    if(index%2===0){doc.setFillColor(...paleRow);doc.rect(12,y-1,184,rowH,'F')}

    const description=fitSingleLine(doc,item.descricao,104,9.1)
    doc.setFont('helvetica','normal')
    doc.setFontSize(description.size)
    doc.setTextColor(...text)
    const descriptionY=item.codigo?y+8.2:y+7

    if(item.codigo){
      const code=fitSingleLine(doc,item.codigo,104,7.2,6)
      doc.setFontSize(code.size)
      doc.setTextColor(...muted)
      doc.text(code.text,14,y+3.6)
    }
    doc.setFontSize(description.size)
    doc.setTextColor(...text)
    doc.text(description.text,14,descriptionY)

    doc.setFontSize(8.7)
    doc.text(num(item.quantidade)+' '+item.unidade,136,y+7,{align:'right'})
    doc.text(money(item.custo_unitario),166,y+7,{align:'right'})
    doc.text(money(item.total),194,y+7,{align:'right'})
    doc.setDrawColor(225,230,237)
    doc.setLineWidth(.2)
    doc.line(12,y+rowH-1,196,y+rowH-1)
    y+=rowH
  })
  if(y+10>272){doc.addPage();drawContinuationHeader(doc,data);y=34}
  doc.setFillColor(...paleBlue)
  doc.rect(105,y,91,9,'F')
  doc.setTextColor(...blue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(10)
  doc.text('Total a pagar',145,y+6,{align:'right'})
  doc.text(money(data.total),194,y+6,{align:'right'})
  return y+17
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
  doc.setFontSize(9.5)
  doc.text('Parcelas / vencimentos',12,y)
  y+=6

  doc.setFont('helvetica','normal')
  doc.setFontSize(8.7)
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
  doc.setFontSize(9.3)
  doc.text('Anotações:',12,y)
  y+=6

  const notes=(data.observacoes||'Sem observações.').trim()
  const lines=doc.splitTextToSize(notes,184) as string[]
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.4)
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
    doc.setFontSize(8.1)
    const left=[data.company?.email||'',data.company?.cnpj||''].filter(Boolean).join('   ')
    doc.text(left,12,289)
    doc.setTextColor(...muted)
    doc.text(`Página ${p}/${pages}`,196,289,{align:'right'})
  }
}

export function createPurchaseInvoicePdf(data:PurchasePdfData){
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  doc.setProperties({
    title:`Compra ${purchaseCode(data.fatura_numero)}`,
    subject:'Fatura de compra a pagar',
    author:companyName(data)
  })

  const headerHeight=drawHeader(doc,data)
  let y=drawSupplier(doc,data,headerHeight)
  y=drawInfo(doc,data,y)
  y=drawItems(doc,data,y)
  y=drawSchedule(doc,data,y)
  drawNotes(doc,data,y)
  addFooters(doc,data)

  return doc
}

export function generatePurchaseInvoicePdf(data:PurchasePdfData){
  createPurchaseInvoicePdf(data).save(`${safeFilePart(data.fornecedor?.nome||'sem-fornecedor')}-${purchaseCode(data.fatura_numero)}.pdf`)
}
