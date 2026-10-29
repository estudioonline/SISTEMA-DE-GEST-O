import { jsPDF } from 'jspdf'

export type InvoiceCustomer = {
  id?: string
  nome: string
  documento?: string | null
  email?: string | null
  telefone?: string | null
}

export type InvoiceItem = {
  codigo?: string
  descricao: string
  unidade: string
  quantidade: number
  valor_unitario: number
  desconto: number
  total: number
}

export type InvoiceCompany = {
  razao_social?: string | null
  nome_fantasia?: string | null
  cnpj?: string | null
  email?: string | null
  telefone?: string | null
  endereco?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  pix_chave?: string | null
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  condicoes_gerais?: string | null
}

export type InvoiceData = {
  id: string
  venda_numero?: number | null
  fatura_numero?: number | null
  created_at: string
  status: string
  subtotal: number
  desconto: number
  total: number
  observacoes?: string | null
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao' | 'boleto'
  parcelas: number
  primeiro_vencimento: string
  rota_entrega?: string | null
  vendedor_nome?: string | null
  cliente?: InvoiceCustomer | null
  company?: InvoiceCompany
  items: InvoiceItem[]
}

const COMPANY = {
  nome: 'SUA EMPRESA',
  endereco: 'Endereço da sua empresa',
  cidade: 'Cidade - UF',
  cep: 'CEP',
  cnpj: '00.000.000/0000-00',
  email: 'contato@suaempresa.com.br',
}

const CONDITIONS = [
  '01) As peças aplicadas terão garantia de 90 dias conforme o fabricante, desde que não seja mal utilizada.',
  '02) Mão de obra de troca de peças, garantia de 90 dias, desde que não esteja desconfigurada por mal uso.',
  '03) É necessario a apresentaçao da Ordem de serviço para retirada do produto ou Garantia.',
  '04) Nao aceitamos devoluçao do produto.',
  '05) Nosso atendimento é de 08:00 as 18:00 de segunda a sexta-feira, e de 08:00 as 12:00 aos sábados.',
  '06) Os produtos não retirados pelo cliente no periodo de 60 dias. Serão vendidos para cobrir as despesas.',
  '07) É obrigatório verificar se os itens entregues pelo estoque correspondem aos itens no pedido. Reclamações posteriores não serão aceitas.',
  '08) Pagamento a prazo estará sujeito às condições financeiras informadas na venda caso não seja feito o pagamento na data combinada.',
  '09) Pedidos com produção poderão ter condições específicas de sinal, cancelamento e custos de produção conforme combinado.',
]

const blue:[number,number,number]=[34,99,190]
const darkBlue:[number,number,number]=[24,52,86]
const paleBlue:[number,number,number]=[244,248,254]
const paleRow:[number,number,number]=[246,248,251]
const text:[number,number,number]=[31,41,55]
const muted:[number,number,number]=[102,112,128]
const line:[number,number,number]=[196,205,218]

const brl=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value||0)
const num=(value:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value||0)
const invoiceNo=(value:number|null|undefined)=>String(value||0).padStart(7,'0')
const paymentLabel=(value:InvoiceData['forma_pagamento'])=>value==='dinheiro'?'DINHEIRO':value==='pix'?'PIX':value==='cartao'?'CARTÃO':'BOLETO'
const statusLabel=(value:string)=>value ? value.toUpperCase() : '-'
const deliveryRouteLabel=(value:string|null|undefined)=>value==='norte'?'NORTE':value==='sul'?'SUL':value==='leste'?'LESTE':value==='interestadual'?'INTERESTADUAL':value==='retirada'?'RETIRADA':'-'
const safeFilePart=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase().slice(0,60)||'cliente'

function asDate(value:string){
  if(!value)return null
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
    const [y,m,d]=value.split('-').map(Number)
    return new Date(y,m-1,d,12,0,0)
  }
  const parsed=new Date(value)
  return Number.isNaN(parsed.getTime())?null:parsed
}

