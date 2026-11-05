import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {ArrowLeft,Banknote,Building2,CheckCircle2,FileText,FileUp,Landmark,Link2,List,RefreshCw,Search,SlidersHorizontal,Trash2,Undo2,Upload,WalletCards,XCircle} from 'lucide-react'
import {supabase} from './lib/supabase'
import {bankBrand,balanceTrend,isPending,sparkPoints} from './lib/bankPresentation'
import {SearchableSelect} from './SearchableSelect'
import type {CSSProperties} from 'react'

type Journal={id:string;nome:string;banco:string|null;agencia:string|null;conta:string|null;saldo_inicial:number;saldo_atual:number;ativo:boolean}
type BankTx={id:string;diario_id:string;importacao_id:string|null;fitid:string;trntype:'CREDIT'|'DEBIT';valor:number;data_lancamento:string;nome:string|null;historico:string|null;status:'pendente'|'parcial'|'conciliado'|'ignorado';criado_em:string;parceiro_nome?:string|null;parceiro_tipo?:'cliente'|'fornecedor'|'outro'|null;conta_categoria?:string|null;centro_custo?:string|null;descricao_conciliacao?:string|null}
type Title={id:string;tipo:'receber'|'pagar';descricao:string;entidade_nome:string|null;vencimento:string;valor:number;valor_pago:number;status:string;categoria:string|null;centro_custo:string|null;forma_pagamento:string|null;venda_id:string|null;compra_id:string|null}
type Partner={nome:string;documento:string|null}
type Suggestion={title:Title;score:number;reasons:string[]}
type ClosedPeriod={id:string;inicio:string;fim:string;motivo:string;fechado_em:string;reaberto_em:string|null;reabertura_motivo:string|null}
type ReconcileModel={id:string;nome:string;texto_correspondencia:string;tipo_correspondencia:'contem'|'comeca'|'exato';tipo_transacao:'ANY'|'CREDIT'|'DEBIT';parceiro_nome:string|null;parceiro_tipo:'cliente'|'fornecedor'|'outro'|null;conta_categoria:string|null;centro_custo:string|null;aplicar_automaticamente:boolean;prioridade:number;ativo:boolean}
type TransferCandidate={saida_id:string;entrada_id:string;diario_saida_id:string;diario_entrada_id:string;diario_saida:string;diario_entrada:string;valor:number;data_saida:string;data_entrada:string;dias_diferenca:number}
type BankImport={id:string;diario_id:string;arquivo:string;total_linhas:number;inseridas:number;duplicadas:number;importado_em:string;arquivo_path:string|null;arquivo_tipo:string|null;arquivo_tamanho:number|null;saldo_extrato:number|null;data_saldo:string|null}

const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0)
const dateBr=(v:string)=>{if(!v)return '—';const d=new Date(v+'T12:00:00');return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const sameBankText=(a:string|null|undefined,b:string|null|undefined)=>{
 const A=normalize(a||''),B=normalize(b||'')
 if(!A||!B)return false
 return A===B||A.includes(B)||B.includes(A)
}
const digits=(s:string)=>s.replace(/\D/g,'')
const businessDayDiff=(a:string,b:string)=>{
 const start=new Date(a+'T12:00:00'),end=new Date(b+'T12:00:00')
 if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return 999
 const from=start<=end?start:end,to=start<=end?end:start
 let count=0,cursor=new Date(from)
 while(cursor<to){cursor.setDate(cursor.getDate()+1);const day=cursor.getDay();if(day!==0&&day!==6)count++}
 return count
}
const tokens=(s:string)=>new Set(normalize(s).split(/\s+/).filter(x=>x.length>2))
function similarity(a:string,b:string){
 const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0
 let hit=0;A.forEach(t=>{if(B.has(t))hit++})
 return hit/Math.max(A.size,B.size)
}
function stableFitid(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return 'CSV-'+(h>>>0).toString(16).padStart(8,'0')}
function ofxDate(raw:string){
 const m=String(raw||'').match(/(\d{4})(\d{2})(\d{2})/);return m?m[1]+'-'+m[2]+'-'+m[3]:''
}
function tag(block:string,name:string){
 const xml=block.match(new RegExp('<'+name+'[^>]*>([^<\\r\\n]+)','i'))
 if(xml)return xml[1].trim()
 const sgml=block.match(new RegExp('<'+name+'>([^<\\r\\n]+)','i'))
 return sgml?.[1]?.trim()||''
}
function parseOfxStatementMeta(text:string){
 const balanceBlock=(text.match(/<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|$)/i)||[])[1]||''
 const rawBalance=tag(balanceBlock,'BALAMT').replace(',','.')
 const rawDate=tag(balanceBlock,'DTASOF')
 const balance=Number(rawBalance)
 return {saldo:Number.isFinite(balance)?balance:null,data_saldo:ofxDate(rawDate)||null}
}
function parseOfx(text:string){
 const blocks=text.split(/<STMTTRN>/i).slice(1)
 return blocks.map((block,index)=>{
  const end=block.split(/<\/STMTTRN>/i)[0]
  const rawAmount=Number(tag(end,'TRNAMT').replace(',','.'))
  const trntype=(tag(end,'TRNTYPE').toUpperCase()==='CREDIT'||rawAmount>0)?'CREDIT':'DEBIT'
  const fitid=tag(end,'FITID')||stableFitid([index,tag(end,'DTPOSTED'),rawAmount,tag(end,'NAME'),tag(end,'MEMO')].join('|'))
  return {fitid,trntype,valor:rawAmount,data:ofxDate(tag(end,'DTPOSTED')),nome:tag(end,'NAME'),historico:tag(end,'MEMO'),raw:{fitid}}
 }).filter(x=>x.data&&Number.isFinite(x.valor)&&x.valor!==0)
}
function splitCsvLine(line:string,delimiter:string){
 const out:string[]=[];let cur='',quoted=false
 for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){out.push(cur.trim());cur=''}else cur+=ch}
 out.push(cur.trim());return out
}
function parseDateCsv(v:string){
 const s=v.trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s
 const m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):''
}
function parseCsv(text:string){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(lines.length<2)return[]
 const delimiter=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?';':','
 const headers=splitCsvLine(lines[0],delimiter).map(normalize)
 const find=(names:string[])=>headers.findIndex(h=>names.some(n=>h.includes(n)))
 const iDate=find(['data','date','dtposted']),iAmount=find(['valor','amount','trnamt']),iFit=find(['fitid','id transacao','identificador']),iMemo=find(['historico','memo','descricao','description']),iName=find(['nome','name','favorecido'])
 return lines.slice(1).map((line,index)=>{
  const row=splitCsvLine(line,delimiter),date=parseDateCsv(row[iDate]||''),amount=Number(String(row[iAmount]||'').replace(/\./g,'').replace(',','.'))
  const memo=row[iMemo]||'',name=row[iName]||''
  const fitid=(iFit>=0?row[iFit]:'')||stableFitid([date,amount,name,memo,index].join('|'))
  return {fitid,trntype:(amount>=0?'CREDIT':'DEBIT') as 'CREDIT'|'DEBIT',valor:amount,data:date,nome:name,historico:memo,raw:{csv:index+2}}
 }).filter(x=>x.data&&Number.isFinite(x.valor)&&x.valor!==0)
}

function BankLogo({name,src}:{name:string;src:string|null}){
 const [failed,setFailed]=useState(false)
 const key=normalize(name)
 if(key==='dinheiro'||key==='caixa')return <span className="bankLogo bankLogoCash"><Banknote size={25} aria-label="Dinheiro"/></span>
 if(key==='ajustes')return <span className="bankLogo bankLogoAdjust"><SlidersHorizontal size={25} aria-label="Ajustes"/></span>
 return <span className="bankLogo" style={{background:name==='Itaú'||name==='Bradesco'?'var(--bank-color)':'#fff'}}>{src&&!failed?<img src={src} alt={'Logo '+name} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<Landmark size={24} aria-label={name}/>}</span>
}
function isManualJournal(j:Pick<Journal,'nome'|'banco'>){
 const key=normalize((j.nome||'')+' '+(j.banco||''))
 return key.includes('dinheiro')||key.includes('caixa')||key.includes('ajustes')
}

