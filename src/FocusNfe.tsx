import {useCallback,useEffect,useState} from 'react'
import type {FormEvent} from 'react'
import {supabase,supabasePublishableKey,supabaseUrl} from './lib/supabase'

type Fields=Record<string,string>
type Draft={destinatario:Fields;itens:Record<string,Fields>;natureza_operacao:string;consumidor_final:string;presenca_comprador:string;forma_pagamento:string;modalidade_frete?:number|string;observacao_nfe?:string}
type Note={id:string;status:string;dados_fiscais:Draft;payload:unknown;retorno:Record<string,unknown>;referencia:string;updated_at:string}
type Source={venda:{status:string;total:number;forma_pagamento:string;subtotal?:number;desconto?:number;created_at?:string;fatura_numero?:number|null};cliente:{nome:string;documento:string;logradouro?:string|null;numero?:string|null;bairro?:string|null;municipio?:string|null;uf?:string|null;cep?:string|null;inscricao_estadual?:string|null}|null;empresa?:Record<string,unknown>|null;itens:{id:string;quantidade:number;valor_unitario:number;desconto:number;total?:number;produto:{descricao:string;codigo:string;unidade?:string|null;ncm?:string|null;cfop_interno?:string|null;cfop_interestadual?:string|null;cst_icms?:string|null}}[];nota:Note|null}
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
const labels:Record<string,string>={rascunho:'Rascunho',enviando:'Enviando',processando_autorizacao:'Aguardando autorização',autorizado:'Autorizada em teste',erro_autorizacao:'Erro de autorização',rejeitado:'Rejeitada',incerto:'Resposta não confirmada',nao_encontrado:'Não localizada na Focus',cancelado:'Cancelada',denegado:'Denegada'}
type FiscalClient={nome:string;documento:string;logradouro?:string|null;numero?:string|null;bairro?:string|null;municipio?:string|null;codigo_municipio?:string|null;uf?:string|null;cep?:string|null;indicador_ie?:string|null;inscricao_estadual?:string|null;consumidor_final?:boolean|null;presenca_comprador?:number|null}
type FiscalProduct={descricao:string;codigo:string;ncm?:string|null;cfop_interno?:string|null;cfop_interestadual?:string|null;origem?:number|null;cst_icms?:string|null;cst_pis?:string|null;cst_cofins?:string|null}
type SaleSource={venda:{status:string;total:number;forma_pagamento:string;subtotal?:number;desconto?:number;created_at?:string;fatura_numero?:number|null};cliente: FiscalClient|null;empresa?:Record<string,unknown>|null;itens:{id:string;quantidade:number;valor_unitario:number;desconto:number;total?:number;produto: FiscalProduct&{unidade?:string|null}}[];nota:Note|null}

function clientMissing(client: FiscalClient|null){
 if(!client)return ['cliente vinculado']
 const fields:[keyof FiscalClient,string][]=[
  ['documento','CPF/CNPJ'],['logradouro','logradouro'],['numero','número'],['bairro','bairro'],['municipio','município'],
  ['codigo_municipio','código IBGE'],['uf','UF'],['cep','CEP'],['indicador_ie','situação da inscrição estadual'],['presenca_comprador','presença do comprador']
 ]
 const missing=fields.filter(([key])=>client[key]==null||String(client[key]).trim()==='').map(([,label])=>label)
 if(client.indicador_ie==='1'&&!client.inscricao_estadual?.trim())missing.push('inscrição estadual')
 return missing
}
function productMissing(product: FiscalProduct){
 const fields:[keyof FiscalProduct,string][]=[
  ['ncm','NCM'],['cfop_interno','CFOP interno'],['cfop_interestadual','CFOP interestadual'],['origem','origem'],
  ['cst_icms','CST/CSOSN'],['cst_pis','CST PIS'],['cst_cofins','CST COFINS']
 ]
 return fields.filter(([key])=>product[key]==null||String(product[key]).trim()==='').map(([,label])=>label)
}