function date(value:string){
  const d=asDate(value)
  return d?new Intl.DateTimeFormat('pt-BR').format(d):'-'
}

function dateTime(value:string){
  const d=asDate(value)
  return d?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d):'-'
}

function companyData(data:InvoiceData){
  return {
    nome:data.company?.nome_fantasia||data.company?.razao_social||COMPANY.nome,
    razao:data.company?.razao_social||'',
    endereco:data.company?.endereco||COMPANY.endereco,
    cidade:[data.company?.cidade,data.company?.uf].filter(Boolean).join(' ')||COMPANY.cidade,
    cep:data.company?.cep||COMPANY.cep,
    cnpj:data.company?.cnpj||COMPANY.cnpj,
    email:data.company?.email||COMPANY.email,
    telefone:data.company?.telefone||'',
  }
}

function drawBrandHeader(doc:jsPDF,data:InvoiceData){
  const company=companyData(data)

  const headerBottom=56
  const brandLeft=12
  const companyRight=196
  const companyBlockWidth=78

  doc.setFillColor(...paleBlue)
  doc.rect(0,0,210,headerBottom,'F')
  doc.setFillColor(255,255,255)
  doc.triangle(126,headerBottom,145,44,145,headerBottom,'F')

  // Marca: ocupa somente o bloco esquerdo.
  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(21)
  const brandLines=doc.splitTextToSize(company.nome,88) as string[]
  doc.text(brandLines.slice(0,2),brandLeft,16,{lineHeightFactor:1.05})

  const brandSubtitleY=brandLines.length>1?29:23
  doc.setTextColor(...blue)
  doc.setFontSize(7.5)
  doc.setCharSpace(1.5)
  doc.text('SISTEMA DE GESTÃO',brandLeft,brandSubtitleY)
  doc.setCharSpace(0)

  // Dados da empresa: bloco direito com largura limitada e quebra automática.
  // Isso evita que endereços longos atravessem o logo ou sejam cortados.
  let ry=9
  const drawRightBlock=(value:string,options?:{bold?:boolean;size?:number;gap?:number})=>{
    if(!value)return
    doc.setFont('helvetica',options?.bold?'bold':'normal')
    doc.setFontSize(options?.size??7.2)
    const lines=doc.splitTextToSize(value,companyBlockWidth) as string[]
    lines.forEach(lineText=>{
      doc.text(lineText,companyRight,ry,{align:'right'})
      ry+=3.8
    })
    ry+=options?.gap??0.8
  }

  const legalName=company.razao&&company.razao!==company.nome?company.razao:company.nome
  drawRightBlock(legalName,{bold:true,size:7.3,gap:1})
  drawRightBlock(company.endereco,{size:7.1,gap:0.7})

  const locality=[company.cidade,company.cep].filter(Boolean).join(' - ')
  drawRightBlock(locality,{size:7.1,gap:0.4})
  drawRightBlock('Brasil',{size:7.1,gap:0})

  doc.setTextColor(...blue)
  doc.setFont('helvetica','normal')
  doc.setFontSize(18)
  doc.text(`Pedido nº ${invoiceNo(data.venda_numero)}`,196,52,{align:'right'})
}

function drawCustomer(doc:jsPDF,data:InvoiceData){
  const c=data.cliente
  doc.setTextColor(...text)
  doc.setFont('helvetica','bold')
  doc.setFontSize(9.5)
  doc.text(c?.nome||'CONSUMIDOR',12,66)

  doc.setFont('helvetica','normal')
  doc.setFontSize(8.2)
  let y=72
  const lines=[
    c?.email||'',
    c?.telefone||'',
    c?.documento?`CPF/CNPJ: ${c.documento}`:'',
  ].filter(Boolean)

  lines.forEach(v=>{doc.text(v,12,y);y+=5})
  return Math.max(89,y+4)
}

