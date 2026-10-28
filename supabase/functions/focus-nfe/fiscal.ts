export const FOCUS_BASE='https://homologacao.focusnfe.com.br'
export type Fields=Record<string,string>
export type FiscalDraft={destinatario:Fields;itens:Record<string,Fields>;natureza_operacao:string;consumidor_final:string;presenca_comprador:string;forma_pagamento:string}
export type SaleSource={venda:Record<string,unknown>;cliente:Record<string,unknown>|null;empresa:Record<string,unknown>|null;itens:{id:string;produto_id:string;quantidade:number;valor_unitario:number;desconto:number;total:number;produto:Record<string,unknown>}[];source_hash:string;nota?:Record<string,unknown>|null}
const digits=(v:unknown)=>String(v??'').replace(/\D/g,'')
const required=(v:unknown,label:string)=>{const s=String(v??'').trim();if(!s)throw Error('Preencha '+label+'.');return s}
const code=(v:unknown,pattern:RegExp,label:string)=>{const s=required(v,label);if(!pattern.test(s))throw Error(label+' inválido.');return s}
const cash=(v:number)=>Math.round((v+Number.EPSILON)*100)
const uf=(v:unknown,label:string)=>code(v,/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,label)
export function validateConfig(input:unknown):Fields{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Configuração inválida.')
 const c=input as Fields
 return {cnpj_emitente:code(digits(c.cnpj_emitente),/^\d{14}$/,'CNPJ do emitente'),
  inscricao_estadual_emitente:required(c.inscricao_estadual_emitente,'inscrição estadual do emitente'),
  regime_tributario_emitente:code(c.regime_tributario_emitente,/^[1-4]$/,'regime tributário'),
  logradouro_emitente:required(c.logradouro_emitente,'logradouro do emitente'),numero_emitente:required(c.numero_emitente,'número do emitente'),
  bairro_emitente:required(c.bairro_emitente,'bairro do emitente'),municipio_emitente:required(c.municipio_emitente,'município do emitente'),
  codigo_municipio_emitente:code(c.codigo_municipio_emitente,/^\d{7}$/,'código IBGE do emitente'),
  uf_emitente:uf(c.uf_emitente,'UF do emitente'),cep_emitente:code(digits(c.cep_emitente),/^\d{8}$/,'CEP do emitente')}
}
export function buildPayload(source:SaleSource,config:Fields,draft:FiscalDraft,now=new Date()):Record<string,unknown>{
 const c=validateConfig(config),v=source.venda,client=source.cliente
 if(!['pedido','faturado'].includes(String(v.status)))throw Error('Confirme o pedido antes de emitir a NF-e de teste.')
 if(!client)throw Error('Vincule um cliente à venda.')
 if(!source.itens.length)throw Error('Venda sem itens.')
 const d=draft.destinatario??{},doc=digits(client.documento)
 if(![11,14].includes(doc.length))throw Error('Preencha CPF/CNPJ válido no cadastro do cliente.')
 const destUf=uf(d.uf,'UF do destinatário'),regime=c.regime_tributario_emitente
 const items=source.itens.map((i,index)=>{
  const f=draft.itens?.[i.id]??{},label=' do item '+(index+1)
  const qty=Number(i.quantidade),price=Number(i.valor_unitario),discount=cash(Number(i.desconto||0)),gross=cash(qty*price)
  if(!Number.isFinite(qty)||!Number.isFinite(price)||qty<=0||price<0||discount<0||discount>gross)throw Error('Valores comerciais inválidos'+label+'.')
  const ncm=code(f.ncm,/^\d{8}$/,'NCM'+label)
  const cfop=code(f.cfop,/^[56]\d{3}$/,'CFOP de saída'+label)
  if(cfop[0]!== (c.uf_emitente===destUf?'5':'6'))throw Error('CFOP incompatível com a UF do destinatário'+label+'.')
  const icms=code(f.icms,/^\d{2,3}$/,'CST/CSOSN'+label)
  if((['1','4'].includes(regime)?3:2)!==icms.length)throw Error('CST/CSOSN incompatível com o regime'+label+'.')
  let extra:Record<string,unknown>={}
  if(f.complemento?.trim()){
   try{extra=JSON.parse(f.complemento)}catch{throw Error('Complemento tributário deve ser um objeto JSON'+label+'.')}
   if(!extra||typeof extra!=='object'||Array.isArray(extra))throw Error('Complemento tributário inválido'+label+'.')
   for(const [k,value] of Object.entries(extra)){
    if(!/^(icms_|pis_|cofins_|ipi_|ibs_cbs_|cbs_|ibs_)/.test(k)||['icms_situacao_tributaria','icms_origem','pis_situacao_tributaria','cofins_situacao_tributaria'].includes(k))throw Error('Campo tributário não permitido: '+k+'.')
    if(typeof value!=='string'&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Valor tributário inválido: '+k+'.')
   }
  }
  return {...extra,numero_item:index+1,codigo_produto:required(i.produto.codigo,'código do produto'),descricao:required(i.produto.descricao,'descrição do produto'),
   codigo_ncm:ncm,cfop,unidade_comercial:required(i.produto.unidade,'unidade do produto'),unidade_tributavel:i.produto.unidade,
   quantidade_comercial:qty,quantidade_tributavel:qty,valor_unitario_comercial:price,valor_unitario_tributavel:price,valor_bruto:gross/100,valor_desconto:discount/100,
   icms_origem:code(f.origem,/^[0-8]$/,'origem'+label),icms_situacao_tributaria:icms,
   pis_situacao_tributaria:code(f.pis,/^\d{2}$/,'CST PIS'+label),cofins_situacao_tributaria:code(f.cofins,/^\d{2}$/,'CST COFINS'+label),inclui_no_total:1}
 })
 const gross=items.reduce((sum,i)=>sum+cash(i.valor_bruto),0),discount=items.reduce((sum,i)=>sum+cash(i.valor_desconto),0),total=cash(Number(v.total))
 if(total<=0||total!==gross-discount)throw Error('O total da venda diverge dos itens e descontos. Revise a venda antes de emitir.')
 const payload:Record<string,unknown>={...c,
  nome_emitente:required(source.empresa?.razao_social,'razão social nas configurações da empresa'),
  natureza_operacao:required(draft.natureza_operacao,'natureza da operação').slice(0,60),data_emissao:now.toISOString(),tipo_documento:1,
  local_destino:c.uf_emitente===destUf?1:2,finalidade_emissao:1,
  consumidor_final:Number(code(draft.consumidor_final,/^[01]$/,'indicador de consumidor final')),
  presenca_comprador:Number(code(draft.presenca_comprador,/^[12359]$/,'presença do comprador')),
  nome_destinatario:'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
  [doc.length===14?'cnpj_destinatario':'cpf_destinatario']:doc,
  logradouro_destinatario:required(d.logradouro,'logradouro do destinatário'),numero_destinatario:required(d.numero,'número do destinatário'),
  bairro_destinatario:required(d.bairro,'bairro do destinatário'),municipio_destinatario:required(d.municipio,'município do destinatário'),
  codigo_municipio_destinatario:code(d.codigo_municipio,/^\d{7}$/,'código IBGE do destinatário'),uf_destinatario:destUf,
  cep_destinatario:code(digits(d.cep),/^\d{8}$/,'CEP do destinatário'),
  indicador_inscricao_estadual_destinatario:code(d.indicador_ie,/^(1|2|9)$/,'indicador de inscrição estadual'),
  modalidade_frete:9,valor_produtos:gross/100,valor_desconto:discount/100,valor_total:total/100,itens:items,
  formas_pagamento:[{forma_pagamento:code(draft.forma_pagamento,/^(01|03|04|15|17|20|91)$/,'forma de pagamento fiscal'),
   indicador_pagamento:Number(v.parcelas)>1?1:0,valor_pagamento:total/100}]}
 if(d.indicador_ie==='1')payload.inscricao_estadual_destinatario=required(d.ie,'inscrição estadual do destinatário')
 // Supported flow keeps the commercial total intact. Additional taxes changing vNF require a separate fiscal flow.
 for(const item of items)for(const key of ['ipi_valor','icms_valor_st','ii_valor','icms_valor_desonerado'])if(Number((item as Record<string,unknown>)[key]||0)!==0)throw Error('Tributos que alteram o total da nota exigem revisão fiscal específica; este fluxo de teste mantém o total da venda.')
 return payload
}
export function safeResult(input:Record<string,unknown>):Record<string,unknown>{
 const keys=['status','status_sefaz','mensagem_sefaz','codigo','mensagem','numero','serie','chave_nfe','caminho_xml_nota_fiscal','caminho_danfe','erros']
 return Object.fromEntries(keys.filter(k=>k in input).map(k=>[k,input[k]]))
}
export function providerStatus(result:Record<string,unknown>,httpStatus:number){
 const s=String(result.status??'')
 if(['processando_autorizacao','autorizado','erro_autorizacao','cancelado','denegado'].includes(s))return s
 return httpStatus>=500?'incerto':httpStatus>=400?'rejeitado':'incerto'
}
export function documentUrl(path:unknown){
 const u=new URL(String(path??''),FOCUS_BASE)
 if(u.origin!==FOCUS_BASE||!u.pathname.startsWith('/arquivos/')||u.username||u.password)throw Error('Arquivo fiscal indisponível ou endereço inválido.')
 return u.href
}
