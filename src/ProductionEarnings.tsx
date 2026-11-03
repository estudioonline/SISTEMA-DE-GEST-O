import {useCallback,useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Coins,RefreshCw,Save,Settings2,UserRound} from 'lucide-react'
import {supabase} from './lib/supabase'
import './production-earnings.css'

type Rule={id:string;chave:string;funcionario_id:string|null;funcionario_nome:string;servico_nome:string;descricao_contem:string;unidade:string;criterio:'quantidade'|'valor_percentual';valor_unitario:number;percentual:number;ativo:boolean}
type Product={id:string;descricao:string;unidade:string|null;tipo_produto:string|null}
type Sale={id:string;venda_numero:number|null;fatura_numero:number|null;cliente_id:string|null;status:string;created_at:string}
type Client={id:string;nome:string}
type Item={id:string;venda_id:string;produto_id:string|null;quantidade:number;valor_unitario:number;total:number}
type Entry={id:string;venda_item_id:string;regra_id:string;funcionario_nome:string;servico_nome:string;unidade:string;quantidade:number;valor_base:number;valor_unitario:number;percentual:number;valor_calculado:number;status:string;concluido_em:string|null}

const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0)
const qty=(n:number)=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2})
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
const saleNo=(s:Sale)=>'S'+String(s.venda_numero||s.fatura_numero||0).padStart(5,'0')