function drawOrderInfo(doc:jsPDF,data:InvoiceData,y:number){
  const leftX=12
  const sellerX=105

  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.7)
  doc.text('Data do pedido',leftX,y)
  doc.text('Vendedor',sellerX,y)

  doc.setTextColor(...text)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.2)
  doc.text(dateTime(data.created_at),leftX,y+5)
  doc.text(data.vendedor_nome||'Equipe de vendas',sellerX,y+5)

  doc.setFont('helvetica','bold')
  doc.text(`Status: ${statusLabel(data.status)}`,leftX,y+13)
  doc.text(`Rota de entrega: ${deliveryRouteLabel(data.rota_entrega)}`,sellerX,y+13)
  doc.text(`Método de pagamento combinado: ${paymentLabel(data.forma_pagamento)}${data.parcelas>1?` - ${data.parcelas}x`:''}`,leftX,y+19)
  doc.text(`Data de vencimento: ${date(data.primeiro_vencimento)}`,leftX,y+25)

  return y+34
}

function drawTableHeader(doc:jsPDF,y:number){
  doc.setTextColor(...text)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.2)
  doc.text('Descrição',14,y)
  doc.text('Quantidade',130,y,{align:'right'})
  doc.text('Preço unitário',166,y,{align:'right'})
  doc.text('Valor',196,y,{align:'right'})
  doc.setDrawColor(...line)
  doc.setLineWidth(0.3)
  doc.line(12,y+2,196,y+2)
  return y+3
}

function drawContinuationHeader(doc:jsPDF,data:InvoiceData){
  doc.setFillColor(...paleBlue)
  doc.rect(0,0,210,24,'F')
  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(11)
  doc.text(companyData(data).nome,12,10)
  doc.setTextColor(...blue)
  doc.setFont('helvetica','normal')
  doc.setFontSize(12)
  doc.text(`Pedido nº ${invoiceNo(data.venda_numero)} - continuação`,196,16,{align:'right'})
}

function drawItems(doc:jsPDF,data:InvoiceData,startY:number){
  let y=drawTableHeader(doc,startY)

  data.items.forEach((item,index)=>{
    const description=`${item.codigo?`${item.codigo} - `:''}${item.descricao}`
    const lines=doc.splitTextToSize(description,104) as string[]
    const rowH=Math.max(7,lines.length*4.1+2)

    if(y+rowH>248){
      doc.addPage()
      drawContinuationHeader(doc,data)
      y=drawTableHeader(doc,34)
    }

    if(index%2===0){
      doc.setFillColor(...paleRow)
      doc.rect(12,y-1,184,rowH,'F')
    }

    doc.setTextColor(...text)
    doc.setFont('helvetica','normal')
    doc.setFontSize(8.1)
    doc.text(lines,14,y+4.3)
    doc.text(`${num(item.quantidade)} ${item.unidade}`,130,y+4.3,{align:'right'})
    doc.text(brl(item.valor_unitario),166,y+4.3,{align:'right'})
    doc.text(brl(item.total),196,y+4.3,{align:'right'})

    if(item.desconto>0){
      doc.setFontSize(6.7)
      doc.setTextColor(...muted)
      doc.text(`Desconto: ${brl(item.desconto)}`,14,y+rowH-1.5)
    }

    doc.setDrawColor(225,230,237)
    doc.setLineWidth(0.2)
    doc.line(12,y+rowH-1,196,y+rowH-1)
    y+=rowH
  })

  if(y+9>250){
    doc.addPage()
    drawContinuationHeader(doc,data)
    y=drawTableHeader(doc,34)
  }

  doc.setFillColor(242,244,248)
  doc.rect(105,y,91,7,'F')
  doc.setTextColor(...blue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.5)
  doc.text('Total',130,y+4.8,{align:'right'})
  doc.text(brl(data.total),196,y+4.8,{align:'right'})

  if(data.desconto>0){
    doc.setFont('helvetica','normal')
    doc.setTextColor(...muted)
    doc.setFontSize(6.7)
    doc.text(`Subtotal ${brl(data.subtotal)} | Desconto ${brl(data.desconto)}`,196,y+10,{align:'right'})
    return y+14
  }

  return y+11
}