export function BankReconciliation({titles,canEdit,canClosePeriods=false,onChanged,initialTransactionId,onClearTransaction}:{initialTransactionId?:string|null;onClearTransaction?:()=>void;titles:Title[];canEdit:boolean;canClosePeriods?:boolean;onChanged:()=>Promise<void>|void}){
 const [journals,setJournals]=useState<Journal[]>([])
 const [transactions,setTransactions]=useState<BankTx[]>([])
 const [reconciledTotals,setReconciledTotals]=useState<Record<string,number>>({})
 const [imports,setImports]=useState<BankImport[]>([])
 const [clients,setClients]=useState<Partner[]>([])
 const [suppliers,setSuppliers]=useState<Partner[]>([])
 const [reconcileAccounts,setReconcileAccounts]=useState<{id:string;nome:string}[]>([])
 const [closedPeriods,setClosedPeriods]=useState<ClosedPeriod[]>([])
 const [models,setModels]=useState<ReconcileModel[]>([])
 const [transferCandidates,setTransferCandidates]=useState<TransferCandidate[]>([])
 const [activeJournal,setActiveJournal]=useState<string|null>(null)
 const [screen,setScreen]=useState<'dashboard'|'matching'|'transactions'>('dashboard')
 const [search,setSearch]=useState('')
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [selected,setSelected]=useState<Record<string,number>>({})
 const [adjustType,setAdjustType]=useState('')
 const [adjustValue,setAdjustValue]=useState('0')
 const [uploadOpen,setUploadOpen]=useState(false)
 const [newJournalOpen,setNewJournalOpen]=useState(false)
 const [periodOpen,setPeriodOpen]=useState(false)
 const [dragJournal,setDragJournal]=useState<string|null>(null)
 const [actionMenuTx,setActionMenuTx]=useState<string|null>(null)
 const [partnerTx,setPartnerTx]=useState<BankTx|null>(null)
 const [accountTx,setAccountTx]=useState<BankTx|null>(null)
 const [reconcileTx,setReconcileTx]=useState<BankTx|null>(null)
 const [reconcileSearch,setReconcileSearch]=useState('')
 const [reconcileDescription,setReconcileDescription]=useState('')
 const [adjustmentOpen,setAdjustmentOpen]=useState(false)
 const [modelsOpen,setModelsOpen]=useState(false)
 const [editingModel,setEditingModel]=useState<ReconcileModel|null>(null)
 const [selectedTransactions,setSelectedTransactions]=useState<Record<string,boolean>>({})
 const uploadLock=useRef(false)
 const fileRef=useRef<HTMLInputElement|null>(null)

 const load=useCallback(async()=>{
  const [j,t,c,s,a,p,m,x,i,r]=await Promise.all([
   supabase.from('diarios_bancarios').select('*').eq('ativo',true).order('nome'),
   supabase.from('transacoes_bancarias').select('*').order('data_lancamento',{ascending:false}).order('criado_em',{ascending:false}).limit(5000),
   supabase.from('clientes').select('nome,documento').eq('ativo',true),
   supabase.from('fornecedores').select('nome,documento').eq('ativo',true),
   supabase.from('contas_conciliacao_bancaria').select('id,nome').eq('ativo',true).order('nome'),
   supabase.from('periodos_financeiros_fechados').select('*').order('fim',{ascending:false}).limit(50),
   supabase.from('modelos_conciliacao_bancaria').select('*').order('prioridade',{ascending:true}).order('created_at',{ascending:true}),
   supabase.rpc('detectar_transferencias_bancarias_internas',{p_dias:2}),
   supabase.from('importacoes_bancarias').select('id,diario_id,arquivo,total_linhas,inseridas,duplicadas,importado_em,arquivo_path,arquivo_tipo,arquivo_tamanho,saldo_extrato,data_saldo').order('importado_em',{ascending:false}).limit(300),
   supabase.from('conciliacoes_bancarias').select('transacao_id,valor,tipo_ajuste,valor_ajuste,desfeito_em').is('desfeito_em',null)
  ])
  if(j.error||t.error||a.error||p.error||m.error||x.error||i.error||r.error){setMessage((j.error||t.error||a.error||p.error||m.error||x.error||i.error||r.error)!.message);return}
  const journalRows=((j.data||[]) as Journal[]).sort((a,b)=>{
   const rank=(row:Journal)=>normalize(row.nome)==='dinheiro'?0:normalize(row.nome)==='ajustes'?2:1
   return rank(a)-rank(b)||a.nome.localeCompare(b.nome,'pt-BR')
  })
  const totalsByTx:Record<string,number>={}
  ;((r.data||[]) as Array<{transacao_id:string;valor:number;tipo_ajuste:string|null;valor_ajuste:number;desfeito_em:string|null}>).forEach(row=>{
   const txRow=((t.data||[]) as BankTx[]).find(item=>item.id===row.transacao_id)
   const adj=Number(row.valor_ajuste)||0
   const effective=Number(row.valor)||0+(row.tipo_ajuste==='desconto_concedido'? -Math.abs(adj):row.tipo_ajuste==='tarifa'&&txRow?.trntype==='CREDIT'? -Math.abs(adj):Math.abs(adj))
   totalsByTx[row.transacao_id]=(totalsByTx[row.transacao_id]||0)+effective
  })
  if(initialTransactionId){
   const target=await supabase.from('transacoes_bancarias').select('*').eq('id',initialTransactionId).maybeSingle()
   if(target.error||!target.data){setMessage(target.error?.message||'A linha do diário não está mais disponível.');setActiveJournal('all');setScreen('transactions')}
   else{
    if(!t.data?.some(row=>row.id===target.data.id))t.data?.push(target.data)
    setActiveJournal(target.data.diario_id);setScreen('transactions');setSearch('')
   }
  }
  setReconciledTotals(totalsByTx);setJournals(journalRows);setTransactions((t.data||[]) as BankTx[]);setImports((i.data||[]) as BankImport[]);setClients((c.data||[]) as Partner[]);setSuppliers((s.data||[]) as Partner[]);setReconcileAccounts((a.data||[]) as {id:string;nome:string}[]);setClosedPeriods((p.data||[]) as ClosedPeriod[]);setModels((m.data||[]) as ReconcileModel[]);setTransferCandidates((x.data||[]) as TransferCandidate[])
 },[initialTransactionId])
 useEffect(()=>{void load()},[load])

 const journal=useMemo(()=>journals.find(j=>j.id===activeJournal)||null,[journals,activeJournal])
 const showingAllJournals=activeJournal==='all'
 const journalTx=useMemo(()=>showingAllJournals?transactions:transactions.filter(t=>t.diario_id===activeJournal),[transactions,activeJournal,showingAllJournals])
 const pending=journalTx.filter(isPending)
 const visibleImports=useMemo(()=>showingAllJournals?imports:imports.filter(row=>row.diario_id===activeJournal),[imports,activeJournal,showingAllJournals])
 const journalSupportsOfx=Boolean(journal&&!isManualJournal(journal))
 const visible=journalTx.filter(t=>!initialTransactionId||t.id===initialTransactionId).filter(t=>!search||normalize([t.fitid,t.nome||'',t.historico||'',String(t.valor),dateBr(t.data_lancamento)].join(' ')).includes(normalize(search)))

 function partnerDoc(entity:string|null){
  const n=normalize(entity||'');const p=[...clients,...suppliers].find(x=>normalize(x.nome)===n);return digits(p?.documento||'')
 }
 function suggestions(tx:BankTx):Suggestion[]{
  const expected=tx.trntype==='CREDIT'?'receber':'pagar',hay=normalize((tx.nome||'')+' '+(tx.historico||'')),hayDigits=digits((tx.nome||'')+' '+(tx.historico||''))
  return titles.filter(t=>t.tipo===expected&&t.status!=='cancelado'&&Number(t.valor)-Number(t.valor_pago)>0.009).map(title=>{
   const balance=Math.max(0,Number(title.valor)-Number(title.valor_pago)),reasons:string[]=[];let score=0
   if(Math.abs(balance-Math.abs(Number(tx.valor)))<0.01){score+=55;reasons.push('valor exato')}
   else if(Math.abs(balance-Math.abs(Number(tx.valor)))<=Math.max(2,Math.abs(Number(tx.valor))*.02)){score+=25;reasons.push('valor próximo')}
   const diff=businessDayDiff(tx.data_lancamento,title.vencimento);if(diff<=3){score+=20;reasons.push('data ±3 dias úteis')}else if(diff<=7){score+=8;reasons.push('data próxima')}
   const doc=partnerDoc(title.entidade_nome);if(doc.length>=11&&hayDigits.includes(doc)){score+=15;reasons.push('CPF/CNPJ')}
   const sim=similarity(hay,(title.entidade_nome||'')+' '+title.descricao);if(sim>=.6){score+=10;reasons.push('nome')}else if(sim>=.3){score+=5;reasons.push('texto')}
   const pay=normalize(title.forma_pagamento||'');if(pay&&hay.includes(pay)){score+=5;reasons.push('pagamento')}
   if(/\bpix\b/.test(hay)&&pay.includes('pix'))score+=5
   if(/boleto/.test(hay)&&pay.includes('boleto'))score+=5
   return {title,score:Math.min(100,score),reasons}
  }).filter(x=>x.score>=20).sort((a,b)=>b.score-a.score).slice(0,8)
 }

 async function closePeriod(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!canClosePeriods)return;setBusy(true);setMessage('')
  try{const f=new FormData(e.currentTarget);const {error}=await supabase.rpc('fechar_periodo_financeiro',{p_inicio:f.get('inicio'),p_fim:f.get('fim'),p_motivo:f.get('motivo')});if(error)throw error;setPeriodOpen(false);setMessage('Período financeiro encerrado.');await load()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function reopenPeriod(id:string){
  if(!canClosePeriods)return;const motivo=window.prompt('Justificativa para reabrir o período:');if(!motivo)return
  setBusy(true);setMessage('')
  try{const {error}=await supabase.rpc('reabrir_periodo_financeiro',{p_id:id,p_motivo:motivo});if(error)throw error;setMessage('Período financeiro reaberto.');await load()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }

 async function createAdjustment(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(!canEdit)return
  const form=new FormData(e.currentTarget)
  setBusy(true);setMessage('')
  try{
   const {error}=await supabase.rpc('criar_lancamento_ajuste',{
    p_tipo:String(form.get('tipo')||'entrada'),
    p_valor:Number(form.get('valor')||0),
    p_data:String(form.get('data')||''),
    p_descricao:String(form.get('descricao')||''),
    p_categoria:String(form.get('categoria')||'')||null,
    p_centro_custo:String(form.get('centro_custo')||'')||null
   })
   if(error)throw error
   setAdjustmentOpen(false)
   setSearch('')
   setScreen('matching')
   setMessage('Linha de ajuste criada e pronta para conciliação.')
   await load()
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function createJournal(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!canEdit)return;setBusy(true);setMessage('')
  try{const f=new FormData(e.currentTarget);const {error}=await supabase.rpc('criar_diario_bancario',{p_nome:f.get('nome'),p_banco:f.get('banco'),p_agencia:f.get('agencia'),p_conta:f.get('conta'),p_saldo_inicial:Number(f.get('saldo')||0)});if(error)throw error;setNewJournalOpen(false);await load()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function openImportedFile(row:BankImport){
  if(!row.arquivo_path){setMessage('Este extrato foi importado antes do armazenamento do arquivo original.');return}
  setBusy(true);setMessage('')
  try{
   const {data,error}=await supabase.storage.from('extratos-bancarios').download(row.arquivo_path)
   if(error)throw error
   const url=URL.createObjectURL(data)
   window.open(url,'_blank','noopener,noreferrer')
   window.setTimeout(()=>URL.revokeObjectURL(url),60000)
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 function safeStatementFileName(name:string){
  const clean=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-')
  return clean||'extrato'
 }
 async function upload(file:File,journalId=activeJournal){
  const targetJournal=journals.find(j=>j.id===journalId)
  if(targetJournal&&isManualJournal(targetJournal)){setMessage('Os diários Dinheiro e Ajustes são alimentados pelo próprio ERP e não recebem OFX.');return}
  if(!canEdit||!journalId||uploadLock.current)return
  if(!/\.(ofx|qfx|csv)$/i.test(file.name)){setMessage('Escolha um arquivo OFX, QFX ou CSV.');return}
  uploadLock.current=true;setBusy(true);setMessage('')
  try{
   const text=await file.text(),ext=file.name.toLowerCase().split('.').pop()
   const rows=ext==='csv'?parseCsv(text):parseOfx(text)
   const statementMeta=ext==='csv'?{saldo:null as number|null,data_saldo:null as string|null}:parseOfxStatementMeta(text)
   if(!rows.length)throw Error('Nenhuma transação válida encontrada no arquivo.')
   const {data,error}=await supabase.rpc('importar_transacoes_bancarias',{p_diario_id:journalId,p_arquivo:file.name,p_transacoes:rows})
   if(error)throw error
   const importId=String(data?.importacao_id||'')
   let archiveWarning=''
   if(importId){
    const path=journalId+'/'+importId+'/'+safeStatementFileName(file.name)
    const {error:storageError}=await supabase.storage.from('extratos-bancarios').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false})
    if(storageError)archiveWarning=' O arquivo original não pôde ser arquivado: '+storageError.message
    else{
      const {error:metaError}=await supabase.from('importacoes_bancarias').update({arquivo_path:path,arquivo_tipo:file.type||null,arquivo_tamanho:file.size}).eq('id',importId)
      if(metaError)archiveWarning=' O extrato foi importado, mas o vínculo do arquivo original falhou: '+metaError.message
    }
    if(statementMeta.saldo!=null&&statementMeta.data_saldo){
      const {error:balanceError}=await supabase.rpc('registrar_saldo_extrato_bancario',{p_importacao_id:importId,p_saldo:statementMeta.saldo,p_data_saldo:statementMeta.data_saldo})
      if(balanceError)archiveWarning+=' O saldo do extrato não pôde ser carregado: '+balanceError.message
    }
   }
   const {data:modelResult,error:modelError}=await supabase.rpc('aplicar_modelos_conciliacao_bancaria',{p_transacao_id:null})
   if(modelError)throw modelError
   const auto=Number(modelResult?.conciliados_automaticamente||0)
   const classified=Number(modelResult?.aplicados||0)
   setMessage('Importação concluída: '+Number(data?.inseridas||0)+' nova(s), '+Number(data?.duplicadas||0)+' duplicada(s) descartada(s). '+classified+' regra(s) aplicada(s)'+(auto?', '+auto+' conciliada(s) automaticamente.':'.')+archiveWarning)
   setUploadOpen(false);await load()
  }catch(e){setMessage((e as Error).message)}finally{uploadLock.current=false;setBusy(false);if(fileRef.current)fileRef.current.value=''}
 }
 async function saveReconcileModel(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!canEdit||busy)return
  const f=new FormData(e.currentTarget)
  const payload={
   nome:String(f.get('nome')||'').trim(),
   texto_correspondencia:String(f.get('texto')||'').trim(),
   tipo_correspondencia:String(f.get('tipo_correspondencia')||'contem'),
   tipo_transacao:String(f.get('tipo_transacao')||'ANY'),
   parceiro_nome:String(f.get('parceiro_nome')||'').trim()||null,
   parceiro_tipo:String(f.get('parceiro_tipo')||'').trim()||null,
   conta_categoria:String(f.get('conta_categoria')||'').trim()||null,
   centro_custo:String(f.get('centro_custo')||'').trim()||null,
   aplicar_automaticamente:f.get('automatico')==='on',
   prioridade:Number(f.get('prioridade')||100),
   ativo:true
  }
  if(payload.nome.length<2||payload.texto_correspondencia.length<2){setMessage('Informe nome e texto de correspondência da regra.');return}
  setBusy(true);setMessage('')
  try{
   const q=editingModel
    ? supabase.from('modelos_conciliacao_bancaria').update(payload).eq('id',editingModel.id)
    : supabase.from('modelos_conciliacao_bancaria').insert(payload)
   const {error}=await q
   if(error)throw error
   setEditingModel(null);setMessage(editingModel?'Modelo atualizado.':'Modelo de conciliação criado.');await load()
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function deleteReconcileModel(model:ReconcileModel){
  if(!canEdit||busy||!window.confirm('Excluir o modelo "'+model.nome+'"?'))return
  setBusy(true);setMessage('')
  try{const {error}=await supabase.from('modelos_conciliacao_bancaria').delete().eq('id',model.id);if(error)throw error;setEditingModel(null);setMessage('Modelo excluído.');await load()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function applyModelsNow(){
  if(!canEdit||busy)return
  setBusy(true);setMessage('')
  try{
   const {data,error}=await supabase.rpc('aplicar_modelos_conciliacao_bancaria',{p_transacao_id:null})
   if(error)throw error
   setMessage(Number(data?.aplicados||0)+' regra(s) aplicada(s); '+Number(data?.conciliados_automaticamente||0)+' transação(ões) conciliada(s) automaticamente.')
   await Promise.all([load(),onChanged()])
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function reconcileInternalTransfer(candidate:TransferCandidate){
  if(!canEdit||busy)return
  if(!window.confirm('Conciliar '+money(Number(candidate.valor))+' como transferência interna de '+candidate.diario_saida+' para '+candidate.diario_entrada+'?'))return
  setBusy(true);setMessage('')
  try{
   const {error}=await supabase.rpc('conciliar_transferencia_bancaria_interna',{p_saida_id:candidate.saida_id,p_entrada_id:candidate.entrada_id})
   if(error)throw error
   setMessage('Transferência interna conciliada sem gerar receita ou despesa.')
   await load()
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }

 async function reconcile(tx:BankTx,score?:number){
  const links=Object.entries(selected).filter(([,v])=>v>0).map(([titulo_id,valor])=>({titulo_id,valor}))
  if(!links.length){setMessage('Selecione ao menos um título para conciliar.');return}
  setBusy(true);setMessage('')
  try{
   const {error}=await supabase.rpc('conciliar_transacao_bancaria',{p_transacao_id:tx.id,p_vinculos:links,p_tipo_ajuste:adjustType||null,p_valor_ajuste:Number(adjustValue)||0,p_categoria_ajuste:null,p_centro_custo_ajuste:null})
   if(error)throw error
   if(reconcileDescription.trim()){
    const saved=await supabase.from('transacoes_bancarias').update({descricao_conciliacao:reconcileDescription.trim()}).eq('id',tx.id)
    if(saved.error)throw saved.error
   }
   setSelected({});setAdjustType('');setAdjustValue('0');setReconcileDescription('');setReconcileTx(null);setMessage('Transação conciliada com sucesso.');await Promise.all([load(),onChanged()])
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function quickCreate(tx:BankTx){
  const description=window.prompt('Descrição do novo lançamento:',tx.historico||tx.nome||'Lançamento bancário');if(!description)return
  const category=window.prompt('Categoria/Plano de contas (opcional):',tx.conta_categoria||'Tarifa Bancária')??''
  setBusy(true);setMessage('')
  try{const {error}=await supabase.rpc('criar_lancamento_e_conciliar',{p_transacao_id:tx.id,p_descricao:description,p_categoria:category,p_centro_custo:tx.centro_custo||'Financeiro'});if(error)throw error;setMessage('Lançamento criado e conciliado.');setActionMenuTx(null);await Promise.all([load(),onChanged()])}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function quickCreatePreset(tx:BankTx,category:string){
  if(!canEdit||busy)return
  setBusy(true);setMessage('')
  try{
   const description=tx.historico||tx.nome||category
   const {error}=await supabase.rpc('criar_lancamento_e_conciliar',{p_transacao_id:tx.id,p_descricao:description,p_categoria:category,p_centro_custo:tx.centro_custo||'Financeiro'})
   if(error)throw error
   setActionMenuTx(null);setMessage(category+' lançado e conciliado.')
   await Promise.all([load(),onChanged()])
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function savePartner(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!partnerTx||!canEdit)return
  const form=new FormData(e.currentTarget),raw=String(form.get('parceiro')||'')
  const [tipo,...nameParts]=raw.split('|'),nome=nameParts.join('|')
  if(!nome){setMessage('Selecione um parceiro.');return}
  setBusy(true);setMessage('')
  try{
   const {error}=await supabase.from('transacoes_bancarias').update({parceiro_nome:nome,parceiro_tipo:tipo}).eq('id',partnerTx.id)
   if(error)throw error
   setPartnerTx(null);setMessage('Parceiro definido para a transação.');await load()
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function saveAccount(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!accountTx||!canEdit)return
  const form=new FormData(e.currentTarget),categoria=String(form.get('categoria')||'').trim(),centro=String(form.get('centro_custo')||'').trim()
  if(!categoria){setMessage('Selecione uma conta.');return}
  setBusy(true);setMessage('')
  try{
   const {error}=await supabase.rpc('classificar_transacao_bancaria',{p_transacao_id:accountTx.id,p_conta_categoria:categoria,p_centro_custo:centro||null})
   if(error)throw error
   setAccountTx(null);setMessage('Conta definida e transação conciliada.');await Promise.all([load(),onChanged()])
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 function openReconcile(tx:BankTx){
  setSelected({});setAdjustType('');setAdjustValue('0');setReconcileSearch('');setReconcileDescription(tx.descricao_conciliacao||'');setReconcileTx(tx);setActionMenuTx(null)
 }
 async function undo(tx:BankTx){
  const reason=window.prompt('Motivo da desconciliação:');if(!reason)return
  setBusy(true);setMessage('')
  try{const {error}=await supabase.rpc('desfazer_conciliacao_bancaria',{p_transacao_id:tx.id,p_motivo:reason});if(error)throw error;setMessage('Conciliação desfeita.');await Promise.all([load(),onChanged()])}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function deleteTransaction(tx:BankTx){
  if(!canEdit||busy)return
  if(!window.confirm(`Excluir esta linha do extrato de ${dateBr(tx.data_lancamento)} no valor de ${money(Math.abs(Number(tx.valor)))}?`))return
  setBusy(true);setMessage('')
  try{
   const {error}=await supabase.rpc('excluir_transacao_bancaria',{p_transacao_id:tx.id})
   if(error)throw error
   setActionMenuTx(null);setMessage('Linha do extrato excluída.');await load()
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 async function deleteSelectedTransactions(){
  if(!canEdit||busy)return
  const rows=visible.filter(tx=>selectedTransactions[tx.id]&&tx.status!=='conciliado')
  if(!rows.length){setMessage('Selecione ao menos uma linha não conciliada para excluir.');return}
  if(!window.confirm(`Excluir ${rows.length} linha(s) selecionada(s) do extrato? Linhas conciliadas não podem ser excluídas.`))return
  setBusy(true);setMessage('')
  try{
   let deleted=0
   for(const tx of rows){
    const {error}=await supabase.rpc('excluir_transacao_bancaria',{p_transacao_id:tx.id})
    if(error)throw error
    deleted++
   }
   setSelectedTransactions({})
   setMessage(`${deleted} linha(s) do extrato excluída(s).`)
   await load()
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 function toggleTransactionSelection(tx:BankTx){
  if(tx.status==='conciliado')return
  setSelectedTransactions(prev=>({...prev,[tx.id]:!prev[tx.id]}))
 }
 function toggleAllVisibleTransactions(){
  const deletable=visible.filter(tx=>tx.status!=='conciliado')
  const allSelected=deletable.length>0&&deletable.every(tx=>selectedTransactions[tx.id])
  if(allSelected){
   setSelectedTransactions(prev=>{
    const next={...prev}
    deletable.forEach(tx=>delete next[tx.id])
    return next
   })
  }else{
   setSelectedTransactions(prev=>{
    const next={...prev}
    deletable.forEach(tx=>{next[tx.id]=true})
    return next
   })
  }
 }
 async function deleteStatementDay(tx:BankTx){
  if(!canEdit||busy)return
  const dayCount=transactions.filter(row=>row.diario_id===tx.diario_id&&row.data_lancamento===tx.data_lancamento).length
  if(!window.confirm(`Excluir todo o extrato de ${dateBr(tx.data_lancamento)}? Serão removidas ${dayCount} linha(s) ainda não conciliadas.`))return
  setBusy(true);setMessage('')
  try{
   const {data,error}=await supabase.rpc('excluir_extrato_bancario_dia',{p_diario_id:tx.diario_id,p_data:tx.data_lancamento})
   if(error)throw error
   setActionMenuTx(null);setMessage(`Extrato de ${dateBr(tx.data_lancamento)} excluído: ${Number(data?.excluidas||0)} linha(s).`);await load()
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 function openJournal(id:string,target:'matching'|'transactions'){
  onClearTransaction?.();setActiveJournal(id);setScreen(target);setSearch('');setSelected({});setMessage('')
 }
 function openUploadForJournal(id:string){
  if(!canEdit||busy)return
  const target=journals.find(j=>j.id===id)
  if(target&&isManualJournal(target)){setMessage('Este diário é alimentado pelo próprio ERP e não usa OFX.');return}
  setActiveJournal(id);setUploadOpen(true);setMessage('')
 }
 function toggleTitle(title:Title){
  const balance=Math.max(0,Number(title.valor)-Number(title.valor_pago))
  setSelected(prev=>{
   if(prev[title.id]!=null)return Object.fromEntries(Object.entries(prev).filter(([id])=>id!==title.id))
   const bankTotal=reconcileTx?Math.max(0,Math.abs(Number(reconcileTx.valor))-Number(reconciledTotals[reconcileTx.id]||0)):0
   const adjustment=Number(adjustValue)||0
   const alreadySelected=Object.values(prev).reduce((sum,value)=>sum+Number(value||0),0)
   const available=Math.max(0,bankTotal-adjustment-alreadySelected)
   if(available<=0){setMessage('O valor da linha do extrato já foi totalmente distribuído.');return prev}
   return {...prev,[title.id]:Math.min(balance,available)}
  })
 }
 const selectedReconcileTotal=Object.values(selected).reduce((sum,value)=>sum+Number(value||0),0)
 const reconcileBankTotal=reconcileTx?Math.max(0,Math.abs(Number(reconcileTx.valor))-Number(reconciledTotals[reconcileTx.id]||0)):0
 const reconcileAdjustment=Number(adjustValue)||0
 const reconcileAppliedTotal=selectedReconcileTotal+reconcileAdjustment
 const reconcileDifference=reconcileBankTotal-reconcileAppliedTotal
 const reconcileResidual=reconcileDifference>0.009?reconcileDifference:0
 const reconcileExcess=reconcileDifference<-0.009?Math.abs(reconcileDifference):0
 const reconcileBalanced=Math.abs(reconcileDifference)<=0.009
 const selectedTransactionCount=visible.filter(tx=>selectedTransactions[tx.id]&&tx.status!=='conciliado').length
 const deletableVisible=visible.filter(tx=>tx.status!=='conciliado')
 const allVisibleSelected=deletableVisible.length>0&&deletableVisible.every(tx=>selectedTransactions[tx.id])

 const reconcileCandidates=reconcileTx?titles.filter(t=>{
  const expected=reconcileTx.trntype==='CREDIT'?'receber':'pagar'
  if(t.tipo!==expected||t.status==='cancelado'||Number(t.valor)-Number(t.valor_pago)<=0.009)return false
  const q=normalize(reconcileSearch)
  return !q||normalize([t.descricao,t.entidade_nome||'',t.vencimento,String(t.valor),t.categoria||'',t.forma_pagamento||''].join(' ')).includes(q)
 }).sort((a,b)=>{
  const scores=new Map(suggestions(reconcileTx).map(s=>[s.title.id,s.score]))
  return Number(scores.get(b.id)||0)-Number(scores.get(a.id)||0)
 }):[]
 if(screen==='dashboard')return <section className="bankRecon">
  <div className="bankReconTop"><div><span>FINANCEIRO / DIÁRIOS</span><h3>Diários e Conciliação</h3><p>Contas bancárias, extratos importados e pendências de conciliação.</p></div><div className="bankActions">{canEdit&&<button onClick={()=>setModelsOpen(true)}><SlidersHorizontal size={15}/>Modelos de conciliação</button>}{canEdit&&<button className="bankPrimary" disabled={busy} onClick={()=>void applyModelsNow()}><RefreshCw size={15}/>Aplicar regras</button>}</div></div>
  {message&&<div className="bankMessage" role="status">{message}</div>}
  {journals.length===0&&<div className="bankEmpty"><Landmark size={30}/><strong>Nenhum diário bancário cadastrado</strong><span>Cadastre uma conta para começar a importar OFX.</span></div>}
  {transferCandidates.length>0&&<div className="bankTransferSuggestions"><div className="bankTransferHead"><div><strong>Transferências internas sugeridas</strong><span>Mesmo valor entre bancos diferentes, com datas próximas. Não entram como receita ou despesa.</span></div><b>{transferCandidates.length}</b></div>{transferCandidates.slice(0,6).map(candidate=><div className="bankTransferRow" key={candidate.saida_id+'-'+candidate.entrada_id}><div><span>{dateBr(candidate.data_saida)}</span><strong>{candidate.diario_saida}</strong></div><Link2 size={16}/><div><span>{dateBr(candidate.data_entrada)}</span><strong>{candidate.diario_entrada}</strong></div><b>{money(Number(candidate.valor))}</b>{canEdit&&<button className="bankReconcileButton" disabled={busy} onClick={()=>void reconcileInternalTransfer(candidate)}>Conciliar transferência</button>}</div>)}</div>}
  <div className="bankJournalGrid">{journals.map(j=>{
   const rows=transactions.filter(t=>t.diario_id===j.id),pendingRows=rows.filter(isPending),pendingPayments=pendingRows.filter(t=>t.trntype==='DEBIT').reduce((s,t)=>s+Math.abs(Number(t.valor)),0)
   const manual=isManualJournal(j),cash=normalize(j.nome)==='dinheiro'
   const cashEntries=rows.filter(t=>t.trntype==='CREDIT').reduce((s,t)=>s+Math.abs(Number(t.valor)),0)
   const cashOutflows=rows.filter(t=>t.trntype==='DEBIT').reduce((s,t)=>s+Math.abs(Number(t.valor)),0)
   const brand=bankBrand(j.banco,j.nome),trend=balanceTrend(Number(j.saldo_atual),rows),points=sparkPoints(trend),gradientId='bank-trend-'+j.id
   return <article className={'bankJournalCard'+(dragJournal===j.id?' isDragging':'')} key={j.id} style={{'--bank-color':brand.color} as CSSProperties} aria-label={'Conta '+j.nome} aria-busy={busy}
    onDragOver={e=>{if(manual||!canEdit||busy||!e.dataTransfer.types.includes('Files'))return;e.preventDefault();e.dataTransfer.dropEffect='copy';setDragJournal(j.id)}}
    onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDragJournal(null)}}
    onDrop={e=>{e.preventDefault();setDragJournal(null);if(manual||!canEdit||busy)return;const files=e.dataTransfer.files;if(files.length!==1){setMessage('Arraste apenas um arquivo por vez.');return}void upload(files[0],j.id)}}>
    <div className="bankJournalTop">
      <div className="bankJournalIdentity"><BankLogo name={brand.name} src={brand.logo}/><div><h4>{j.nome}</h4><span>{[j.banco,j.agencia,j.conta].filter(Boolean).join(' · ')||'Conta bancária'}</span></div></div>
      <button type="button" className={'bankPendingBadge'+(pendingRows.length?' hasPending':'')} onClick={()=>openJournal(j.id,'matching')} aria-label={j.nome+': '+(pendingRows.length?pendingRows.length+' a conciliar':'Sem pendências')}><span aria-live="polite" aria-atomic="true">{pendingRows.length?pendingRows.length+' a conciliar':'Sem pendências'}</span></button>
    </div>
    <div className={'bankJournalMetrics'+(cash?' cashMetrics':'')}><div><span>Saldo</span><strong className={Number(j.saldo_atual)>0?'positive':''}>{money(Number(j.saldo_atual))}</strong></div>{cash?<><div><span>Entradas</span><b className="positive">{money(cashEntries)}</b></div><div><span>Saídas</span><b className="negative">{money(cashOutflows)}</b></div></>:<div><span>{manual?'Movimentos':'Pagamentos a conciliar'}</span><b>{manual?rows.length:money(pendingPayments)}</b></div>}</div>
    <div className="bankTrend">{points?<svg className="bankSpark" viewBox="0 0 300 56" preserveAspectRatio="none" role="img" aria-label={'Evolução do saldo nos últimos lançamentos importados de '+j.nome}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.22"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><polygon points={'0,56 '+points+' 300,56'} fill={'url(#'+gradientId+')'}/><polyline points={points}/></svg>:<span>Sem movimentações importadas</span>}<small>Últimos lançamentos importados</small></div>
    <div className={'bankJournalActions'+(manual?' singleAction':'')}>
      <button className="bankTransactionsButton" onClick={()=>openJournal(j.id,'transactions')}><List size={17}/>{cash?'Movimentações':'Transações'}</button>
      {canEdit&&!manual&&<button className="bankLoadButton" disabled={busy} onClick={()=>openUploadForJournal(j.id)}><Upload size={17}/>{busy?'Importando…':'Carregar OFX'}</button>}
    </div>
    {canEdit&&!manual&&<small className="bankDropHint">{dragJournal===j.id?'Solte o arquivo para importar nesta conta':'Arraste um arquivo OFX para esta conta'}</small>}
   </article>
  })}</div>
  {modelsOpen&&<div className="bankModalBackdrop"><div className="bankModal bankModelsModal" role="dialog" aria-modal="true" aria-label="Modelos de conciliação"><div className="bankModalHead"><div><strong>Modelos de conciliação</strong><small>Automatize tarifas, IOF, adquirentes, parceiros e classificações recorrentes.</small></div><button onClick={()=>{setModelsOpen(false);setEditingModel(null)}}><XCircle size={18}/></button></div>
    <form onSubmit={saveReconcileModel}>
      <div className="bankFormGrid"><label>Nome<input name="nome" required defaultValue={editingModel?.nome||''} placeholder="Ex.: Tarifa bancária"/></label><label>Texto que identifica<input name="texto" required defaultValue={editingModel?.texto_correspondencia||''} placeholder="Ex.: TARIFA"/></label><label>Correspondência<select name="tipo_correspondencia" defaultValue={editingModel?.tipo_correspondencia||'contem'}><option value="contem">Contém</option><option value="comeca">Começa com</option><option value="exato">Texto exato</option></select></label><label>Tipo<select name="tipo_transacao" defaultValue={editingModel?.tipo_transacao||'ANY'}><option value="ANY">Entrada ou saída</option><option value="CREDIT">Somente entrada</option><option value="DEBIT">Somente saída</option></select></label></div>
      <div className="bankFormGrid"><label>Conta / categoria<input name="conta_categoria" defaultValue={editingModel?.conta_categoria||''} placeholder="Ex.: Tarifas bancárias"/></label><label>Centro de custo<input name="centro_custo" defaultValue={editingModel?.centro_custo||''} placeholder="Opcional"/></label><label>Parceiro<input name="parceiro_nome" defaultValue={editingModel?.parceiro_nome||''} placeholder="Opcional"/></label><label>Tipo do parceiro<select name="parceiro_tipo" defaultValue={editingModel?.parceiro_tipo||''}><option value="">Não definir</option><option value="cliente">Cliente</option><option value="fornecedor">Fornecedor</option><option value="outro">Outro</option></select></label></div>
      <div className="bankModelOptions"><label>Prioridade<input name="prioridade" type="number" min="1" step="1" defaultValue={editingModel?.prioridade||100}/></label><label className="bankCheck"><input name="automatico" type="checkbox" defaultChecked={editingModel?.aplicar_automaticamente||false}/><span>Conciliar automaticamente quando houver conta/categoria</span></label></div>
      <div className="bankModalActions"><button type="button" onClick={()=>setEditingModel(null)}>Limpar</button><button className="bankPrimary" disabled={busy}>{editingModel?'Salvar modelo':'Criar modelo'}</button></div>
    </form>
    <div className="bankModelList">{models.map(model=><div key={model.id}><div><strong>{model.nome}</strong><span>{model.tipo_transacao==='ANY'?'Entrada/saída':model.tipo_transacao==='CREDIT'?'Entrada':'Saída'} · {model.tipo_correspondencia} “{model.texto_correspondencia}”{model.conta_categoria?' · '+model.conta_categoria:''}{model.aplicar_automaticamente?' · automático':''}</span></div><div><button onClick={()=>setEditingModel(model)}>Editar</button>{canEdit&&<button className="bankDangerMenu" onClick={()=>void deleteReconcileModel(model)}>Excluir</button>}</div></div>)}</div>
  </div></div>}
  {adjustmentOpen&&<div className="bankModalBackdrop"><form className="bankModal" onSubmit={createAdjustment}><div className="bankModalHead"><strong>Novo ajuste</strong><button type="button" onClick={()=>setAdjustmentOpen(false)}><XCircle size={18}/></button></div><p>Crie uma entrada ou saída manual exclusivamente no diário Ajustes.</p><div className="bankFormGrid"><label>Tipo<select name="tipo" defaultValue="entrada"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label>Data<input name="data" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Valor<input name="valor" type="number" min="0.01" step="0.01" required/></label><label>Categoria<input name="categoria" placeholder="Opcional"/></label></div><label>Descrição<input name="descricao" minLength={3} required placeholder="Motivo do ajuste"/></label><label>Centro de custo<input name="centro_custo" placeholder="Opcional"/></label><div className="bankModalActions"><button type="button" onClick={()=>setAdjustmentOpen(false)}>Cancelar</button><button className="bankPrimary" disabled={busy}>Salvar ajuste</button></div></form></div>}
  {uploadOpen&&<div className="bankModalBackdrop"><div className="bankModal" role="dialog" aria-modal="true" aria-label="Carregar extrato"><div className="bankModalHead"><strong>Carregar extrato</strong><button onClick={()=>setUploadOpen(false)}><XCircle size={18}/></button></div>{showingAllJournals?<p>Selecione um diário específico antes de carregar um extrato.</p>:<><p>O arquivo será atribuído automaticamente ao diário <strong>{journal?.nome}</strong>. FITIDs já importados serão descartados.</p><input ref={fileRef} type="file" disabled={busy} accept=".ofx,.qfx,.csv" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file)}}/><div className="bankUploadHint"><FileUp size={18}/><span>Formatos aceitos: OFX, QFX e CSV.</span></div></>}</div></div>}
  {canClosePeriods&&closedPeriods.length>0&&<div className="bankClosedPeriods"><strong>Períodos financeiros</strong>{closedPeriods.slice(0,6).map(p=><div key={p.id}><span>{dateBr(p.inicio)} a {dateBr(p.fim)} · {p.reaberto_em?'Reaberto':'Fechado'}</span>{!p.reaberto_em&&<button disabled={busy} onClick={()=>void reopenPeriod(p.id)}>Reabrir</button>}</div>)}</div>}
  {newJournalOpen&&<div className="bankModalBackdrop"><form className="bankModal" onSubmit={createJournal}><div className="bankModalHead"><strong>Novo diário bancário</strong><button type="button" onClick={()=>setNewJournalOpen(false)}><XCircle size={18}/></button></div><label>Nome<input name="nome" required placeholder="Ex.: Itaú Supremion"/></label><div className="bankFormGrid"><label>Banco<input name="banco"/></label><label>Agência<input name="agencia"/></label><label>Conta<input name="conta"/></label><label>Saldo inicial<input name="saldo" type="number" step="0.01" defaultValue="0"/></label></div><div className="bankModalActions"><button type="button" onClick={()=>setNewJournalOpen(false)}>Cancelar</button><button className="bankPrimary" disabled={busy}>Criar diário</button></div></form></div>}
  {periodOpen&&<div className="bankModalBackdrop"><form className="bankModal" onSubmit={closePeriod}><div className="bankModalHead"><strong>Encerrar período financeiro</strong><button type="button" onClick={()=>setPeriodOpen(false)}><XCircle size={18}/></button></div><p>Importações, conciliações e reversões dentro deste período ficarão bloqueadas.</p><div className="bankFormGrid"><label>Início<input name="inicio" type="date" required/></label><label>Fim<input name="fim" type="date" required/></label></div><label>Justificativa<input name="motivo" minLength={5} required/></label><div className="bankModalActions"><button type="button" onClick={()=>setPeriodOpen(false)}>Cancelar</button><button className="bankPrimary" disabled={busy}>Encerrar período</button></div></form></div>}
 </section>

 return <section className="bankRecon">
  <div className="bankReconNav"><button onClick={()=>setScreen('dashboard')}><ArrowLeft size={15}/>Painel</button><span>/</span><strong>{screen==='matching'?'Bank Matching':'Transações'} · {journal?.nome}</strong></div>
  <div className="bankReconTop compact">
    <div>
      <h3>{screen==='matching'?'Conciliação bancária':'Extrato bancário'}</h3>
      <p>{showingAllJournals?'Todos os diários':journal?.nome} · {pending.length} pendência(s)</p>
    </div>
    <div className="bankTopControls">
      <label className="bankJournalSelector">Diário
        <SearchableSelect value={activeJournal==='all'?'':activeJournal||''} onChange={value=>{onClearTransaction?.();setActiveJournal(value||'all');setSearch('')}} placeholder="Todos os diários" searchPlaceholder="Pesquisar diário..." options={journals.map(j=>({value:j.id,label:j.nome,keywords:[j.banco,j.agencia,j.conta].filter(Boolean).join(' ')}))}/>
      </label>
      <div className="bankActions">{canEdit&&normalize(journal?.nome||'')==='ajustes'&&<button className="bankPrimary" onClick={()=>setAdjustmentOpen(true)}><SlidersHorizontal size={14}/>Novo ajuste</button>}{canEdit&&journalSupportsOfx&&<button className="bankPrimary" disabled={showingAllJournals} onClick={()=>setUploadOpen(true)}><Upload size={14}/>Carregar extrato</button>}<button onClick={()=>void load()}><RefreshCw size={14}/></button></div>
    </div>
  </div>
  {message&&<div className="bankMessage" role="status">{message}</div>}
  <div className="bankFilterBar bankSearchOnly">
    {initialTransactionId&&<button type="button" onClick={()=>onClearTransaction?.()}>Linha do pagamento · Mostrar todas as linhas</button>}
    <label className="bankBulkSelect"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisibleTransactions} disabled={!canEdit||busy||deletableVisible.length===0}/><span>Selecionar linhas</span></label>
    <div className="bankSearch"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar FITID, nome, histórico, valor..."/></div>
    {selectedTransactionCount>0&&<button className="bankBulkDelete" disabled={!canEdit||busy} onClick={()=>void deleteSelectedTransactions()}><Trash2 size={15}/>Excluir selecionadas ({selectedTransactionCount})</button>}
  </div>

  <div className="bankTxList">{visible.map((tx,index)=>{
   const sugg=suggestions(tx),top=sugg[0],high=(top?.score||0)>=80,partial=(top?.score||0)>=45
   const txJournal=journals.find(j=>j.id===tx.diario_id)
   const txImport=tx.importacao_id?imports.find(row=>row.id===tx.importacao_id):null
   const previousImport=index>0?visible[index-1]?.importacao_id:null
   const showStatementHeader=Boolean(txImport&&tx.importacao_id!==previousImport)
   const statementLabel=txImport?((txJournal?.nome||'Diário')+' Extrato '+(txImport.data_saldo||tx.data_lancamento)):''
   return <>{showStatementHeader&&<div className="bankStatementGroupHeader"><button type="button" disabled={busy||!txImport?.arquivo_path} onClick={()=>txImport&&void openImportedFile(txImport)} title={txImport?.arquivo_path?'Abrir documento original do extrato':'Documento original não armazenado'}><FileText size={15}/><strong>{statementLabel}</strong></button><span>{txImport?.saldo_extrato!=null?money(Number(txImport.saldo_extrato)):'Saldo não informado no arquivo'}</span></div>}<article className={'bankTx '+(tx.trntype==='CREDIT'?'credit':'debit')+(selectedTransactions[tx.id]?' bankTxSelected':'')} key={tx.id}>
    <div className="bankTxMain"><label className="bankTxSelect" title={tx.status==='conciliado'?'Desfaça a conciliação antes de excluir':'Selecionar linha para exclusão'}><input type="checkbox" checked={Boolean(selectedTransactions[tx.id])} disabled={!canEdit||busy||tx.status==='conciliado'} onChange={()=>toggleTransactionSelection(tx)}/></label><div className="bankTxDate"><div className="bankTxDateLine"><strong>{dateBr(tx.data_lancamento)}</strong><span>{tx.fitid}</span></div>{showingAllJournals&&<small className="bankTxJournal">{txJournal?.nome||'Diário'}</small>}</div><div className="bankTxDesc"><strong>{tx.nome||tx.historico||'Transação bancária'}</strong>{tx.historico&&!sameBankText(tx.historico,tx.nome)&&<span>{tx.historico}</span>}{tx.importacao_id&&imports.find(row=>row.id===tx.importacao_id)&&<small className="bankTxSource"><FileText size={11}/>{imports.find(row=>row.id===tx.importacao_id)!.arquivo}</small>}</div><strong className="bankTxAmount">{tx.valor>0?'+':''}{money(Number(tx.valor))}</strong><span className={'bankStatus '+tx.status}>{tx.status}</span></div>
    {screen==='transactions'&&tx.status!=='conciliado'&&<div className="bankTxQuickActions">
      <button className="bankReconcileButton" disabled={!canEdit||busy} onClick={()=>openReconcile(tx)}><Link2 size={15}/>Conciliar</button>
    </div>}
    {screen==='matching'&&tx.status!=='conciliado'&&<div className="bankMatchArea bankOdooMatch">
      {top?<div className={'bankSuggestion '+(high?'high':partial?'partial':'low')}><div><CheckCircle2 size={16}/><strong>{high?'Correspondência forte':partial?'Correspondência possível':'Sugestão'}</strong><span>{top.score}% · {top.reasons.join(' • ')}</span></div><span className="bankSuggestedTitle">{top.title.descricao} · {money(Math.max(0,Number(top.title.valor)-Number(top.title.valor_pago)))}</span></div>:<div className="bankNoMatch"><XCircle size={16}/><span>Sem correspondência automática.</span></div>}
      <div className="bankOdooActions">
        {top?<button className="bankReconcileButton" disabled={!canEdit||busy} onClick={()=>openReconcile(tx)}><Link2 size={15}/>Reconciliar</button>:<>
          <button disabled={!canEdit||busy} onClick={()=>setPartnerTx(tx)}><Building2 size={15}/>Definir parceiro</button>
          <button disabled={!canEdit||busy} onClick={()=>setAccountTx(tx)}><Landmark size={15}/>Definir conta</button>
        </>}
        <button disabled={!canEdit||busy} onClick={()=>void quickCreatePreset(tx,tx.trntype==='CREDIT'?'A receber':'A pagar')}>{tx.trntype==='CREDIT'?'A receber':'A pagar'}</button>
        {!top&&<button className="bankReconcileButton" disabled={!canEdit||busy} onClick={()=>openReconcile(tx)}><Link2 size={15}/>Reconciliar</button>}
        <div className="bankMoreWrap">
          <button type="button" className="bankMoreButton" onClick={()=>setActionMenuTx(actionMenuTx===tx.id?null:tx.id)} aria-expanded={actionMenuTx===tx.id}>•••</button>
          {actionMenuTx===tx.id&&<div className="bankMoreMenu">
            <button onClick={()=>{setActionMenuTx(null);setPartnerTx(tx)}}>Definir parceiro</button>
            <button onClick={()=>{setActionMenuTx(null);setAccountTx(tx)}}>Definir conta</button>
            <button onClick={()=>void quickCreatePreset(tx,'Taxas bancárias')}>Taxas bancárias</button>
            <button onClick={()=>void quickCreatePreset(tx,'Outros gastos')}>Outros gastos</button>
            <button onClick={()=>void quickCreate(tx)}>Lançamento rápido</button>
            <div className="bankMoreDivider"/>
            <button className="bankDangerMenu" onClick={()=>void deleteTransaction(tx)}>Excluir esta linha</button>
            <button className="bankDangerMenu" onClick={()=>void deleteStatementDay(tx)}>Excluir extrato deste dia</button>
          </div>}
        </div>
      </div>
      {(tx.parceiro_nome||tx.conta_categoria)&&<div className="bankTxMeta">{tx.parceiro_nome&&<span>Parceiro: <strong>{tx.parceiro_nome}</strong></span>}{tx.conta_categoria&&<span>Conta: <strong>{tx.conta_categoria}</strong></span>}</div>}
    </div>}
    {tx.status==='conciliado'&&canEdit&&<button className="bankUndoCompact" disabled={busy} onClick={()=>void undo(tx)}><Undo2 size={13}/>Desfazer</button>}
   </article></>
  })}</div>
  {visible.length===0&&<div className="bankEmpty"><WalletCards size={30}/><strong>Nenhuma transação encontrada</strong><span>Carregue um arquivo OFX, QFX ou CSV para este diário.</span></div>}

  {reconcileTx&&<div className="bankModalBackdrop"><div className="bankModal bankReconcileModal" role="dialog" aria-modal="true" aria-label="Pesquisar itens a reconciliar">
    <div className="bankModalHead"><div><strong>Pesquisar itens a reconciliar</strong><small>{reconcileTx.nome||reconcileTx.historico||'Transação'} · {money(Math.abs(Number(reconcileTx.valor)))}</small></div><button onClick={()=>{setReconcileTx(null);setSelected({});setReconcileDescription('')}}><XCircle size={18}/></button></div>
    <div className="bankSearch bankReconcileSearch"><Search size={15}/><input autoFocus value={reconcileSearch} onChange={e=>setReconcileSearch(e.target.value)} placeholder="Buscar parceiro, fatura, descrição, vencimento, valor..."/></div>
    <div className="bankReconcileSummary"><span>{reconcileTx.trntype==='CREDIT'?'Contas a receber':'Contas a pagar'}</span><strong>{reconcileCandidates.length} título(s) disponível(is)</strong></div>
    <div className="bankReconcileList">{reconcileCandidates.map(title=>{
      const balance=Math.max(0,Number(title.valor)-Number(title.valor_pago))
      const suggestion=suggestions(reconcileTx).find(s=>s.title.id===title.id)
      return <label key={title.id} className={selected[title.id]!=null?'selected':''}>
        <input type="checkbox" checked={selected[title.id]!=null} onChange={()=>toggleTitle(title)}/>
        <span><strong>{title.descricao}</strong><small>{title.entidade_nome||'Sem parceiro'} · venc. {dateBr(title.vencimento)} · saldo {money(balance)}</small></span>
        {suggestion?<b>{suggestion.score}%</b>:<b>—</b>}
        {selected[title.id]!=null&&<input className="bankAlloc" type="number" min="0.01" max={balance} step="0.01" value={selected[title.id]} onChange={e=>setSelected(prev=>{
          const otherTotal=Object.entries(prev).filter(([id])=>id!==title.id).reduce((sum,[,value])=>sum+Number(value||0),0)
          const bankTotal=reconcileTx?Math.abs(Number(reconcileTx.valor)):0
          const available=Math.max(0,bankTotal-(Number(adjustValue)||0)-otherTotal)
          return {...prev,[title.id]:Math.max(0,Math.min(balance,available,Number(e.target.value)||0))}
        })}/>}
      </label>
    })}{reconcileCandidates.length===0&&<div className="bankNoCandidates">Nenhum título em aberto encontrado para esta pesquisa.</div>}</div>
    <div className="bankReconcileAdjust"><label>Ajuste<select value={adjustType} onChange={e=>setAdjustType(e.target.value)}><option value="">Sem ajuste</option><option value="juros_passivos">Juros passivos</option><option value="desconto_concedido">Desconto concedido</option><option value="tarifa">Tarifa bancária</option><option value="outro">Outro</option></select></label>{adjustType&&<label>Valor do ajuste<input type="number" min="0" step="0.01" value={adjustValue} onChange={e=>setAdjustValue(e.target.value)}/></label>}<label className="bankReconcileDescription">Descrição da conciliação<input type="text" maxLength={120} value={reconcileDescription} onChange={e=>setReconcileDescription(e.target.value)} placeholder="Ex.: Boletos antecipados"/></label></div>
    <div className={'bankReconcileBalance '+(reconcileExcess?'excess':reconcileResidual?'residual':'balanced')}>
      <div><span>Valor da linha do extrato</span><strong>{money(reconcileBankTotal)}</strong></div>
      <div><span>Faturas selecionadas</span><strong>{money(selectedReconcileTotal)}</strong></div>
      {reconcileAdjustment>0&&<div><span>Ajuste</span><strong>{money(reconcileAdjustment)}</strong></div>}
      <div className="bankReconcileDifference"><span>{reconcileExcess?'Excedente ajustado':reconcileResidual?'Residual da linha':'Conciliação fechada'}</span><strong>{reconcileExcess?money(0):reconcileResidual?money(reconcileResidual):money(0)}</strong></div>
      {reconcileExcess>0&&<small>O sistema limita automaticamente a última fatura selecionada para não ultrapassar o valor do extrato.</small>}
      {reconcileResidual>0&&<small>Você pode confirmar parcialmente. O saldo restante continuará pendente para uma nova conciliação.</small>}
      {reconcileBalanced&&<small>O valor do extrato foi totalmente distribuído. A última fatura pode ficar parcialmente paga.</small>}
    </div>
    <div className="bankModalActions bankReconcileActions"><span>Selecionado {money(selectedReconcileTotal)} / Banco {money(reconcileBankTotal)}</span><div><button onClick={()=>{setReconcileTx(null);setSelected({})}}>Fechar</button><button className="bankPrimary" disabled={!canEdit||busy||!Object.keys(selected).length} onClick={()=>void reconcile(reconcileTx)}>{reconcileResidual>0.009?'Conciliar parcialmente':'Selecionar e conciliar'}</button></div></div>
  </div></div>}
  {adjustmentOpen&&<div className="bankModalBackdrop"><form className="bankModal" onSubmit={createAdjustment}><div className="bankModalHead"><strong>Novo ajuste</strong><button type="button" onClick={()=>setAdjustmentOpen(false)}><XCircle size={18}/></button></div><p>Crie uma entrada ou saída manual no diário Ajustes. O registro ficará pendente para conciliação.</p><div className="bankFormGrid"><label>Tipo<select name="tipo" defaultValue="entrada"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label>Data<input name="data" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Valor<input name="valor" type="number" min="0.01" step="0.01" required/></label><label>Categoria<input name="categoria" placeholder="Opcional"/></label></div><label>Descrição<input name="descricao" minLength={3} required placeholder="Motivo do ajuste"/></label><label>Centro de custo<input name="centro_custo" placeholder="Opcional"/></label><div className="bankModalActions"><button type="button" onClick={()=>setAdjustmentOpen(false)}>Cancelar</button><button className="bankPrimary" disabled={busy}>{busy?'Salvando…':'Salvar ajuste'}</button></div></form></div>}
  {partnerTx&&<div className="bankModalBackdrop"><form className="bankModal" onSubmit={savePartner}><div className="bankModalHead"><strong>Definir parceiro</strong><button type="button" onClick={()=>setPartnerTx(null)}><XCircle size={18}/></button></div><p>Associe o movimento bancário a um cliente ou fornecedor, como no fluxo de conciliação do Odoo.</p><label>Parceiro<input type="hidden" name="parceiro" value={partnerTx.parceiro_nome?(partnerTx.parceiro_tipo||'outro')+'|'+partnerTx.parceiro_nome:''}/><SearchableSelect required value={partnerTx.parceiro_nome?(partnerTx.parceiro_tipo||'outro')+'|'+partnerTx.parceiro_nome:''} onChange={value=>{const [tipo,...parts]=value.split('|');setPartnerTx({...partnerTx,parceiro_tipo:(tipo||null) as BankTx['parceiro_tipo'],parceiro_nome:parts.join('|')||null})}} placeholder="Selecione" searchPlaceholder="Pesquisar cliente, fornecedor ou documento..." options={[...clients.map((p,i)=>({value:'cliente|'+p.nome,label:'Cliente · '+p.nome+(p.documento?' · '+p.documento:''),keywords:(p.nome+' '+(p.documento||''))})),...suppliers.map((p,i)=>({value:'fornecedor|'+p.nome,label:'Fornecedor · '+p.nome+(p.documento?' · '+p.documento:''),keywords:(p.nome+' '+(p.documento||''))}))]}/></label><div className="bankModalActions"><button type="button" onClick={()=>setPartnerTx(null)}>Cancelar</button><button className="bankPrimary" disabled={busy}>Salvar parceiro</button></div></form></div>}
  {accountTx&&<div className="bankModalBackdrop"><form className="bankModal" onSubmit={saveAccount}><div className="bankModalHead"><strong>Definir conta</strong><button type="button" onClick={()=>setAccountTx(null)}><XCircle size={18}/></button></div><p>Classifique a transação antes de conciliar ou criar um lançamento.</p><label>Conta<input type="hidden" name="categoria" value={accountTx.conta_categoria||''}/><SearchableSelect required value={accountTx.conta_categoria||''} onChange={value=>setAccountTx({...accountTx,conta_categoria:value||null})} placeholder="Selecione" searchPlaceholder="Pesquisar conta..." options={reconcileAccounts.map(a=>({value:a.nome,label:a.nome}))}/></label><label>Centro de custo<input name="centro_custo" defaultValue={accountTx.centro_custo||''} placeholder="Opcional"/></label><div className="bankModalActions"><button type="button" onClick={()=>setAccountTx(null)}>Cancelar</button><button className="bankPrimary" disabled={busy}>Salvar conta</button></div></form></div>}
  {uploadOpen&&<div className="bankModalBackdrop"><div className="bankModal" role="dialog" aria-modal="true" aria-label="Carregar extrato"><div className="bankModalHead"><strong>Carregar extrato</strong><button onClick={()=>setUploadOpen(false)}><XCircle size={18}/></button></div><p>O arquivo será atribuído automaticamente ao diário <strong>{journal?.nome}</strong>. FITIDs já importados serão descartados.</p><input ref={fileRef} type="file" disabled={busy} accept=".ofx,.qfx,.csv" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file)}}/><div className="bankUploadHint"><FileUp size={18}/><span>Formatos aceitos: OFX, QFX e CSV.</span></div></div></div>}
  {newJournalOpen&&<div className="bankModalBackdrop"><form className="bankModal" onSubmit={createJournal}><div className="bankModalHead"><strong>Novo diário bancário</strong><button type="button" onClick={()=>setNewJournalOpen(false)}><XCircle size={18}/></button></div><label>Nome<input name="nome" required/></label><div className="bankFormGrid"><label>Banco<input name="banco"/></label><label>Agência<input name="agencia"/></label><label>Conta<input name="conta"/></label><label>Saldo inicial<input name="saldo" type="number" step="0.01" defaultValue="0"/></label></div><div className="bankModalActions"><button type="button" onClick={()=>setNewJournalOpen(false)}>Cancelar</button><button className="bankPrimary" disabled={busy}>Criar diário</button></div></form></div>}
 </section>
}
