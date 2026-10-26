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

export type InvoiceData = {
  id: string
  created_at: string
  status: string
  subtotal: number
  desconto: number
  total: number
  observacoes?: string | null
  cliente?: InvoiceCustomer | null
  items: InvoiceItem[]
}

const COMPANY = {
  nome: 'SUA EMPRESA',
  slogan: 'SEU SLOGAN OU RAMO DE ATIVIDADE',
  endereco1: 'Endereço da sua empresa, Número',
  endereco2: 'Bairro / Complemento',
  cidade: 'Cidade - UF | CEP | Brasil',
  cnpj: '00.000.000/0000-00',
  email: 'contato@suaempresa.com.br',
  pagamento1: 'Ag: 0000 | CC: 00000-0 - Banco',
  pagamento2: 'Exemplo',
}

const CONDITIONS = [
  '01) As peças aplicadas terão garantia de 90 dias conforme o fabricante, desde que não seja mal utilizada.',
  '02) Mão de obra de troca de peças, garantia de 90 dias, desde que não esteja desconfigurada por mal uso.',
  '03) É necessario a apresentaçao da Ordem de serviço para retirada do produto ou Garantia.',
  '04) Nao aceitamos devoluçao do produto.',
  '05) Nosso atendimento é de 08:00 as 18:00 de segunda a sexta-feira, e de 08:00 as 12:00 aos sábados.',
  '06) Os produtos não retirados pelo cliente no periodo de 60 dias. Serão Vendidos para cobrir as despesas.',
  '07) É obrigatório verificar se os itens entregues pelo estoque correspondem aos itens no pedido. Reclamações posteriores nao seram aceitas.',
  '08) Pagamento a prazo estarão sujeitos a multa de 4% e juros de 8% ao mês caso não seja feito o pagamento na data combinada. Sujeito a protesto.',
  '09) Pedidos com produção devem obrigatoriamente serem pagos 50% do valor. Caso haja o cancelamento do mesmo o valor não será devolvido para cobrir os custos da produção.',
]

const darkBlue:[number,number,number]=[37,65,145]
const brightBlue:[number,number,number]=[50,126,255]
const lightBlue:[number,number,number]=[241,246,255]
const textColor:[number,number,number]=[38,52,78]
const borderColor:[number,number,number]=[211,222,241]

const brl=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value||0)
const num=(value:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value||0)
const date=(value:string)=>new Intl.DateTimeFormat('pt-BR').format(new Date(value))
const shortId=(value:string)=>value.replace(/-/g,'').slice(0,8).toUpperCase()

function drawFirstHeader(doc:jsPDF,data:InvoiceData){
  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(19)
  doc.text(COMPANY.nome,18,19)

  doc.setTextColor(...brightBlue)
  doc.setFontSize(9)
  doc.text(COMPANY.slogan,18,25)

  doc.setTextColor(...textColor)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.5)
  doc.text(COMPANY.endereco1,18,32)
  doc.text(COMPANY.endereco2,18,37)
  doc.text(COMPANY.cidade,18,42)
  doc.text(`CNPJ: ${COMPANY.cnpj}`,18,47)
  doc.text(COMPANY.email,18,52)

  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(22)
  doc.text('Fatura',192,20,{align:'right'})
  doc.setFontSize(10)
  doc.setTextColor(...textColor)
  doc.text(`Venda ${shortId(data.id)}`,192,30,{align:'right'})

  doc.setDrawColor(...darkBlue)
  doc.setLineWidth(1.2)
  doc.line(18,58,192,58)

  doc.setFillColor(...lightBlue)
  doc.setDrawColor(...borderColor)
  doc.roundedRect(18,66,102,45,1.5,1.5,'FD')
  doc.setDrawColor(...brightBlue)
  doc.setLineWidth(1)
  doc.line(18,66,120,66)

  doc.setTextColor(...textColor)
  doc.setFont('helvetica','bold')
  doc.setFontSize(9)
  doc.text('FATURADO PARA:',22,76)

  doc.setFontSize(10)
  doc.text(data.cliente?.nome || 'CONSUMIDOR',22,85)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.5)
  let cy=92
  const clientLines=[
    data.cliente?.documento ? `CPF/CNPJ: ${data.cliente.documento}` : '',
    data.cliente?.email ? `E-mail: ${data.cliente.email}` : '',
    data.cliente?.telefone ? `Telefone: ${data.cliente.telefone}` : '',
  ].filter(Boolean)
  clientLines.slice(0,3).forEach(line=>{doc.text(line,22,cy);cy+=5})

  const infoX=126
  const infoY=66
  const infoW=66
  const rowH=9
  const labelW=34
  const rows:Array<[string,string]>=[
    ['Data da fatura',date(data.created_at)],
    ['Data de vencimento','A combinar'],
    ['Origem','Venda'],
    ['Código do cliente',data.cliente?.id ? shortId(data.cliente.id) : '-'],
    ['Referência',shortId(data.id)],
  ]

  rows.forEach((row,index)=>{
    const y=infoY+(index*rowH)
    doc.setFillColor(...lightBlue)
    doc.setDrawColor(...borderColor)
    doc.rect(infoX,y,labelW,rowH,'FD')
    doc.rect(infoX+labelW,y,infoW-labelW,rowH,'S')
    doc.setFont('helvetica','bold')
    doc.setFontSize(7.7)
    doc.setTextColor(...darkBlue)
    doc.text(row[0],infoX+2.5,y+5.8)
    doc.setFont('helvetica','normal')
    doc.setTextColor(...textColor)
    doc.text(row[1],infoX+labelW+2.5,y+5.8)
  })
}

