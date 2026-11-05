import { jsPDF } from 'jspdf'
import type { InvoiceCompany } from './invoicePdf'

type EmployeeLine={
  nome:string
  liquido:number
  bruto?:number
  descontos?:number
}

type HrPayrollInvoiceData={
  company?:InvoiceCompany|null
  competencia:string
  vencimento:string
  linhas:EmployeeLine[]
  origem:'folha_importada'|'previsao'
}

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value||0)
const dateBr=(value:string)=>{
  if(!value)return '—'
  const [y,m,d]=value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(y,m-1,d,12))
}
const safe=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()

export function generateHrPayrollInvoicePdf(data:HrPayrollInvoiceData){
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const company=data.company?.nome_fantasia||data.company?.razao_social||'Sistema de Gestão'
  const total=data.linhas.reduce((sum,row)=>sum+Number(row.liquido||0),0)
  const competenciaLabel=data.competencia.split('-').reverse().join('/')

  doc.setProperties({
    title:`Fatura RH - Folha ${competenciaLabel}`,
    subject:'Conta a pagar consolidada da folha salarial',
    author:company
  })

  doc.setFillColor(240,246,255)
  doc.rect(0,0,210,38,'F')
  doc.setTextColor(20,52,93)
  doc.setFont('helvetica','bold')
  doc.setFontSize(18)
  doc.text(company,14,15)
  doc.setTextColor(37,99,235)
  doc.setFontSize(14)
  doc.text('FATURA RH — FOLHA SALARIAL',14,27)

  doc.setTextColor(31,41,55)
  doc.setFont('helvetica','normal')
  doc.setFontSize(10)
  let y=49
  const info=[
    ['Tipo','Conta a pagar'],
    ['Descrição',`Folha salarial ${competenciaLabel}`],
    ['Competência',competenciaLabel],
    ['Vencimento',dateBr(data.vencimento)],
    ['Origem',data.origem==='folha_importada'?'Folha importada da contabilidade':'Previsão de folha'],
    ['Valor total',money(total)]
  ]
  for(const [label,value] of info){
    doc.setFont('helvetica','bold')
    doc.text(label+':',14,y)
    doc.setFont('helvetica','normal')
    doc.text(String(value),48,y)
    y+=7
  }

  y+=5
  doc.setFillColor(24,52,86)
  doc.rect(14,y,182,8,'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8.5)
  doc.text('Funcionário',17,y+5.3)
  doc.text('Bruto',130,y+5.3,{align:'right'})
  doc.text('Descontos',160,y+5.3,{align:'right'})
  doc.text('Líquido',193,y+5.3,{align:'right'})
  y+=8

  data.linhas.forEach((row,index)=>{
    if(y>265){
      doc.addPage()
      y=20
    }
    if(index%2===0){
      doc.setFillColor(248,250,252)
      doc.rect(14,y,182,8,'F')
    }
    doc.setTextColor(31,41,55)
    doc.setFont('helvetica','normal')
    doc.setFontSize(8.2)
    const name=doc.getTextWidth(row.nome)>78?row.nome.slice(0,40)+'…':row.nome
    doc.text(name,17,y+5.2)
    doc.text(row.bruto!=null?money(row.bruto):'—',130,y+5.2,{align:'right'})
    doc.text(row.descontos!=null?money(row.descontos):'—',160,y+5.2,{align:'right'})
    doc.setFont('helvetica','bold')
    doc.text(money(row.liquido),193,y+5.2,{align:'right'})
    y+=8
  })

  y+=6
  if(y>266){doc.addPage();y=22}
  doc.setDrawColor(180,195,214)
  doc.line(118,y,196,y)
  doc.setFont('helvetica','bold')
  doc.setFontSize(12)
  doc.setTextColor(20,52,93)
  doc.text('TOTAL LÍQUIDO A PAGAR',118,y+8)
  doc.setTextColor(37,99,235)
  doc.text(money(total),196,y+8,{align:'right'})

  y+=22
  doc.setTextColor(102,112,128)
  doc.setFont('helvetica','normal')
  doc.setFontSize(8.5)
  doc.text('Documento gerado pelo RH apenas para importação manual no Financeiro.',14,y)
  doc.text('Nenhum título financeiro é criado automaticamente por este documento.',14,y+5)

  const filename=`fatura-rh-folha-${safe(data.competencia)}.pdf`
  doc.save(filename)
}