function ensureSpace(doc:jsPDF,data:InvoiceData,y:number,needed:number){
  if(y+needed<=274)return y
  doc.addPage()
  drawContinuationHeader(doc,data)
  return 34
}

function drawNotesAndConditions(doc:jsPDF,data:InvoiceData,startY:number){
  let y=startY
  const notes=(data.observacoes||'').trim()

  y=ensureSpace(doc,data,y,18)
  doc.setTextColor(...text)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.3)
  doc.text('Anotações:',12,y)
  y+=6

  if(notes){
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.5)
    const noteLines=doc.splitTextToSize(notes,184) as string[]
    if(y+noteLines.length*4.1>272){
      doc.addPage()
      drawContinuationHeader(doc,data)
      y=34
    }
    doc.text(noteLines,12,y)
    y+=noteLines.length*4.1+4
  }else{
    y+=4
  }

  y=ensureSpace(doc,data,y,22)
  doc.setFont('helvetica','bold')
  doc.setTextColor(...text)
  doc.setFontSize(8.3)
  doc.text('Condições Gerais:',12,y)
  y+=5

  const conditions=data.company?.condicoes_gerais?.trim()
    ? data.company.condicoes_gerais.split('\n').map(v=>v.trim()).filter(Boolean)
    : CONDITIONS

  doc.setFont('helvetica','normal')
  doc.setFontSize(6.9)
  doc.setTextColor(...text)

  for(const condition of conditions){
    const lines=doc.splitTextToSize(condition,184) as string[]
    const h=lines.length*3.5+0.8
    if(y+h>272){
      doc.addPage()
      drawContinuationHeader(doc,data)
      y=34
      doc.setFont('helvetica','normal')
      doc.setFontSize(6.9)
      doc.setTextColor(...text)
    }
    doc.text(lines,12,y)
    y+=h
  }

  const declaration='Declaro estar ciente das condições acima mencionadas.'
  if(y+7>272){
    doc.addPage()
    drawContinuationHeader(doc,data)
    y=34
  }
  doc.setFont('helvetica','normal')
  doc.setFontSize(7.2)
  doc.text(declaration,12,y+3)
}

function addFooters(doc:jsPDF,data:InvoiceData){
  const company=companyData(data)
  const pages=doc.getNumberOfPages()
  for(let page=1;page<=pages;page++){
    doc.setPage(page)
    doc.setDrawColor(...darkBlue)
    doc.setLineWidth(0.35)
    doc.line(12,282,196,282)

    doc.setTextColor(...text)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.2)
    const left=[company.email,company.cnpj].filter(Boolean).join('   ')
    doc.text(left,12,289)
    doc.setTextColor(...muted)
    doc.text(`Página ${page}/${pages}`,196,289,{align:'right'})
  }
}

function buildInvoiceDocument(data:InvoiceData){
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  doc.setProperties({
    title:`Pedido ${invoiceNo(data.venda_numero)}`,
    subject:'Pedido / venda',
    author:data.company?.nome_fantasia||data.company?.razao_social||COMPANY.nome,
  })

  drawBrandHeader(doc,data)
  let y=drawCustomer(doc,data)
  y=drawOrderInfo(doc,data,y)
  y=drawItems(doc,data,y)
  drawNotesAndConditions(doc,data,y+5)
  addFooters(doc,data)
  return doc
}

export function generateInvoicePdf(data:InvoiceData){
  const doc=buildInvoiceDocument(data)
  doc.save(`${safeFilePart(data.cliente?.nome||'consumidor')}-${invoiceNo(data.venda_numero)}.pdf`)
}

export function openInvoicePdfForPrint(data:InvoiceData){
  const doc=buildInvoiceDocument(data)
  const url=doc.output('bloburl')
  window.open(String(url),'_blank','noopener,noreferrer')
}