export function FocusNfeSale({saleId}:{saleId:string}){
 const [opened,setOpened]=useState(false),[source,setSource]=useState<SaleSource|null>(null),[note,setNote]=useState<Note|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[configured,setConfigured]=useState(false)
 const [emitModal,setEmitModal]=useState(false),[freightMode,setFreightMode]=useState('9'),[nfeObservation,setNfeObservation]=useState('')
 const load=useCallback(async()=>{
  setBusy(true);setError('')
  try{const r=await focus('sale',{venda_id:saleId});setSource(r.source);setNote(r.source.nota);setConfigured(r.configured)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 },[saleId])
 useEffect(()=>{if(opened)void load()},[opened,load])

 const missingClient=clientMissing(source?.cliente??null)
 const missingProducts=(source?.itens??[]).map((item,index)=>({index:index+1,name:item.produto.descricao,missing:productMissing(item.produto)})).filter(x=>x.missing.length>0)
 const cadastroCompleto=!!source&&missingClient.length===0&&missingProducts.length===0
 const vendaLiberada=!!source&&['pedido','faturado'].includes(source.venda.status)

 async function act(action:'emit'|'consult'){
  if(busy)return
  if(action==='emit'&&!window.confirm('Enviar esta venda para emitir uma NF-e de TESTE, sem valor fiscal?'))return
  setBusy(true);setError('');setMessage('')
  try{
   const r=await focus(action,{venda_id:saleId,dados_fiscais:action==='emit'?{modalidade_frete:Number(freightMode),observacao_nfe:nfeObservation.trim()}:{}})
   setNote(r.nota??r)
   setMessage(r.message??(action==='emit'?'Solicitação enviada em homologação. Consulte a situação para acompanhar.':'Situação atualizada.'))
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function previewDanfe(){
  if(!source)return
  setBusy(true);setError('')
  try{
   const payload=(note?.payload&&typeof note.payload==='object'&&!Array.isArray(note.payload)?note.payload:{}) as Record<string,unknown>
   ;(await import('./lib/danfePreviewPdf')).generateDanfePreviewPdf({
    venda:source.venda,
    cliente:source.cliente,
    empresa:source.empresa as any,
    itens:source.itens as any,
    payload,
    referencia:note?.referencia||null
   })
  }catch(e){setError((e as Error).message||'Não foi possível gerar a prévia DANFE.')}finally{setBusy(false)}
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

 return <section className="fiscalPanel">
  <button type="button" className="ghost" onClick={()=>setOpened(!opened)} aria-expanded={opened}>NF-e de teste · {opened?'recolher':'abrir emissão'}</button>
  {opened&&<div className="fiscalSaleCompact">
   <h4>NF-e · homologação, sem valor fiscal</h4>
   <p>Os dados fiscais são lidos automaticamente dos cadastros do cliente e dos produtos. A venda não repete esses campos.</p>
   {error&&<p role="alert" className="fiscalError">{error}</p>}
   {message&&<p role="status">{message}</p>}
   {note&&<div className="fiscalStatusBox">
    <p><strong>{labels[note.status]??note.status}</strong> · Referência: {note.referencia}</p>
    {note.retorno.mensagem_sefaz!=null&&<p>SEFAZ: {String(note.retorno.status_sefaz??'')} · {String(note.retorno.mensagem_sefaz)}</p>}
    {note.retorno.mensagem!=null&&<p>{String(note.retorno.mensagem)}</p>}
    {Array.isArray(note.retorno.erros)&&<ul>{note.retorno.erros.map((e,i)=><li key={i}>{typeof e==='object'&&e?String((e as {mensagem?:string}).mensagem??JSON.stringify(e)):String(e)}</li>)}</ul>}
    {note.retorno.chave_nfe!=null&&<p>Chave: {String(note.retorno.chave_nfe)}</p>}
   </div>}
   {!source&&<button type="button" className="ghost" disabled={busy} onClick={()=>void load()}>Carregar dados fiscais</button>}
   {source&&<>
    <div className="fiscalSourceSummary">
      <div><span>Cliente</span><strong>{source.cliente?.nome??'Não informado'}</strong></div>
      <div><span>Documento</span><strong>{source.cliente?.documento??'Não informado'}</strong></div>
      <div><span>Total</span><strong>{Number(source.venda.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div>
      <div><span>Itens</span><strong>{source.itens.length}</strong></div>
    </div>
    {!configured&&<p className="fiscalError">Cadastre o token em Configurações → Focus NFe para habilitar os envios.</p>}
    {!cadastroCompleto&&<div className="fiscalCadastroWarning">
      <strong>Cadastro fiscal incompleto</strong>
      {missingClient.length>0&&<p>Cliente: complete {missingClient.join(', ')} no cadastro do cliente.</p>}
      {missingProducts.map(item=><p key={item.index}>Produto {item.index} — {item.name}: complete {item.missing.join(', ')} no cadastro do produto.</p>)}
    </div>}
    {cadastroCompleto&&<p className="fiscalCadastroOk">Cadastros fiscal do cliente e dos produtos completos para emissão.</p>}
    {!vendaLiberada&&<div className="fiscalCadastroWarning" role="alert">
      <strong>Bloqueio comercial: venda ainda está como orçamento</strong>
      <p>Confirme a venda como <strong>Pedido</strong> ou <strong>Faturado</strong> para liberar a emissão da NF-e de teste.</p>
    </div>}
    <div className="formActions">
      <button type="button" className="primary" disabled={busy||!configured||!cadastroCompleto||!vendaLiberada} title={!vendaLiberada?'Confirme o pedido antes de emitir a NF-e de teste.':undefined} onClick={()=>setEmitModal(true)}>Emitir NF-e de teste</button>
      <button type="button" className="ghost" disabled={busy} onClick={()=>void load()}>Recarregar cadastros</button>
      {!!note?.payload&&<button type="button" className="ghost" disabled={busy} onClick={()=>void act('consult')}>Consultar situação</button>}
      <button type="button" className="ghost" disabled={busy||!source} onClick={()=>void previewDanfe()}>Prévia DANFE</button>
      {note?.status==='autorizado'&&<><button type="button" className="ghost" disabled={busy} onClick={()=>void download('danfe')}>DANFE de teste</button><button type="button" className="ghost" disabled={busy} onClick={()=>void download('xml')}>XML de teste</button></>}
    </div>
   </>}
   {busy&&<p role="status">Processando…</p>}
   {emitModal&&<div className="saleModalOverlay nfeEmissionOverlay" role="dialog" aria-modal="true" aria-label="Emitir NF-e de teste">
    <div className="saleModalShell nfeEmissionShell">
      <div className="panel nfeEmissionPanel">
        <div className="formTitle saleModalTitle"><div><h3>Emitir NF-e de teste</h3><p>Confira o frete e informe a observação antes de enviar para homologação.</p></div><button type="button" className="iconBtn saleModalClose" onClick={()=>setEmitModal(false)}>×</button></div>
        <div className="nfeEmissionSummary">
          <div><span>Cliente</span><strong>{source?.cliente?.nome??'—'}</strong></div>
          <div><span>Total</span><strong>{Number(source?.venda.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div>
          <div><span>Itens</span><strong>{source?.itens.length??0}</strong></div>
        </div>
        <label className="fieldLabel">Modelo de frete
          <select value={freightMode} onChange={e=>setFreightMode(e.target.value)}>
            <option value="9">9 · Sem frete</option>
            <option value="0">0 · Por conta do emitente</option>
            <option value="1">1 · Por conta do destinatário</option>
            <option value="2">2 · Por conta de terceiros</option>
            <option value="3">3 · Transporte próprio do emitente</option>
            <option value="4">4 · Transporte próprio do destinatário</option>
          </select>
        </label>
        <label className="fieldLabel">Observação na NF-e
          <textarea value={nfeObservation} onChange={e=>setNfeObservation(e.target.value)} maxLength={5000} placeholder="Informações adicionais que devem constar na NF-e"/>
        </label>
        <div className="nfeEmissionHint">A observação será enviada como informação adicional do contribuinte.</div>
        <div className="formActions">
          <button type="button" className="ghost" onClick={()=>setEmitModal(false)}>Cancelar</button>
          <button type="button" className="primary" disabled={busy} onClick={()=>{setEmitModal(false);void act('emit')}}>Confirmar emissão</button>
        </div>
      </div>
    </div>
   </div>}
  </div>}
 </section>
}
