export const FOCUS_BASE='https://homologacao.focusnfe.com.br'
export type Fields=Record<string,string>
export type FiscalDraft=Record<string,never>
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
function fiscalExtra(value:unknown,label:string){
 if(value==null)return {} as Record<string,unknown>
 if(typeof value!=='object'||Array.isArray(value))throw Error('Complemento tributário inválido'+label+'.')
 const extra=value as Record<string,unknown>
 for(const [k,v] of Object.entries(extra)){
  if(!/^(icms_|pis_|cofins_|ipi_|ibs_cbs_|cbs_|ibs_)/.test(k)||['icms_situacao_tributaria','icms_origem','pis_situacao_tributaria','cofins_situacao_tributaria'].includes(k))throw Error('Campo tributário não permitido: '+k+'.')
  if(typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('Valor tributário inválido: '+k+'.')
 }
 return extra
}
export function buildPayload(source:SaleSource,config:Fields,_draft:FiscalDraft={},now=new Date()):Record<string,unknown>{
 const c=validateConfig(config),v=source.venda,client=source.cliente
 if(!['pedido','faturado'].includes(String(v.status)))throw Error('Confirme o pedido antes de emitir a NF-e de teste.')
 if(!client)throw Error('Vincule um cliente à venda.')
 if(!source.itens.length)throw Error('Venda sem itens.')

 const doc=digits(client.documento)
 if(![11,14].includes(doc.length))throw Error('Complete CPF/CNPJ válido no cadastro do cliente.')
 const destUf=uf(client.uf,'UF no cadastro do cliente')
 const regime=c.regime_tributario_emitente
 const sameState=c.uf_emitente===destUf
 const indicadorIe=code(client.indicador_ie,/^(1|2|9)$/,'indicador de inscrição estadual no cadastro do cliente')
 if(client.consumidor_final===null||client.consumidor_final===undefined)throw Error('Complete o campo consumidor final no cadastro do cliente.')
 const presenca=Number(code(client.presenca_comprador,/^[12359]$/,'presença do comprador no cadastro do cliente'))

 const items=source.itens.map((i,index)=>{
  const p=i.produto,label=' do produto '+required(p.descricao,'descrição do produto')
  const qty=Number(i.quantidade),price=Number(i.valor_unitario),discount=cash(Number(i.desconto||0)),gross=cash(qty*price)
  if(!Number.isFinite(qty)||!Number.isFinite(price)||qty<=0||price<0||discount<0||discount>gross)throw Error('Valores comerciais inválidos'+label+'.')
  const ncm=code(p.ncm,/^\d{8}$/,'NCM'+label)
  const cfop=code(sameState?p.cfop_interno:p.cfop_interestadual,sameState?/^5\d{3}$/:/^6\d{3}$/,sameState?'CFOP interno'+label:'CFOP interestadual'+label)
  const icms=code(p.cst_icms,/^\d{2,3}$/,'CST/CSOSN'+label)
  if((['1','4'].includes(regime)?3:2)!==icms.length)throw Error('CST/CSOSN incompatível com o regime tributário'+label+'.')
  const extra=fiscalExtra(p.complemento_tributario,label)
  return {...extra,numero_item:index+1,codigo_produto:required(p.codigo,'código do produto'),descricao:required(p.descricao,'descrição do produto'),
   codigo_ncm:ncm,cfop,unidade_comercial:required(p.unidade,'unidade do produto'),unidade_tributavel:p.unidade,
   quantidade_comercial:qty,quantidade_tributavel:qty,valor_unitario_comercial:price,valor_unitario_tributavel:price,valor_bruto:gross/100,valor_desconto:discount/100,
   icms_origem:code(p.origem,/^[0-8]$/,'origem'+label),icms_situacao_tributaria:icms,
   pis_situacao_tributaria:code(p.cst_pis,/^\d{2}$/,'CST PIS'+label),cofins_situacao_tributaria:code(p.cst_cofins,/^\d{2}$/,'CST COFINS'+label),inclui_no_total:1}
 })
 const gross=items.reduce((sum,i)=>sum+cash(i.valor_bruto),0),discount=items.reduce((sum,i)=>sum+cash(i.valor_desconto),0),total=cash(Number(v.total))
 if(total<=0||total!==gross-discount)throw Error('O total da venda diverge dos itens e descontos. Revise a venda antes de emitir.')

 const paymentMap:Record<string,string>={dinheiro:'01',cartao:'03',boleto:'15',pix:'20'}
 const fiscalPayment=paymentMap[String(v.forma_pagamento)]||'91'
 const payload:Record<string,unknown>={...c,
  nome_emitente:required(source.empresa?.razao_social,'razão social nas configurações da empresa'),
  natureza_operacao:'Venda de mercadoria',data_emissao:now.toISOString(),tipo_documento:1,
  local_destino:sameState?1:2,finalidade_emissao:1,
  consumidor_final:client.consumidor_final?1:0,
  presenca_comprador:presenca,
  nome_destinatario:'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
  [doc.length===14?'cnpj_destinatario':'cpf_destinatario']:doc,
  logradouro_destinatario:required(client.logradouro,'logradouro no cadastro do cliente'),numero_destinatario:required(client.numero,'número no cadastro do cliente'),
  bairro_destinatario:required(client.bairro,'bairro no cadastro do cliente'),municipio_destinatario:required(client.municipio,'município no cadastro do cliente'),
  codigo_municipio_destinatario:code(client.codigo_municipio,/^\d{7}$/,'código IBGE no cadastro do cliente'),uf_destinatario:destUf,
  cep_destinatario:code(digits(client.cep),/^\d{8}$/,'CEP no cadastro do cliente'),
  indicador_inscricao_estadual_destinatario:indicadorIe,
  modalidade_frete:9,valor_produtos:gross/100,valor_desconto:discount/100,valor_total:total/100,itens:items,
  formas_pagamento:[{forma_pagamento:fiscalPayment,indicador_pagamento:Number(v.parcelas)>1?1:0,valor_pagamento:total/100}]}
 if(indicadorIe==='1')payload.inscricao_estadual_destinatario=required(client.inscricao_estadual,'inscrição estadual no cadastro do cliente')
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
