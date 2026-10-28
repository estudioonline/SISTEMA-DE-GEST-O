export type ParsedNfeItem={
  item:number
  codigo_fornecedor:string
  descricao:string
  unidade:string
  quantidade:number
  valor_unitario:number
  valor_total:number
}

export type ParsedNfe={
  chave_nfe:string
  numero_nfe:string
  cnpj_fornecedor:string
  nome_fornecedor:string
  data_emissao:string
  valor_total:number
  vencimentos:string[]
  itens:ParsedNfeItem[]
}

const nodes=(root:Document|Element,tag:string):Element[]=>{
  const ns=Array.from(root.getElementsByTagNameNS('*',tag))
  return ns.length?ns:Array.from(root.getElementsByTagName(tag))
}

const first=(root:Document|Element,tag:string)=>nodes(root,tag)[0]||null
const text=(root:Document|Element|null,tag:string)=>{
  if(!root)return ''
  return (first(root,tag)?.textContent||'').trim()
}
const decimal=(value:string)=>{
  const normalized=String(value||'').trim().replace(',','.')
  const n=Number(normalized)
  return Number.isFinite(n)?n:NaN
}
const digits=(value:string)=>String(value||'').replace(/\D/g,'')

export function parseNfeXml(xmlText:string):ParsedNfe{
  if(!xmlText.trim())throw new Error('O arquivo XML está vazio.')
  if(/<!DOCTYPE/i.test(xmlText))throw new Error('XML com DOCTYPE não é permitido.')

  const doc=new DOMParser().parseFromString(xmlText,'application/xml')
  if(nodes(doc,'parsererror').length)throw new Error('XML inválido ou corrompido.')

  const infNfe=first(doc,'infNFe')
  if(!infNfe)throw new Error('O arquivo não contém uma NF-e válida (infNFe não encontrado).')

  const rawKey=text(doc,'chNFe')||String(infNfe.getAttribute('Id')||'').replace(/^NFe/i,'')
  const chave_nfe=digits(rawKey)
  if(chave_nfe.length!==44)throw new Error('Não foi possível identificar a chave de 44 dígitos da NF-e.')

  const ide=first(infNfe,'ide')
  const emit=first(infNfe,'emit')
  const total=first(infNfe,'ICMSTot')
  const numero_nfe=text(ide,'nNF')
  const cnpj_fornecedor=digits(text(emit,'CNPJ'))
  const nome_fornecedor=text(emit,'xNome')
  const rawEmission=text(ide,'dhEmi')||text(ide,'dEmi')
  const data_emissao=rawEmission.length===10?rawEmission+'T12:00:00-03:00':rawEmission
  const valor_total=decimal(text(total,'vNF'))

  if(!numero_nfe)throw new Error('Número da NF-e (nNF) não encontrado.')
  if(cnpj_fornecedor.length!==14)throw new Error('CNPJ do emitente não encontrado ou inválido.')
  if(!nome_fornecedor)throw new Error('Nome do emitente não encontrado.')
  if(!data_emissao)throw new Error('Data de emissão da NF-e não encontrada.')
  if(!Number.isFinite(valor_total))throw new Error('Valor total da NF-e (vNF) inválido.')

  const itens=nodes(infNfe,'det').map((det,index)=>{
    const prod=first(det,'prod')
    if(!prod)throw new Error('Item '+(index+1)+' sem bloco prod.')
    const codigo_fornecedor=text(prod,'cProd')
    const descricao=text(prod,'xProd')
    const unidade=text(prod,'uCom')||'UN'
    const quantidade=decimal(text(prod,'qCom'))
    const valor_unitario=decimal(text(prod,'vUnCom'))
    const valor_produto=decimal(text(prod,'vProd'))
    if(!codigo_fornecedor)throw new Error('Item '+(index+1)+' sem código do fornecedor (cProd).')
    if(!descricao)throw new Error('Item '+(index+1)+' sem descrição (xProd).')
    if(!Number.isFinite(quantidade)||quantidade<=0)throw new Error('Quantidade inválida no item '+codigo_fornecedor+'.')
    if(!Number.isFinite(valor_unitario)||valor_unitario<0)throw new Error('Valor unitário inválido no item '+codigo_fornecedor+'.')
    return {
      item:Number(det.getAttribute('nItem')||index+1),
      codigo_fornecedor,
      descricao,
      unidade,
      quantidade,
      valor_unitario,
      valor_total:Number.isFinite(valor_produto)?valor_produto:quantidade*valor_unitario
    }
  })

  if(!itens.length)throw new Error('A NF-e não possui itens de produto.')

  const vencimentos=nodes(infNfe,'dup')
    .map(dup=>text(dup,'dVenc'))
    .filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v))

  return {
    chave_nfe,
    numero_nfe,
    cnpj_fornecedor,
    nome_fornecedor,
    data_emissao,
    valor_total,
    vencimentos,
    itens
  }
}
