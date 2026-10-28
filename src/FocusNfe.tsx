import {useCallback,useEffect,useState} from 'react'
import type {FormEvent} from 'react'
import {supabase,supabasePublishableKey,supabaseUrl} from './lib/supabase'

type Fields=Record<string,string>
type Draft={destinatario:Fields;itens:Record<string,Fields>;natureza_operacao:string;consumidor_final:string;presenca_comprador:string;forma_pagamento:string}
type Note={id:string;status:string;dados_fiscais:Draft;payload:unknown;retorno:Record<string,unknown>;referencia:string;updated_at:string}
type Source={venda:{status:string;total:number;forma_pagamento:string};cliente:{nome:string;documento:string}|null;itens:{id:string;quantidade:number;valor_unitario:number;desconto:number;produto:{descricao:string;codigo:string}}[];nota:Note|null}
async function focus(action:string,body:Record<string,unknown>={}){
 const r=await supabase.functions.invoke('focus-nfe',{body:{action,...body}})
 if(r.error){
  let message='Não foi possível acessar a integração. Entre novamente e tente atualizar.'
  try{const detail=await r.error.context?.json();if(detail?.error)message=detail.error}catch{/* Keep a safe connection message. */}
  throw Error(message)
 }
 if(r.data?.error)throw Error(r.data.error)
 return r.data
}
function FieldsForm({fields,value,onChange,required=false}:{fields:[string,string,string?][];value:Fields;onChange:(next:Fields)=>void;required?:boolean}){
 return <div className="fiscalGrid">{fields.map(([key,label,hint])=><label className="fieldLabel" key={key}>{label}<input required={required} value={value[key]??''} onChange={e=>onChange({...value,[key]:e.target.value})} placeholder={hint}/></label>)}</div>
}
const addressFields:[string,string,string?][]=[['logradouro','Logradouro'],['numero','Número'],['bairro','Bairro'],['municipio','Município'],['codigo_municipio','Código IBGE do município','7 dígitos'],['uf','UF','Ex.: SP'],['cep','CEP','8 dígitos']]
export function FocusNfeSettings(){
 const [config,setConfig]=useState<Fields>({}),[token,setToken]=useState(''),[configured,setConfigured]=useState(false),[busy,setBusy]=useState(true),[loaded,setLoaded]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 const load=useCallback(async()=>{
  setBusy(true);setError('')
  try{const r=await focus('config');setConfig(r.config);setConfigured(r.configured);setLoaded(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 },[])
 useEffect(()=>{void load()},[load])
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('')
  try{const r=await focus('save_config',{config,token});setConfigured(r.configured);setToken('');setMessage('Configuração de homologação salva. Agora teste a conexão.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function test(){setBusy(true);setError('');setMessage('')
  try{const r=await focus('test');setMessage(r.message)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const address=Object.fromEntries(addressFields.map(([key])=>[key,config[key+'_emitente']??'']))
 return <section className="panel fiscalPanel"><div className="panelHead"><div><h3>Focus NFe · ambiente de testes</h3><p>Homologação: documentos sem valor fiscal. Disponível somente para o administrador.</p></div><button type="button" className="ghost" disabled={busy} onClick={()=>void load()}>Atualizar</button></div>
 {error&&<p role="alert" className="fiscalError">{error}</p>}{message&&<p role="status">{message}</p>}
 {loaded&&<form onSubmit={save}><fieldset disabled={busy}>
 <p>Token de homologação: <strong>{configured?'cadastrado e protegido':'ainda não cadastrado'}</strong>. Cadastre a empresa e habilite os testes no painel da Focus. O ERP não cria nem altera empresas na Focus.</p>
 <label className="fieldLabel">Token de homologação da empresa<input type="password" autoComplete="new-password" spellCheck={false} value={token} required={!configured} maxLength={256} onChange={e=>setToken(e.target.value.trim())} placeholder={configured?'Deixe vazio para manter o token atual':'Cole aqui o token de homologação'}/></label>
 <FieldsForm required fields={[['cnpj_emitente','CNPJ emitente'],['inscricao_estadual_emitente','Inscrição estadual emitente']]} value={config} onChange={setConfig}/>
 <label className="fieldLabel">Regime tributário<select required value={config.regime_tributario_emitente??''} onChange={e=>setConfig({...config,regime_tributario_emitente:e.target.value})}><option value="">Selecione conforme o cadastro fiscal</option><option value="1">1 · Simples Nacional</option><option value="2">2 · Simples Nacional, excesso de sublimite</option><option value="3">3 · Regime normal</option><option value="4">4 · MEI</option></select></label>
 <h4>Endereço fiscal do emitente</h4>
 <FieldsForm required fields={addressFields} value={address} onChange={a=>setConfig({...config,...Object.fromEntries(Object.entries(a).map(([key,v])=>[key+'_emitente',v]))})}/>
 <p>A razão social será lida das configurações da empresa. Confira certificado e habilitação de NF-e no painel da Focus.</p>
 <div className="formActions"><button className="primary" type="submit">Salvar integração de testes</button><button className="ghost" type="button" disabled={!configured||!!token} onClick={()=>void test()}>Testar conexão salva</button></div>
 </fieldset></form>}
 </section>
}
const blankDraft=():Draft=>({destinatario:{},itens:{},natureza_operacao:'Venda de mercadoria',consumidor_final:'',presenca_comprador:'',forma_pagamento:''})
const labels:Record<string,string>={rascunho:'Rascunho',enviando:'Enviando',processando_autorizacao:'Aguardando autorização',autorizado:'Autorizada em teste',erro_autorizacao:'Erro de autorização',rejeitado:'Rejeitada',incerto:'Resposta não confirmada',nao_encontrado:'Não localizada na Focus',cancelado:'Cancelada',denegado:'Denegada'}
export function FocusNfeSale({saleId}:{saleId:string}){
 const [opened,setOpened]=useState(false),[source,setSource]=useState<Source|null>(null),[draft,setDraft]=useState<Draft>(blankDraft),[note,setNote]=useState<Note|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[configured,setConfigured]=useState(false)
 const load=useCallback(async()=>{
  setBusy(true);setError('')
  try{const r=await focus('sale',{venda_id:saleId});setSource(r.source);setNote(r.source.nota);setConfigured(r.configured);setDraft(r.source.nota?.dados_fiscais??blankDraft())}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 },[saleId])
 useEffect(()=>{if(opened)void load()},[opened,load])
 const locked=!!note&&!['rascunho','erro_autorizacao','rejeitado'].includes(note.status)
 async function act(action:'draft'|'emit'|'consult'){
  if(busy)return
  if(action==='emit'&&!window.confirm('Enviar esta venda para emitir uma NF-e de TESTE, sem valor fiscal?'))return
  setBusy(true);setError('');setMessage('')
  try{const r=await focus(action,{venda_id:saleId,dados_fiscais:draft});setNote(r.nota??r);setMessage(r.message??(action==='draft'?'Rascunho fiscal salvo.':action==='emit'?'Solicitação enviada em homologação. Consulte a situação para acompanhar.':'Situação atualizada.'))}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function download(kind:'xml'|'danfe'){
  setBusy(true);setError('')
  try{
   const {data}=await supabase.auth.getSession()
   const r=await fetch(supabaseUrl+'/functions/v1/focus-nfe',{method:'POST',headers:{Authorization:'Bearer '+data.session?.access_token,apikey:supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'download',venda_id:saleId,kind})})
   if(!r.ok){const detail=await r.json();throw Error(detail.error??'Arquivo indisponível.')}
   const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='nfe-teste-'+(note?.retorno.numero??saleId)+'.'+(kind==='xml'?'xml':'pdf');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function itemChange(id:string,value:Fields){setDraft({...draft,itens:{...draft.itens,[id]:value}})}
 return <section className="fiscalPanel"><button type="button" className="ghost" onClick={()=>setOpened(!opened)} aria-expanded={opened}>NF-e de teste · {opened?'recolher':'abrir emissão'}</button>
 {opened&&<div><h4>NF-e · homologação, sem valor fiscal</h4><p>Esta emissão usa os valores salvos da venda e não movimenta estoque nem financeiro.</p>
 {error&&<p role="alert" className="fiscalError">{error}</p>}{message&&<p role="status">{message}</p>}
 {note&&<><p><strong>{labels[note.status]??note.status}</strong> · Referência: {note.referencia}</p>
 {note.retorno.mensagem_sefaz!=null&&<p>SEFAZ: {String(note.retorno.status_sefaz??'')} · {String(note.retorno.mensagem_sefaz)}</p>}
 {note.retorno.mensagem!=null&&<p>{String(note.retorno.mensagem)}</p>}
 {Array.isArray(note.retorno.erros)&&<ul>{note.retorno.erros.map((e,i)=><li key={i}>{typeof e==='object'&&e?String((e as {mensagem?:string}).mensagem??JSON.stringify(e)):String(e)}</li>)}</ul>}
 {note.retorno.chave_nfe!=null&&<p>Chave: {String(note.retorno.chave_nfe)}</p>}</>}
 {!source&&<button type="button" className="ghost" disabled={busy} onClick={()=>void load()}>Carregar dados fiscais</button>}
 {source&&<><p>Cliente: {source.cliente?.nome??'Não informado'} · Documento: {source.cliente?.documento??'Não informado'} · Total: {Number(source.venda.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
 {!configured&&<p>Cadastre o token em Configurações → Focus NFe para habilitar os envios.</p>}
 <form onSubmit={e=>{e.preventDefault();void act('emit')}}><fieldset disabled={busy||locked}>
 <label className="fieldLabel">Natureza da operação<input required maxLength={60} value={draft.natureza_operacao} onChange={e=>setDraft({...draft,natureza_operacao:e.target.value})}/></label>
 <div className="fiscalGrid">
 <label className="fieldLabel">Consumidor final<select required value={draft.consumidor_final} onChange={e=>setDraft({...draft,consumidor_final:e.target.value})}><option value="">Selecione</option><option value="1">Sim</option><option value="0">Não</option></select></label>
 <label className="fieldLabel">Presença do comprador<select required value={draft.presenca_comprador} onChange={e=>setDraft({...draft,presenca_comprador:e.target.value})}><option value="">Selecione</option><option value="1">Presencial</option><option value="2">Internet</option><option value="3">Teleatendimento</option><option value="5">Presencial fora do estabelecimento</option><option value="9">Não presencial, outros</option></select></label>
 <label className="fieldLabel">Pagamento fiscal<select required value={draft.forma_pagamento} onChange={e=>setDraft({...draft,forma_pagamento:e.target.value})}><option value="">Selecione</option><option value="01">Dinheiro</option><option value="03">Cartão de crédito</option><option value="04">Cartão de débito</option><option value="15">Boleto</option><option value="17">PIX dinâmico</option><option value="20">PIX estático</option><option value="91">Pagamento posterior</option></select></label>
 </div><h4>Endereço fiscal do cliente</h4>
 <FieldsForm required fields={addressFields} value={draft.destinatario} onChange={v=>setDraft({...draft,destinatario:v})}/>
 <label className="fieldLabel">Inscrição estadual do cliente<select required value={draft.destinatario.indicador_ie??''} onChange={e=>setDraft({...draft,destinatario:{...draft.destinatario,indicador_ie:e.target.value}})}><option value="">Selecione</option><option value="1">Contribuinte com IE</option><option value="2">Contribuinte isento</option><option value="9">Não contribuinte</option></select></label>
 {draft.destinatario.indicador_ie==='1'&&<FieldsForm required fields={[['ie','Inscrição estadual']]} value={draft.destinatario} onChange={v=>setDraft({...draft,destinatario:v})}/>}
 <h4>Tributação dos itens</h4><p>Informe os códigos indicados pelo contador. Operação nacional, sem frete ou tributos que alterem o total comercial nesta primeira versão de testes.</p>
 {source.itens.map((i,index)=><div className="fiscalItem" key={i.id}><strong>{index+1}. {i.produto.descricao}</strong><p>{i.quantidade} × {Number(i.valor_unitario).toFixed(2)} · desconto {Number(i.desconto).toFixed(2)}</p>
 <FieldsForm required fields={[['ncm','NCM','8 dígitos'],['cfop','CFOP','4 dígitos'],['origem','Origem','0 a 8'],['icms','CST / CSOSN'],['pis','CST PIS'],['cofins','CST COFINS']]} value={draft.itens[i.id]??{}} onChange={v=>itemChange(i.id,v)}/>
 <details><summary>Complementos tributários do item</summary><p>Campos da Focus em JSON, revisados pelo contador. Somente campos de impostos são aceitos.</p><textarea aria-label={'Complementos tributários do item '+(index+1)} value={draft.itens[i.id]?.complemento??''} onChange={e=>itemChange(i.id,{...draft.itens[i.id],complemento:e.target.value})} placeholder='{}'/></details>
 </div>)}
 <div className="formActions"><button type="button" className="ghost" onClick={()=>void act('draft')}>Salvar rascunho fiscal</button><button className="primary" type="submit" disabled={!configured||!['pedido','faturado'].includes(source.venda.status)}>Emitir NF-e de teste</button></div>
 </fieldset></form>
 {note?.status==='nao_encontrado'&&<button type="button" className="primary" disabled={busy||!configured} onClick={()=>void act('emit')}>Reenviar solicitação original de teste</button>}
 <div className="formActions"><button type="button" className="ghost" disabled={busy} onClick={()=>void load()}>Recarregar dados salvos</button>{!!note?.payload&&<button type="button" className="ghost" disabled={busy} onClick={()=>void act('consult')}>Consultar situação na Focus</button>}{note?.status==='autorizado'&&<><button type="button" className="ghost" disabled={busy} onClick={()=>void download('danfe')}>DANFE de teste</button><button type="button" className="ghost" disabled={busy} onClick={()=>void download('xml')}>XML de teste</button></>}</div>
 </>}
 {busy&&<p role="status">Processando…</p>}
 </div>}</section>
}