function drawContinuationHeader(doc:jsPDF,data:InvoiceData){
  doc.setTextColor(...darkBlue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(14)
  doc.text(`Fatura ${shortId(data.id)} - Continuação`,18,18)
  doc.setDrawColor(...darkBlue)
  doc.setLineWidth(0.8)
  doc.line(18,23,192,23)
}

function drawTableHeader(doc:jsPDF,y:number){
  doc.setFillColor(...darkBlue)
  doc.rect(18,y,174,13,'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.5)
  doc.text('Descrição',22,y+8)
  doc.text('Quantidade',126,y+8,{align:'center'})
  doc.text('Preço',158,y+6,{align:'center'})
  doc.text('unitário',158,y+10,{align:'center'})
  doc.text('Valor',188,y+8,{align:'right'})
  return y+13
}

function drawItems(doc:jsPDF,data:InvoiceData,startY:number){
  let y=drawTableHeader(doc,startY)

  data.items.forEach((item,index)=>{
    const description=`${item.codigo ? item.codigo+' - ' : ''}${item.descricao}`
    const lines=doc.splitTextToSize(description,88) as string[]
    const rowHeight=Math.max(10,lines.length*4.2+3)

    if(y+rowHeight>245){
      doc.addPage()
      drawContinuationHeader(doc,data)
      y=drawTableHeader(doc,29)
    }

    doc.setFont('helvetica','normal')
    doc.setTextColor(...textColor)
    doc.setFontSize(8.5)
    doc.text(lines,22,y+6)
    doc.text(`${num(item.quantidade)} ${item.unidade}`,126,y+6,{align:'center'})
    doc.text(num(item.valor_unitario),158,y+6,{align:'center'})
    doc.text(brl(item.total),188,y+6,{align:'right'})

    if(item.desconto>0){
      doc.setFontSize(6.8)
      doc.setTextColor(105,116,135)
      doc.text(`desconto: ${brl(item.desconto)}`,22,y+rowHeight-2)
    }

    doc.setDrawColor(226,232,242)
    doc.setLineWidth(0.3)
    doc.line(18,y+rowHeight,192,y+rowHeight)
    y+=rowHeight

    if(index===data.items.length-1){
      y+=4
    }
  })

  return y
}

function drawPaymentAndTotal(doc:jsPDF,data:InvoiceData,y:number){
  const needed=42
  if(y+needed>252){
    doc.addPage()
    drawContinuationHeader(doc,data)
    y=31
  }

  doc.setFillColor(...lightBlue)
  doc.setDrawColor(137,183,255)
  doc.setLineDashPattern([1.5,1.5],0)
  doc.roundedRect(18,y,88,29,1.5,1.5,'FD')
  doc.setLineDashPattern([],0)

  doc.setTextColor(...textColor)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.5)
  doc.text('Dados para Pagamento:',22,y+8)
  doc.setFont('helvetica','normal')
  doc.text(`Comunicação de pagamento: Fatura ${shortId(data.id)}`,22,y+15)
  doc.text(`Nesta conta: ${COMPANY.pagamento1}`,22,y+21)
  doc.text(COMPANY.pagamento2,22,y+27)

  const totalX=124
  doc.setFillColor(...darkBlue)
  doc.rect(totalX,y,68,12,'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(10)
  doc.text('Total:',totalX+14,y+8)
  doc.text(brl(data.total),188,y+8,{align:'right'})

  if(data.desconto>0){
    doc.setTextColor(...textColor)
    doc.setFontSize(7.5)
    doc.setFont('helvetica','normal')
    doc.text(`Subtotal: ${brl(data.subtotal)}`,188,y+19,{align:'right'})
    doc.text(`Desconto: ${brl(data.desconto)}`,188,y+25,{align:'right'})
  }

  return y+36
}

function drawConditions(doc:jsPDF,data:InvoiceData,y:number){
  const lineWidth=174
  const wrapped=CONDITIONS.map(item=>doc.splitTextToSize(item,lineWidth) as string[])
  const conditionsHeight=wrapped.reduce((sum,lines)=>sum+(lines.length*4.2),0)+15
  const signatureHeight=31

  if(y+conditionsHeight+signatureHeight>275){
    doc.addPage()
    drawContinuationHeader(doc,data)
    y=32
  }

  doc.setDrawColor(228,233,241)
  doc.setLineWidth(0.3)
  doc.line(18,y,192,y)
  y+=8

  doc.setFont('helvetica','bold')
  doc.setTextColor(...brightBlue)
  doc.setFontSize(9)
  doc.text('Condições Gerais',18,y)
  y+=6

  doc.setTextColor(...textColor)
  doc.setFont('helvetica','normal')
  doc.setFontSize(7)
  wrapped.forEach(lines=>{
    doc.text(lines,18,y)
    y+=lines.length*4.2+1
  })

  if(data.observacoes){
    const obs=doc.splitTextToSize(`Observações da venda: ${data.observacoes}`,174) as string[]
    if(y+obs.length*4.2+26>278){
      doc.addPage()
      drawContinuationHeader(doc,data)
      y=32
    }
    doc.setFont('helvetica','bold')
    doc.text('Observações:',18,y)
    y+=5
    doc.setFont('helvetica','normal')
    doc.text(obs,18,y)
    y+=obs.length*4.2+4
  }

  if(y+28>278){
    doc.addPage()
    drawContinuationHeader(doc,data)
    y=38
  }

  doc.setFont('helvetica','italic')
  doc.setTextColor(95,111,140)
  doc.setFontSize(8.5)
  doc.text('Declaro estar ciente das condições acima mencionadas.',105,y+8,{align:'center'})
  doc.setDrawColor(...textColor)
  doc.setLineWidth(0.3)
  doc.line(66,y+20,144,y+20)
  doc.text('Assinatura do Cliente',105,y+27,{align:'center'})
}

function addFooters(doc:jsPDF){
  const pages=doc.getNumberOfPages()
  for(let page=1;page<=pages;page++){
    doc.setPage(page)
    doc.setTextColor(95,111,140)
    doc.setFont('helvetica','normal')
    doc.setFontSize(7.2)
    doc.text(`${COMPANY.email} | CNPJ ${COMPANY.cnpj}`,18,289)
    doc.text(`Página ${page}/${pages}`,192,289,{align:'right'})
  }
}

export function generateInvoicePdf(data:InvoiceData){
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  doc.setProperties({
    title:`Fatura ${shortId(data.id)}`,
    subject:'Fatura de venda',
    author:COMPANY.nome,
  })

  drawFirstHeader(doc,data)
  let y=drawItems(doc,data,119)
  y=drawPaymentAndTotal(doc,data,y)
  drawConditions(doc,data,y)
  addFooters(doc)

  doc.save(`fatura-${shortId(data.id)}.pdf`)
}
