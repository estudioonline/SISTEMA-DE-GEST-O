import {useCallback,useEffect,useState} from 'react'
import type {FormEvent} from 'react'
import {supabase,supabasePublishableKey,supabaseUrl} from './lib/supabase'

type Fields=Record<string,string>
type Draft={destinatario:Fields;itens:Record<string,Fields>;natureza_operacao:string;consumidor_final:string;presenca_comprador:string;forma_pagamento:string;modalidade_frete?:number|string;observacao_nfe?:string;parcelas?:{numero?:number;vencimento:string;valor:number}[];volumes?:{quantidade:number;peso_liquido?:number;peso_bruto?:number}[]}
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
const localIsoDate=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})
type FiscalClient={nome:string;documento:string;logradouro?:string|null;numero?:string|null;bairro?:string|null;municipio?:string|null;codigo_municipio?:string|null;uf?:string|null;cep?:string|null;indicador_ie?:string|null;inscricao_estadual?:string|null;consumidor_final?:boolean|null;presenca_comprador?:number|null}
type FiscalProduct={descricao:string;codigo:string;ncm?:string|null;cfop_interno?:string|null;cfop_interestadual?:string|null;origem?:number|null;cst_icms?:string|null;cst_pis?:string|null;cst_cofins?:string|null}
type SaleSource={venda:{status:string;total:number;forma_pagamento:string;subtotal?:number;desconto?:number;created_at?:string;fatura_numero?:number|null};cliente: FiscalClient|null;empresa?:Record<string,unknown>|null;itens:{id:string;quantidade:number;valor_unitario:number;desconto:number;total?:number;produto: FiscalProduct&{unidade?:string|null}}[];parcelas?:{id:string;numero:number;vencimento:string;valor:number;status:string}[];nota:Note|null}

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
 const [cancelModal,setCancelModal]=useState(false),[cancelReason,setCancelReason]=useState('')
 const [nfeInstallments,setNfeInstallments]=useState<{key:string;numero:number;vencimento:string;valor:number}[]>([])
 const [nfeVolumes,setNfeVolumes]=useState<{key:string;quantidade:number;peso_liquido:number;peso_bruto:number}[]>([{key:'volume-1',quantidade:1,peso_liquido:0,peso_bruto:0}])
 const load=useCallback(async()=>{
  setBusy(true);setError('')
  try{
   const r=await focus('sale',{venda_id:saleId})
   setSource(r.source);setNote(r.source.nota);setConfigured(r.configured)
   setNfeInstallments((r.source.parcelas||[]).map((p:any,index:number)=>({key:String(p.id||index),numero:Number(p.numero||index+1),vencimento:String(p.vencimento||''),valor:Number(p.valor||0)})))
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 },[saleId])
 useEffect(()=>{if(opened)void load()},[opened,load])

 const missingClient=clientMissing(source?.cliente??null)
 const missingProducts=(source?.itens??[]).map((item,index)=>({index:index+1,name:item.produto.descricao,missing:productMissing(item.produto)})).filter(x=>x.missing.length>0)
 const cadastroCompleto=!!source&&missingClient.length===0&&missingProducts.length===0
 const vendaLiberada=!!source&&['pedido','faturado'].includes(source.venda.status)

 async function act(action:'emit'|'consult'){
  if(busy)return
  setBusy(true);setError('');setMessage('')
  try{
   const dadosFiscais=action==='emit'?{
    modalidade_frete:Number(freightMode),
    observacao_nfe:nfeObservation.trim(),
    parcelas:nfeInstallments.map((p,index)=>({numero:index+1,vencimento:p.vencimento,valor:Number(p.valor)})),
    volumes:nfeVolumes.map(v=>({quantidade:Number(v.quantidade),peso_liquido:Number(v.peso_liquido),peso_bruto:Number(v.peso_bruto)}))
   }:{}
   const r=await focus(action,{venda_id:saleId,dados_fiscais:dadosFiscais})
   setNote(r.nota??r)
   setMessage(r.message??(action==='emit'?'Solicitação enviada em homologação. Consulte a situação para acompanhar.':'Situação atualizada.'))
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function cancelNfe(){
  if(busy||note?.status!=='autorizado')return
  const motivo=cancelReason.trim()
  if(motivo.length<15||motivo.length>255){setError('A justificativa deve ter entre 15 e 255 caracteres.');return}
  setBusy(true);setError('');setMessage('')
  try{
   const r=await focus('cancel',{venda_id:saleId,justificativa:motivo})
   setNote(r.nota??r)
   setMessage(r.message??'NF-e cancelada.')
   setCancelModal(false)
   setCancelReason('')
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function previewDanfe(){
  if(!source)return
  setBusy(true);setError('')
  try{
   const {data}=await supabase.auth.getSession()
   const dadosFiscais={
    modalidade_frete:Number(freightMode),
    observacao_nfe:nfeObservation.trim(),
    parcelas:nfeInstallments.map((p,index)=>({numero:index+1,vencimento:p.vencimento,valor:Number(p.valor)})),
    volumes:nfeVolumes.map(v=>({quantidade:Number(v.quantidade),peso_liquido:Number(v.peso_liquido),peso_bruto:Number(v.peso_bruto)}))
   }
   const r=await fetch(supabaseUrl+'/functions/v1/focus-nfe',{method:'POST',headers:{Authorization:'Bearer '+data.session?.access_token,apikey:supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'preview',venda_id:saleId,dados_fiscais:dadosFiscais})})
   if(!r.ok){const detail=await r.json().catch(()=>({}));throw Error(detail.error??'Não foi possível gerar a prévia DANFE na Focus.')}
   const url=URL.createObjectURL(await r.blob()),a=document.createElement('a')
   a.href=url
   a.download='danfe-previa-focus-'+String(note?.retorno.numero??source.venda.fatura_numero??saleId)+'.pdf'
   a.click()
   setTimeout(()=>URL.revokeObjectURL(url),1000)
  }catch(e){setError((e as Error).message||'Não foi possível gerar a prévia DANFE na Focus.')}finally{setBusy(false)}
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
  <button type="button" className="primary nfeOpenWorkspaceBtn" onClick={()=>setOpened(true)} aria-expanded={opened}>Emitir Nota Fiscal</button>
  {opened&&<div className="saleModalOverlay nfeWorkspaceOverlay" role="dialog" aria-modal="true" aria-label="Emitir Nota Fiscal">
   <div className="saleModalShell nfeWorkspaceShell">
    <div className="panel nfeWorkspacePanel">
     <div className="formTitle saleModalTitle nfeWorkspaceHeader">
      <div><h3>Emitir Nota Fiscal</h3><p>Revise os dados fiscais, gere a prévia DANFE e envie a NF-e para homologação.</p></div>
      <button type="button" className="iconBtn saleModalClose" onClick={()=>setOpened(false)} aria-label="Fechar emissão de nota fiscal">×</button>
     </div>
     <div className="fiscalSaleCompact nfeWorkspaceContent">
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
      <button type="button" className="ghost" disabled={busy||!source||!configured||!cadastroCompleto||!vendaLiberada} title={!cadastroCompleto?'Complete os dados fiscais antes de gerar a prévia.':!vendaLiberada?'Confirme o pedido antes de gerar a prévia.':undefined} onClick={()=>void previewDanfe()}>Prévia DANFE</button>
      {note?.status==='autorizado'&&<><button type="button" className="ghost" disabled={busy} onClick={()=>void download('danfe')}>DANFE de teste</button><button type="button" className="ghost" disabled={busy} onClick={()=>void download('xml')}>XML de teste</button><button type="button" className="warningBtn" disabled={busy} onClick={()=>{setCancelReason('');setError('');setCancelModal(true)}}>Cancelar NF-e</button></>}
    </div>
   </>}
   {busy&&<p role="status">Processando…</p>}
   {cancelModal&&<div className="saleModalOverlay nfeEmissionOverlay" role="dialog" aria-modal="true" aria-labelledby="nfe-cancel-title">
    <div className="saleModalShell nfeCancelShell">
      <div className="panel nfeCancelPanel">
        <div className="formTitle saleModalTitle"><div><h3 id="nfe-cancel-title">Cancelar NF-e</h3><p>O cancelamento será enviado à SEFAZ e não poderá ser desfeito pelo SG.</p></div><button type="button" className="iconBtn saleModalClose" disabled={busy} onClick={()=>setCancelModal(false)}>×</button></div>
        <div className="fiscalCadastroWarning nfeCancelWarning" role="alert">
          <strong>Ação irreversível</strong>
          <p>Confirme somente se esta NF-e realmente deve ser cancelada.</p>
        </div>
        <label className="fieldLabel">Justificativa do cancelamento
          <textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} minLength={15} maxLength={255} placeholder="Informe o motivo do cancelamento (15 a 255 caracteres)" disabled={busy}/>
        </label>
        <div className="nfeCancelCounter"><span>{cancelReason.trim().length}/255 caracteres</span><small>Mínimo de 15 caracteres</small></div>
        <div className="formActions">
          <button type="button" className="ghost" disabled={busy} onClick={()=>setCancelModal(false)}>Voltar</button>
          <button type="button" className="dangerAction nfeCancelConfirm" disabled={busy||cancelReason.trim().length<15||cancelReason.trim().length>255} onClick={()=>void cancelNfe()}>{busy?'Cancelando...':'Confirmar cancelamento'}</button>
        </div>
      </div>
    </div>
   </div>}

   {emitModal&&<div className="saleModalOverlay nfeEmissionOverlay" role="dialog" aria-modal="true" aria-label="Emitir NF-e de teste">
    <div className="saleModalShell nfeEmissionShell">
      <div className="panel nfeEmissionPanel">
        <div className="formTitle saleModalTitle"><div><h3>Emitir NF-e de teste</h3><p>Confira o frete e informe a observação antes de enviar para homologação.</p></div><button type="button" className="iconBtn saleModalClose" onClick={()=>setEmitModal(false)}>×</button></div>
        <div className="nfeEmissionSummary">
          <div><span>Cliente</span><strong>{source?.cliente?.nome??'—'}</strong></div>
          <div><span>Total</span><strong>{Number(source?.venda.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div>
          <div><span>Itens</span><strong>{source?.itens.length??0}</strong></div>
        </div>
        <div className="nfeInstallmentsBox">
          <div className="nfeInstallmentsHead"><strong>Parcelas da cobrança</strong><span>{nfeInstallments.length} cobrança(s) nesta NF-e</span></div>
          <div className="nfeEditableInstallments">
            {nfeInstallments.length===0&&<p>Nenhuma cobrança será incluída nesta NF-e. A cobrança original da venda será preservada.</p>}
            {nfeInstallments.map((p,index)=><div className="nfeEditableInstallment" key={p.key}>
              <span>{String(index+1).padStart(3,'0')}</span>
              {source?.venda.forma_pagamento==='boleto'?<>
                <input type="date" value={p.vencimento} onChange={e=>setNfeInstallments(rows=>rows.map(row=>row.key===p.key?{...row,vencimento:e.target.value}:row))}/>
                <input type="number" min="0.01" step="0.01" value={p.valor} onChange={e=>setNfeInstallments(rows=>rows.map(row=>row.key===p.key?{...row,valor:Number(e.target.value)}:row))}/>
              </>:<>
                <span>{new Date(p.vencimento+'T12:00:00').toLocaleDateString('pt-BR')}</span>
                <strong>{Number(p.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong>
              </>}
              <button type="button" className="iconBtn" onClick={()=>setNfeInstallments(rows=>rows.filter(row=>row.key!==p.key))} aria-label="Remover cobrança" title="Remover cobrança desta NF-e">×</button>
            </div>)}
            {source?.venda.forma_pagamento==='boleto'&&<button type="button" className="ghost" onClick={()=>setNfeInstallments(rows=>[...rows,{key:crypto.randomUUID(),numero:rows.length+1,vencimento:rows.at(-1)?.vencimento||localIsoDate(),valor:0}])}>+ Adicionar parcela</button>}
            <small>Remover aqui afeta somente esta NF-e. A cobrança original da venda permanece no financeiro.</small>
            {source?.venda.forma_pagamento==='boleto'&&<small>A soma das parcelas incluídas precisa ser igual ao total da venda.</small>}
          </div>
        </div>
        <div className="nfeVolumesBox">
          <div className="nfeInstallmentsHead"><strong>Volumes transportados</strong><span>{nfeVolumes.length} volume(s)</span></div>
          <div className="nfeVolumesList">
            {nfeVolumes.map((volume,index)=><div className="nfeVolumeRow" key={volume.key}>
              <span>{index+1}</span>
              <label>Quantidade<input type="number" min="1" step="1" value={volume.quantidade} onChange={e=>setNfeVolumes(rows=>rows.map(row=>row.key===volume.key?{...row,quantidade:Number(e.target.value)}:row))}/></label>
              <label>Peso líquido (kg)<input type="number" min="0" step="0.001" value={volume.peso_liquido||''} onChange={e=>setNfeVolumes(rows=>rows.map(row=>row.key===volume.key?{...row,peso_liquido:Number(e.target.value)}:row))}/></label>
              <label>Peso bruto (kg)<input type="number" min="0" step="0.001" value={volume.peso_bruto||''} onChange={e=>setNfeVolumes(rows=>rows.map(row=>row.key===volume.key?{...row,peso_bruto:Number(e.target.value)}:row))}/></label>
              <button type="button" className="iconBtn" onClick={()=>setNfeVolumes(rows=>rows.length>1?rows.filter(row=>row.key!==volume.key):rows)} aria-label="Remover volume">×</button>
            </div>)}
            <button type="button" className="ghost" onClick={()=>setNfeVolumes(rows=>[...rows,{key:crypto.randomUUID(),quantidade:1,peso_liquido:0,peso_bruto:0}])}>+ Adicionar volume</button>
          </div>
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
     </div>
    </div>
   </div>
  </div>}
 </section>
}
