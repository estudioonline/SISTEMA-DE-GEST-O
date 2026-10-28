import {createClient} from 'npm:@supabase/supabase-js@2.75.0'
import {FOCUS_BASE,buildPayload,documentUrl,providerStatus,safeResult,validateConfig} from './fiscal.ts'
import type {FiscalDraft,SaleSource} from './fiscal.ts'

const allowedOrigins=new Set(['https://estudioonline.github.io','http://localhost:5173','http://127.0.0.1:5173'])
const json=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}})
const secretKey=()=>{const keys=Deno.env.get('SUPABASE_SECRET_KEYS');return keys?JSON.parse(keys).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')??''
 const cors:Record<string,string>={'Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
 if(allowedOrigins.has(origin))cors['Access-Control-Allow-Origin']=origin
 if(origin&&!allowedOrigins.has(origin))return json({error:'Origem não permitida.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='POST')return json({error:'Método não permitido.'},405,cors)
 try{
  const bearer=req.headers.get('Authorization')??''
  if(!bearer.startsWith('Bearer '))return json({error:'Entre novamente no sistema.'},401,cors)
  const db=createClient(Deno.env.get('SUPABASE_URL')!,secretKey()!,{auth:{persistSession:false,autoRefreshToken:false}})
  const auth=await db.auth.getUser(bearer.slice(7))
  if(auth.error||!auth.data.user)return json({error:'Sessão inválida. Entre novamente.'},401,cors)
  const actor=auth.data.user.id
  const profile=await db.from('profiles').select('perfil,ativo').eq('id',actor).single()
  if(profile.error||profile.data?.perfil!=='administrador'||!profile.data?.ativo)return json({error:'A integração de testes é exclusiva do administrador.'},403,cors)
  const raw=await req.text()
  if(raw.length>100000)return json({error:'Solicitação muito grande.'},413,cors)
  const body=JSON.parse(raw)
  async function rpc(action:string,data:Record<string,unknown>={}){
   const r=await db.rpc('focus_backend_erp',{p_action:action,p_actor:actor,p_data:data})
   if(r.error)throw Error(r.error.message)
   return r.data
  }
  const credentials=await rpc('config')
  if(body.action==='config')return json({config:credentials.config,configured:!!credentials.token,ambiente:'homologacao'},200,cors)
  if(body.action==='save_config'){
   const config=validateConfig(body.config)
   const saved=await rpc('save_config',{config,token:typeof body.token==='string'?body.token:''})
   return json({config:saved.config,configured:!!saved.token,ambiente:'homologacao'},200,cors)
  }
  const token=credentials.token
  const fetchFocus=async(path:string,method='GET',payload?:unknown)=>{
   if(!token)throw Error('Cadastre o token de homologação em Configurações → Focus NFe.')
   try{
    return await fetch(FOCUS_BASE+path,{method,headers:{Authorization:'Basic '+btoa(token+':'),'Content-Type':'application/json',Accept:'application/json'},
     ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(25000),redirect:'error'})
   }catch{throw Error('Não foi possível obter resposta da Focus. Consulte a situação antes de tentar reenviar.')}
  }
  if(body.action==='test'){
   const r=await fetchFocus('/v2/nfe/erp-validacao-token-inexistente')
   if(r.status!==200&&r.status!==404)throw Error(r.status===401||r.status===403?'Token recusado pela Focus no ambiente de homologação.':'A Focus não confirmou a conexão (HTTP '+r.status+').')
   return json({message:'Autenticação aceita em homologação. O CNPJ e a habilitação fiscal serão verificados na emissão de teste.'},200,cors)
  }
  if(!/^[a-f0-9-]{36}$/i.test(String(body.venda_id)))throw Error('Venda inválida.')
  const source=await rpc('sale',{venda_id:body.venda_id}) as SaleSource
  if(body.action==='sale')return json({source,config:credentials.config,configured:!!token},200,cors)
  const draft=(body.dados_fiscais??{}) as FiscalDraft
  if(body.action==='draft'){
   if(!draft||JSON.stringify(draft).length>80000)throw Error('Dados fiscais inválidos.')
   const saved=await rpc('draft',{venda_id:body.venda_id,dados_fiscais:draft})
   return json(saved,200,cors)
  }
  if(body.action==='emit'){
   if(!token)throw Error('Cadastre o token de homologação nas configurações.')
   const payload=source.nota?.status==='nao_encontrado'
    ?source.nota.payload:buildPayload(source,credentials.config,draft)
   const claim=await rpc('claim',{venda_id:body.venda_id,dados_fiscais:draft,payload,source_hash:source.source_hash})
   if(!claim.claimed)return json({nota:claim.nota,message:'Já existe uma solicitação para esta venda. Consulte a situação.'},200,cors)
   try{
    const r=await fetchFocus('/v2/nfe?ref='+encodeURIComponent(claim.nota.referencia),'POST',claim.nota.payload)
    const data=await r.json()
    const nota=await rpc('result',{venda_id:body.venda_id,status:providerStatus(data,r.status),retorno:safeResult(data)})
    return json({nota},200,cors)
   }catch{
    const nota=await rpc('result',{venda_id:body.venda_id,status:'incerto',retorno:{mensagem:'Resposta não confirmada. Consulte a Focus antes de reenviar.'}})
    return json({nota},200,cors)
   }
  }
  const note=source.nota
  if(!note?.payload)throw Error('Esta venda ainda não foi enviada à Focus.')
  if(body.action==='consult'){
   // Avoid treating a concurrent first transmission as absent.
   if(note.status==='enviando'&&Date.now()-new Date(String(note.updated_at)).getTime()<60000)return json({nota:note,message:'Envio em andamento. Aguarde um minuto antes de consultar.'},200,cors)
   const r=await fetchFocus('/v2/nfe/'+encodeURIComponent(String(note.referencia)))
   if(r.status===401||r.status===403)throw Error('Token recusado pela Focus. Revise o token nas configurações.')
   const data=await r.json()
   // Only the documented not-found error permits a retry after an uncertain transmission.
   const missing=r.status===404&&['nao_encontrado','not_found'].includes(String(data.codigo))
   const status=missing?'nao_encontrado':providerStatus(data,r.status)
   if(r.status>=400&&!missing)throw Error('Consulta não concluída pela Focus (HTTP '+r.status+'). A situação anterior foi preservada.')
   const nota=await rpc('result',{venda_id:body.venda_id,status,retorno:safeResult(data)})
   return json({nota},200,cors)
  }
  if(body.action==='download'){
   if(note.status!=='autorizado')throw Error('O documento fica disponível após a autorização de teste.')
   if(!['xml','danfe'].includes(body.kind))throw Error('Tipo de arquivo inválido.')
   const result=note.retorno as Record<string,unknown>
   const url=documentUrl(result[body.kind==='xml'?'caminho_xml_nota_fiscal':'caminho_danfe'])
   const r=await fetch(url,{headers:{Authorization:'Basic '+btoa(token+':')},signal:AbortSignal.timeout(25000),redirect:'error'})
   if(!r.ok)throw Error('Arquivo ainda não disponível na Focus.')
   return new Response(r.body,{headers:{...cors,'Cache-Control':'no-store','Content-Type':body.kind==='xml'?'application/xml':'application/pdf','Content-Disposition':'attachment; filename="nfe-teste.'+(body.kind==='xml'?'xml':'pdf')+'"'}})
  }
  throw Error('Ação inválida.')
 }catch(error){
  return json({error:error instanceof Error?error.message:'Não foi possível concluir a operação fiscal.'},400,cors)
 }
})
