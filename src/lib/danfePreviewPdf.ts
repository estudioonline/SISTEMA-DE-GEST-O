import { jsPDF } from 'jspdf'

type Company={
  razao_social?:string|null
  nome_fantasia?:string|null
  cnpj?:string|null
  telefone?:string|null
  endereco?:string|null
  cidade?:string|null
  uf?:string|null
  cep?:string|null
}
type Client={
  nome:string
  documento:string
  logradouro?:string|null
  numero?:string|null
  bairro?:string|null
  municipio?:string|null
  uf?:string|null
  cep?:string|null
  inscricao_estadual?:string|null
}
type Product={
  descricao:string
  codigo:string
  unidade?:string|null
  ncm?:string|null
  cfop_interno?:string|null
  cfop_interestadual?:string|null
  cst_icms?:string|null
}
type Item={
  quantidade:number
  valor_unitario:number
  desconto:number
  total?:number
  produto:Product
}
export type DanfePreviewData={
  venda:{
    total:number
    subtotal?:number
    desconto?:number
    forma_pagamento?:string
    created_at?:string
    fatura_numero?:number|null
  }
  cliente:Client|null
  empresa?:Company|null
  itens:Item[]
  payload?:Record<string,unknown>|null
  referencia?:string|null
}

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0))
const onlyDigits=(v:unknown)=>String(v??'').replace(/\D/g,'')
const maskDoc=(v:unknown)=>{
  const d=onlyDigits(v)
  if(d.length===14)return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')
  if(d.length===11)return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')
  return String(v??'')
}
const maskCep=(v:unknown)=>{
  const d=onlyDigits(v)
  return d.length===8?d.replace(/(\d{5})(\d{3})/,'$1-$2'):String(v??'')
}
const asDate=(v?:string)=>{
  const d=v?new Date(v):new Date()
  return Number.isNaN(d.getTime())?new Date():d
}
const fit=(doc:jsPDF,v:unknown,w:number)=>{
  const t=String(v??'')
  if(doc.getTextWidth(t)<=w)return t
  let s=t
  while(s.length>1&&doc.getTextWidth(s+'...')>w)s=s.slice(0,-1)
  return s+'...'
}
function cap(doc:jsPDF,t:string,x:number,y:number){
  doc.setFont('helvetica','bold');doc.setFontSize(5.4);doc.text(t.toUpperCase(),x,y)
}
function val(doc:jsPDF,t:unknown,x:number,y:number,size=7,bold=true){
  doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.text(String(t??''),x,y)
}
function field(doc:jsPDF,x:number,y:number,w:number,h:number,title:string,text:unknown,size=7){
  doc.rect(x,y,w,h);cap(doc,title,x+1.2,y+3);val(doc,fit(doc,text,w-2.4),x+1.2,y+h-1.8,size,true)
}

