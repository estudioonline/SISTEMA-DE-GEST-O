import {jsPDF} from 'jspdf'

export type CashClosingPdfItem={
  diario_nome:string
  banco?:string|null
  saldo_inicial:number
  entradas:number
  saidas:number
  saldo_esperado:number
  saldo_conferido:number
  diferenca:number
}

export type CashClosingPdfData={
  data_caixa:string
  company?:{nome_fantasia?:string|null;razao_social?:string|null;cnpj?:string|null;email?:string|null}|null
  status?:string
  fechado_em?:string|null
  observacao?:string|null
  items:CashClosingPdfItem[]
}

const blue:[number,number,number]=[34,99,190]
const darkBlue:[number,number,number]=[24,52,86]
const paleBlue:[number,number,number]=[242,247,254]
const rowAlt:[number,number,number]=[248,250,252]
const text:[number,number,number]=[31,41,55]
const muted:[number,number,number]=[102,112,128]
const border:[number,number,number]=[215,223,233]

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)
const dateBr=(value:string)=>{
  if(!value)return '-'
  const d=/^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0,4)),Number(value.slice(5,7))-1,Number(value.slice(8,10)),12)
    : new Date(value)
  return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('pt-BR').format(d)
}
const dateTimeBr=(value:string|null|undefined)=>{
  if(!value)return '-'
  const d=new Date(value)
  return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d)
}
const safe=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()
const fit=(doc:jsPDF,value:string,width:number)=>{
  const t=String(value||'-')
  if(doc.getTextWidth(t)<=width)return t
  let out=t
  while(out.length>1&&doc.getTextWidth(out+'...')>width)out=out.slice(0,-1)
  return out+'...'
}

export function generateCashClosingPdf(data:CashClosingPdfData){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  const company=data.company?.nome_fantasia||data.company?.razao_social||'Sistema de Gestão'
  const totals=data.items.reduce((acc,row)=>{
    acc.initial+=Number(row.saldo_inicial)||0
    acc.in+=Number(row.entradas)||0
    acc.out+=Number(row.saidas)||0
    acc.expected+=Number(row.saldo_esperado)||0
    acc.checked+=Number(row.saldo_conferido)||0
    acc.diff+=Number(row.diferenca)||0
    return acc
  },{initial:0,in:0,out:0,expected:0,checked:0,diff:0})

  doc.setProperties({
    title:`Fechamento de Caixa - ${dateBr(data.data_caixa)}`,
    subject:'Fechamento diário consolidado de caixa e bancos',
    author:company
  })

  doc.setFillColor(...paleBlue);doc.rect(0,0,297,31,'F')
  doc.setTextColor(...darkBlue);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(company,12,11)
  doc.setTextColor(...blue);doc.setFontSize(13);doc.text('Relatório de Fechamento de Caixa Diário',12,20)
  doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(8.5)
  doc.text('Data: '+dateBr(data.data_caixa),285,8,{align:'right'})
  doc.text('Status: '+(data.status==='reaberto'?'Reaberto':'Fechado'),285,14,{align:'right'})
  doc.text('Fechado em: '+dateTimeBr(data.fechado_em),285,20,{align:'right'})
  doc.text('Emitido: '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date()),285,26,{align:'right'})

  let y=38
  const cards=[
    ['Saldo inicial',money(totals.initial)],
    ['Entradas',money(totals.in)],
    ['Saídas',money(totals.out)],
    ['Saldo esperado',money(totals.expected)],
    ['Saldo conferido',money(totals.checked)],
    ['Diferença',money(totals.diff)]
  ] as const
  const gap=4
  const cardW=(273-gap*5)/6
  cards.forEach((card,index)=>{
    const x=12+index*(cardW+gap)
    doc.setFillColor(250,251,253);doc.setDrawColor(...border);doc.roundedRect(x,y,cardW,18,2.5,2.5,'FD')
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7.6);doc.text(card[0],x+3,y+6)
    doc.setTextColor(...darkBlue);doc.setFont('helvetica','bold');doc.setFontSize(9.6);doc.text(fit(doc,card[1],cardW-6),x+3,y+13.5)
  })
  y+=26

  const cols=[
    {x:12,w:52,label:'Conta'},
    {x:64,w:34,label:'Saldo inicial'},
    {x:98,w:34,label:'Entradas'},
    {x:132,w:34,label:'Saídas'},
    {x:166,w:39,label:'Esperado'},
    {x:205,w:40,label:'Conferido'},
    {x:245,w:40,label:'Diferença'}
  ]
  doc.setFillColor(...darkBlue);doc.rect(12,y,273,8,'F')
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8)
  cols.forEach(c=>doc.text(c.label,c.label==='Conta'?c.x+2:c.x+c.w-2,y+5.2,{align:c.label==='Conta'?'left':'right'}))
  y+=8

  data.items.forEach((row,index)=>{
    if(y+9>190){doc.addPage();y=18}
    if(index%2===0){doc.setFillColor(...rowAlt);doc.rect(12,y,273,8,'F')}
    doc.setDrawColor(235,239,244);doc.line(12,y+8,285,y+8)
    doc.setTextColor(...text);doc.setFont('helvetica','normal');doc.setFontSize(8)
    doc.text(fit(doc,row.diario_nome+(row.banco&&row.banco!==row.diario_nome?' - '+row.banco:''),48),14,y+5.2)
    doc.text(money(row.saldo_inicial),96,y+5.2,{align:'right'})
    doc.text(money(row.entradas),130,y+5.2,{align:'right'})
    doc.text(money(row.saidas),164,y+5.2,{align:'right'})
    doc.text(money(row.saldo_esperado),203,y+5.2,{align:'right'})
    doc.text(money(row.saldo_conferido),243,y+5.2,{align:'right'})
    doc.setFont('helvetica','bold');doc.text(money(row.diferenca),283,y+5.2,{align:'right'})
    y+=8
  })

  if(data.observacao){
    y+=6
    if(y+22>190){doc.addPage();y=18}
    doc.setFillColor(...paleBlue);doc.setDrawColor(...border);doc.roundedRect(12,y,273,18,2.5,2.5,'FD')
    doc.setTextColor(...darkBlue);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Observação',16,y+6)
    doc.setTextColor(...text);doc.setFont('helvetica','normal');doc.setFontSize(8)
    const lines=doc.splitTextToSize(data.observacao,248)
    doc.text(lines.slice(0,2),16,y+12)
  }

  const pages=doc.getNumberOfPages()
  for(let p=1;p<=pages;p++){
    doc.setPage(p);doc.setDrawColor(...border);doc.line(12,199,285,199)
    doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(8)
    doc.text([data.company?.email||'',data.company?.cnpj||''].filter(Boolean).join(' | '),12,204)
    doc.text('Página '+p+'/'+pages,285,204,{align:'right'})
  }

  doc.save(`fechamento-caixa-${safe(data.data_caixa)}.pdf`)
}