export function ProductionEarnings({canEdit}:{canEdit:boolean}){
  const [rules,setRules]=useState<Rule[]>([])
  const [products,setProducts]=useState<Product[]>([])
  const [sales,setSales]=useState<Sale[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [items,setItems]=useState<Item[]>([])
  const [entries,setEntries]=useState<Entry[]>([])
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')
  const [showConfig,setShowConfig]=useState(false)

  const load=useCallback(async()=>{
    setMsg('')
    const [rr,p,s,c,i,e]=await Promise.all([
      supabase.from('producao_regras').select('*').eq('ativo',true).order('funcionario_nome').order('servico_nome'),
      supabase.from('produtos').select('id,descricao,unidade,tipo_produto'),
      supabase.from('vendas').select('id,venda_numero,fatura_numero,cliente_id,status,created_at').eq('status','pedido').order('created_at',{ascending:false}),
      supabase.from('clientes').select('id,nome'),
      supabase.from('venda_itens').select('id,venda_id,produto_id,quantidade,valor_unitario,total'),
      supabase.from('producao_apontamentos').select('*').order('criado_em',{ascending:false})
    ])
    const error=rr.error||p.error||s.error||c.error||i.error||e.error
    if(error){setMsg(error.message);return}
    setRules((rr.data||[]) as Rule[]);setProducts((p.data||[]) as Product[]);setSales((s.data||[]) as Sale[]);setClients((c.data||[]) as Client[]);setItems((i.data||[]) as Item[]);setEntries((e.data||[]) as Entry[])
  },[])

  useEffect(()=>{void load()},[load])

  const product=(id:string|null)=>products.find(p=>p.id===id)
  const sale=(id:string)=>sales.find(s=>s.id===id)
  const client=(id:string|null)=>clients.find(c=>c.id===id)?.nome||'Cliente'

  const candidates=useMemo(()=>{
    const out:Array<{rule:Rule;item:Item;sale:Sale;product:Product;amount:number}>=[]
    for(const item of items){
      const s=sale(item.venda_id)
      const p=product(item.produto_id)
      if(!s||!p)continue
      for(const rule of rules){
        if(!normalize(p.descricao).includes(normalize(rule.descricao_contem)))continue
        const already=entries.some(e=>e.venda_item_id===item.id&&e.regra_id===rule.id)
        if(already)continue
        const amount=rule.criterio==='valor_percentual'
          ? Number(item.total||0)*(Number(rule.percentual||0)/100)
          : Number(item.quantidade||0)*Number(rule.valor_unitario||0)
        out.push({rule,item,sale:s,product:p,amount})
      }
    }
    return out
  },[items,rules,sales,products,entries])

  const workers=useMemo(()=>{
    const names=[...new Set([...rules.map(r=>r.funcionario_nome),...entries.map(e=>e.funcionario_nome)])]
    return names.map(name=>{
      const rs=rules.filter(r=>r.funcionario_nome===name)
      const pending=candidates.filter(c=>c.rule.funcionario_nome===name)
      const done=entries.filter(e=>e.funcionario_nome===name)
      return {
        name,rs,pending,done,
        pendingValue:pending.reduce((a,c)=>a+c.amount,0),
        concludedValue:done.filter(e=>e.status==='concluido'||e.status==='fechado'||e.status==='pago').reduce((a,e)=>a+Number(e.valor_calculado||0),0)
      }
    })
  },[rules,entries,candidates])

  async function register(candidate:{rule:Rule;item:Item;sale:Sale;product:Product;amount:number}){
    if(!canEdit||busy)return
    setBusy(true);setMsg('')
    try{
      const {data:{user}}=await supabase.auth.getUser()
      const payload={
        venda_id:candidate.sale.id,
        venda_item_id:candidate.item.id,
        regra_id:candidate.rule.id,
        funcionario_id:candidate.rule.funcionario_id,
        funcionario_nome:candidate.rule.funcionario_nome,
        servico_nome:candidate.rule.servico_nome,
        unidade:candidate.rule.unidade,
        quantidade:Number(candidate.item.quantidade||0),
        valor_base:Number(candidate.item.total||0),
        valor_unitario:Number(candidate.rule.valor_unitario||0),
        percentual:Number(candidate.rule.percentual||0),
        valor_calculado:Number(candidate.amount.toFixed(2)),
        status:'concluido',
        concluido_em:new Date().toISOString(),
        criado_por:user?.id||null,
        atualizado_por:user?.id||null,
        atualizado_em:new Date().toISOString()
      }
      const {error}=await supabase.from('producao_apontamentos').insert(payload)
      if(error)throw error
      await load()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }

  async function saveRule(rule:Rule,patch:Partial<Rule>){
    if(!canEdit||busy)return
    setBusy(true);setMsg('')
    try{
      const {error}=await supabase.from('producao_regras').update({...patch,atualizado_em:new Date().toISOString()}).eq('id',rule.id)
      if(error)throw error
      await load()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }

  return <section className="prodEarn">
    <div className="prodEarnHead">
      <div><span>PRODUÇÃO</span><h3>Ganhos por produção</h3><p>Controle por trabalhador, serviço executado e regra de remuneração.</p></div>
      <div className="prodEarnActions">
        <button onClick={()=>setShowConfig(v=>!v)}><Settings2 size={15}/>Valores</button>
        <button onClick={()=>void load()}><RefreshCw size={15}/>Atualizar</button>
      </div>
    </div>

    {msg&&<div className="prodEarnNotice">{msg}</div>}

    {showConfig&&<section className="prodConfig">
      <header><div><strong>Valores de produção</strong><small>Os valores ficam editáveis e cada tipo de solda do Abimael é calculado separadamente.</small></div></header>
      <div className="prodConfigRows">
        {rules.map(rule=><div className="prodConfigRow" key={rule.id}>
          <div><strong>{rule.funcionario_nome}</strong><small>{rule.servico_nome}</small></div>
          <span className="prodRuleUnit">{rule.criterio==='valor_percentual'?'% do valor':rule.unidade}</span>
          {rule.criterio==='valor_percentual'
            ? <label><span>Percentual</span><input type="number" min="0" step="0.01" defaultValue={rule.percentual} disabled={!canEdit||busy} onBlur={e=>void saveRule(rule,{percentual:Number(e.target.value||0)})}/></label>
            : <label><span>R$ / {rule.unidade.toLowerCase()}</span><input type="number" min="0" step="0.01" defaultValue={rule.valor_unitario} disabled={!canEdit||busy} onBlur={e=>void saveRule(rule,{valor_unitario:Number(e.target.value||0)})}/></label>}
          <Save size={15}/>
        </div>)}
      </div>
    </section>}

    <div className="prodWorkerGrid">
      {workers.map(worker=><article className="prodWorkerCard" key={worker.name}>
        <header>
          <span className="prodWorkerIcon"><UserRound size={20}/></span>
          <div><strong>{worker.name}</strong><small>{worker.rs.map(r=>r.servico_nome).join(' · ')}</small></div>
          <div className="prodWorkerValue"><span>Produzido</span><b>{money(worker.concludedValue)}</b></div>
        </header>
        <div className="prodWorkerStats">
          <div><span>Pendentes</span><strong>{worker.pending.length}</strong></div>
          <div><span>Valor previsto</span><strong>{money(worker.pendingValue)}</strong></div>
          <div><span>Concluídos</span><strong>{worker.done.filter(e=>e.status!=='pendente').length}</strong></div>
        </div>
      </article>)}
    </div>

    <section className="prodListSection">
      <header><div><strong>Aguardando apontamento</strong><small>O ganho só entra no total quando a produção for confirmada.</small></div><b>{candidates.length}</b></header>
      <div className="prodRows">
        {candidates.map(c=><div className="prodRow" key={c.item.id+'-'+c.rule.id}>
          <div className="prodMain"><strong>{c.rule.funcionario_nome} · {c.rule.servico_nome}</strong><small>{saleNo(c.sale)} · {client(c.sale.cliente_id)} · {c.product.descricao}</small></div>
          <div><span>Produção</span><strong>{c.rule.criterio==='valor_percentual'?money(Number(c.item.total||0)):qty(c.item.quantidade)+' '+c.rule.unidade}</strong></div>
          <div><span>Regra</span><strong>{c.rule.criterio==='valor_percentual'?qty(c.rule.percentual)+'%':money(c.rule.valor_unitario)+' / '+c.rule.unidade}</strong></div>
          <div><span>A receber</span><strong>{money(c.amount)}</strong></div>
          <button className="prodConfirm" disabled={!canEdit||busy} onClick={()=>void register(c)}><CheckCircle2 size={15}/>Concluir</button>
        </div>)}
        {!candidates.length&&<div className="prodEmpty">Nenhum serviço de produção aguardando apontamento.</div>}
      </div>
    </section>

    <section className="prodListSection completed">
      <header><div><strong>Produção concluída</strong><small>Histórico já lançado para cálculo de ganhos.</small></div><b>{entries.length}</b></header>
      <div className="prodRows">
        {entries.slice(0,80).map(e=>{
          const i=items.find(x=>x.id===e.venda_item_id)
          const s=i?sale(i.venda_id):null
          return <div className="prodRow compact" key={e.id}>
            <span className="prodDoneIcon"><Coins size={16}/></span>
            <div className="prodMain"><strong>{e.funcionario_nome} · {e.servico_nome}</strong><small>{s?saleNo(s):'Venda'} · {e.concluido_em?new Date(e.concluido_em).toLocaleDateString('pt-BR'):'—'}</small></div>
            <div><span>Quantidade/base</span><strong>{e.unidade==='PERCENTUAL'?money(e.valor_base):qty(e.quantidade)+' '+e.unidade}</strong></div>
            <div><span>Ganho</span><strong>{money(e.valor_calculado)}</strong></div>
            <span className="prodStatus">{e.status}</span>
          </div>
        })}
      </div>
    </section>
  </section>
}