export function generateDanfePreviewPdf(data:DanfePreviewData){
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const p=data.payload||{}
  const pv=(k:string)=>p[k]
  const empresa=data.empresa||{}
  const cliente=data.cliente
  const issue=asDate(data.venda.created_at)
  const issueDate=new Intl.DateTimeFormat('pt-BR').format(issue)
  const issueTime=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(issue)
  const nf=String(data.venda.fatura_numero||0).padStart(9,'0')
  const name=empresa.razao_social||empresa.nome_fantasia||String(pv('nome_emitente')||'EMITENTE')
  const cnpj=maskDoc(pv('cnpj_emitente')||empresa.cnpj)
  const emitAddress=[pv('logradouro_emitente')||empresa.endereco,pv('numero_emitente')].filter(Boolean).join(', ')
  const emitCity=[pv('municipio_emitente')||empresa.cidade,pv('uf_emitente')||empresa.uf].filter(Boolean).join(' - ')
  const emitCep=maskCep(pv('cep_emitente')||empresa.cep)
  const subtotal=Number(data.venda.subtotal??data.itens.reduce((s,i)=>s+Number(i.quantidade)*Number(i.valor_unitario),0))
  const discount=Number(data.venda.desconto??data.itens.reduce((s,i)=>s+Number(i.desconto||0),0))
  const total=Number(data.venda.total||0)

  doc.setDrawColor(0);doc.setTextColor(0);doc.setLineWidth(.2)

  // Receipt strip
  doc.rect(5,5,200,16)
  doc.setFont('helvetica','normal');doc.setFontSize(6)
  doc.text('Recebemos de '+fit(doc,name,115)+' os produtos e/ou servicos constantes deste documento.',7,9)
  doc.line(145,5,145,21)
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('NF-e',175,10,{align:'center'})
  doc.setFontSize(7);doc.text('No '+nf,175,14,{align:'center'});doc.text('Serie 001',175,18,{align:'center'})
  doc.line(5,14,145,14);doc.line(46,14,46,21)
  cap(doc,'Data do recebimento',7,17);cap(doc,'Identificacao e assinatura do recebedor',48,17)

  // DANFE header
  doc.rect(5,24,200,34);doc.line(85,24,85,58);doc.line(121,24,121,58)
  doc.setFont('helvetica','bold');doc.setFontSize(10)
  doc.text(doc.splitTextToSize(String(name),74),45,29,{align:'center'})
  doc.setFont('helvetica','normal');doc.setFontSize(6)
  let y=39
  ;[emitAddress,emitCity+(emitCep?' - CEP: '+emitCep:''),empresa.telefone?'Fone: '+empresa.telefone:''].filter(Boolean).forEach(t=>{doc.text(fit(doc,t,72),45,y,{align:'center'});y+=4})
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('DANFE',103,30,{align:'center'})
  doc.setFontSize(5.6);doc.text('Documento Auxiliar da',103,34,{align:'center'});doc.text('Nota Fiscal Eletronica',103,37,{align:'center'})
  doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.text('0 - ENTRADA',89,43);doc.text('1 - SAIDA',89,47)
  doc.rect(111,41,6,7);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('1',114,46,{align:'center'})
  doc.setFontSize(7);doc.text('No '+nf,88,53);doc.text('Serie 001',88,57)
  cap(doc,'Chave de acesso',123,28)
  doc.setFont('helvetica','bold');doc.setFontSize(6.8);doc.text('NAO GERADA - SEM AUTORIZACAO DA SEFAZ',163,35,{align:'center'})
  doc.setFont('helvetica','normal');doc.setFontSize(5.5);doc.text('PRE-VISUALIZACAO INTERNA - SEM VALOR FISCAL',163,42,{align:'center'})
  doc.text('Referencia ERP: '+fit(doc,data.referencia||'-',62),163,49,{align:'center'})

  field(doc,5,58,115,12,'Natureza da operacao',String(pv('natureza_operacao')||'VENDA DE MERCADORIA'))
  field(doc,120,58,85,12,'Protocolo de autorizacao de uso','NF-e sem Autorizacao de Uso da SEFAZ',6.2)
  field(doc,5,70,70,10,'Inscricao estadual',String(pv('inscricao_estadual_emitente')||'-'))
  field(doc,75,70,65,10,'IE do substituto tributario','-')
  field(doc,140,70,65,10,'CNPJ / CPF',cnpj)

  // Destinatario
  doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text('DESTINATARIO / REMETENTE',5,83)
  field(doc,5,85,125,11,'Nome / Razao social',cliente?.nome||'-')
  field(doc,130,85,45,11,'CNPJ / CPF',maskDoc(cliente?.documento))
  field(doc,175,85,30,11,'Data da emissao',issueDate)
  field(doc,5,96,100,11,'Endereco',[cliente?.logradouro,cliente?.numero].filter(Boolean).join(', ')||'-')
  field(doc,105,96,50,11,'Bairro / Distrito',cliente?.bairro||'-')
  field(doc,155,96,20,11,'CEP',maskCep(cliente?.cep))
  field(doc,175,96,30,11,'Data da saida',issueDate)
  field(doc,5,107,90,11,'Municipio',cliente?.municipio||'-')
  field(doc,95,107,15,11,'UF',cliente?.uf||'-')
  field(doc,110,107,35,11,'Telefone / Fax','-')
  field(doc,145,107,30,11,'Inscricao estadual',cliente?.inscricao_estadual||'-',6.2)
  field(doc,175,107,30,11,'Hora da saida',issueTime)

  // Pagamento
  doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text('PAGAMENTOS',5,121)
  doc.rect(5,123,200,12)
  cap(doc,'Descricao',7,126.5);val(doc,String(data.venda.forma_pagamento||'Nao informado').toUpperCase(),7,131,7)
  cap(doc,'Valor',85,126.5);val(doc,'R$ '+money(total),85,131,7)

  // Impostos
  doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text('CALCULO DO IMPOSTO',5,138)
  const w=40
  field(doc,5,140,w,11,'Base de calculo do ICMS','0,00');field(doc,45,140,w,11,'Valor do ICMS','0,00')
  field(doc,85,140,w,11,'Base calculo ICMS subst.','0,00');field(doc,125,140,w,11,'Valor do ICMS subst.','0,00')
  field(doc,165,140,w,11,'Valor total dos produtos',money(subtotal))
  const w2=200/6
  field(doc,5,151,w2,11,'Valor do frete','0,00');field(doc,5+w2,151,w2,11,'Valor do seguro','0,00')
  field(doc,5+w2*2,151,w2,11,'Desconto',money(discount));field(doc,5+w2*3,151,w2,11,'Outras despesas','0,00')
  field(doc,5+w2*4,151,w2,11,'Valor do IPI','0,00');field(doc,5+w2*5,151,w2,11,'Valor total da nota',money(total))

  // Transportador
  doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text('TRANSPORTADOR / VOLUMES TRANSPORTADOS',5,165)
  doc.rect(5,167,200,18);[80,115,140,165,180].forEach(x=>doc.line(x,167,x,185))
  cap(doc,'Nome / Razao social',7,170.5);cap(doc,'Frete por conta',82,170.5);val(doc,'9 - SEM FRETE',82,180,6.2)
  cap(doc,'Codigo ANTT',117,170.5);cap(doc,'Placa',142,170.5);cap(doc,'UF',167,170.5);cap(doc,'CNPJ / CPF',182,170.5)

  // Produtos
  doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text('DADOS DOS PRODUTOS / SERVICOS',5,189)
  const top=191
  const cols=[
    {x:5,w:16,label:'CODIGO'}, {x:21,w:62,label:'DESCRICAO DO PRODUTO / SERVICO'},
    {x:83,w:18,label:'NCM/SH'}, {x:101,w:14,label:'CST'}, {x:115,w:14,label:'CFOP'},
    {x:129,w:12,label:'UNID.'}, {x:141,w:16,label:'QTDE.'}, {x:157,w:19,label:'VALOR UNIT.'},
    {x:176,w:14,label:'DESC.'}, {x:190,w:15,label:'VALOR'}
  ]
  const rowH=7
  const tableBottom=260
  doc.rect(5,top,200,12)
  cols.slice(1).forEach(c=>doc.line(c.x,top,c.x,tableBottom))
  doc.line(5,203,205,203)
  doc.setFont('helvetica','bold');doc.setFontSize(4.5)
  cols.forEach(c=>doc.text(c.label,c.x+c.w/2,196,{align:'center',maxWidth:c.w-1}))
  let ry=203
  doc.setFont('helvetica','normal');doc.setFontSize(5.6)
  data.itens.slice(0,8).forEach(item=>{
    const cfop=String(item.produto.cfop_interno||item.produto.cfop_interestadual||'-')
    const totalItem=Number(item.total??(item.quantidade*item.valor_unitario-item.desconto))
    const values=[
      item.produto.codigo,item.produto.descricao,item.produto.ncm||'-',item.produto.cst_icms||'-',cfop,item.produto.unidade||'UN',
      Number(item.quantidade).toLocaleString('pt-BR',{minimumFractionDigits:2}),money(item.valor_unitario),money(item.desconto),money(totalItem)
    ]
    values.forEach((v,i)=>{
      const c=cols[i]
      doc.text(fit(doc,v,c.w-1.2),i===1?c.x+1:c.x+c.w/2,ry+4.7,{align:i===1?'left':'center'})
    })
    ry+=rowH
    doc.line(5,ry,205,ry)
  })
  doc.rect(5,203,200,57)

  // Dados adicionais
  doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text('DADOS ADICIONAIS',5,264)
  doc.rect(5,266,200,24);doc.line(138,266,138,290)
  cap(doc,'Informacoes complementares',7,269.5);cap(doc,'Reservado ao fisco',140,269.5)
  doc.setFont('helvetica','normal');doc.setFontSize(5.5)
  const extra='DOCUMENTO DE PRE-VISUALIZACAO. SEM AUTORIZACAO DE USO DA SEFAZ. SEM VALOR FISCAL.'
  doc.text(doc.splitTextToSize(extra,126),7,274)

  // Watermark
  doc.setTextColor(190,190,190)
  doc.setFont('helvetica','bold');doc.setFontSize(24)
  doc.text('SEM AUTORIZACAO',105,225,{align:'center',angle:0})
  doc.setFontSize(18);doc.text('USO DA SEFAZ',105,235,{align:'center'})
  doc.setTextColor(0)

  doc.setFont('helvetica','normal');doc.setFontSize(5)
  doc.text('PRE-VISUALIZACAO DANFE - GERADO PELO ERP - SEM VALOR FISCAL',5,296)

  doc.save('danfe-previa-'+nf+'.pdf')
}
