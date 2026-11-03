import {useCallback,useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Coins,RefreshCw,Save,Settings2,UserPlus,UserRound,PlusCircle} from 'lucide-react'
import {supabase} from './lib/supabase'
import {ProductLookup} from './ProductLookup'
import './production-earnings.css'

type Rule={id:string;chave:string;funcionario_id:string|null;funcionario_nome:string;servico_nome:string;produto_id:string|null;descricao_contem:string;unidade:string;criterio:'quantidade'|'valor_percentual';valor_unitario:number;percentual:number;ativo:boolean}
type Product={id:string;codigo:string;descricao:string;unidade:string;tipo_produto:string|null;preco_venda:number;custo:number;estoque_atual:number;ativo:boolean}
type Employee={id:string;nome:string;cargo:string|null;ativo:boolean}
type Sale={id:string;venda_numero:number|null;fatura_numero:number|null;cliente_id:string|null;status:string;created_at:string}
type Client={id:string;nome:string}
type Item={id:string;venda_id:string;produto_id:string|null;quantidade:number;valor_unitario:number;total:number}
type Entry={id:string;venda_item_id:string;regra_id:string;funcionario_nome:string;servico_nome:string;unidade:string;quantidade:number;valor_base:number;valor_unitario:number;percentual:number;valor_calculado:number;status:string;concluido_em:string|null}

const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0)
const qty=(n:number)=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2})
const saleNo=(s:Sale)=>'S'+String(s.venda_numero||s.fatura_numero||0).padStart(5,'0')

export function ProductionEarnings({canEdit,management=false}:{canEdit:boolean;management?:boolean}){
  const [rules,setRules]=useState<Rule[]>([])
  const [products,setProducts]=useState<Product[]>([])
  const [employees,setEmployees]=useState<Employee[]>([])
  const [sales,setSales]=useState<Sale[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [items,setItems]=useState<Item[]>([])
  const [entries,setEntries]=useState<Entry[]>([])
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')
  const [showConfig,setShowConfig]=useState(management)
  const [savedRule,setSavedRule]=useState<string|null>(null)
  const [newEmployee,setNewEmployee]=useState({nome:'',cargo:''})
  const [newRule,setNewRule]=useState({funcionario_id:'',servico_nome:'',produto_id:'',criterio:'quantidade' as Rule['criterio'],valor_unitario:0,percentual:0})

  const loadAllProducts=useCallback(async()=>{
    const pageSize=1000
    const all:Product[]=[]
    for(let from=0;;from+=pageSize){
      const {data,error}=await supabase
        .from('produtos')
        .select('id,codigo,descricao,unidade,tipo_produto,preco_venda,custo,estoque_atual,ativo')
        .eq('ativo',true)
        .order('descricao')
        .range(from,from+pageSize-1)
      if(error)throw error
      const page=(data||[]) as Product[]
      all.push(...page)
      if(page.length<pageSize)break
    }
    return all
  },[])

  const load=useCallback(async()=>{
    setMsg('')
    try{
    const [rr,p,em,s,c,i,e]=await Promise.all([
      supabase.from('producao_regras').select('*').order('funcionario_nome').order('servico_nome'),
      loadAllProducts(),
      supabase.from('funcionarios').select('id,nome,cargo,ativo').eq('ativo',true).order('nome'),
      supabase.from('vendas').select('id,venda_numero,fatura_numero,cliente_id,status,created_at').eq('status','pedido').order('created_at',{ascending:false}),
      supabase.from('clientes').select('id,nome'),
      supabase.from('venda_itens').select('id,venda_id,produto_id,quantidade,valor_unitario,total'),
      supabase.from('producao_apontamentos').select('*').order('criado_em',{ascending:false})
    ])
    const error=rr.error||em.error||s.error||c.error||i.error||e.error
    if(error)throw error
    setRules((rr.data||[]) as Rule[]);setProducts(p);setEmployees((em.data||[]) as Employee[]);setSales((s.data||[]) as Sale[]);setClients((c.data||[]) as Client[]);setItems((i.data||[]) as Item[]);setEntries((e.data||[]) as Entry[])
    }catch(e){setMsg((e as Error).message)}
  },[loadAllProducts])

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
        if(!rule.ativo||!rule.produto_id||item.produto_id!==rule.produto_id)continue
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
    const names=[...new Set([...rules.filter(r=>r.ativo).map(r=>r.funcionario_nome),...entries.map(e=>e.funcionario_nome)])]
    return names.map(name=>{
      const rs=rules.filter(r=>r.ativo&&r.funcionario_nome===name)
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
        venda_id:candidate.sale.id,venda_item_id:candidate.item.id,regra_id:candidate.rule.id,
        funcionario_id:candidate.rule.funcionario_id,funcionario_nome:candidate.rule.funcionario_nome,
        servico_nome:candidate.rule.servico_nome,unidade:candidate.rule.unidade,
        quantidade:Number(candidate.item.quantidade||0),valor_base:Number(candidate.item.total||0),
        valor_unitario:Number(candidate.rule.valor_unitario||0),percentual:Number(candidate.rule.percentual||0),
        valor_calculado:Number(candidate.amount.toFixed(2)),status:'concluido',concluido_em:new Date().toISOString(),
        criado_por:user?.id||null,atualizado_por:user?.id||null,atualizado_em:new Date().toISOString()
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
      setSavedRule(rule.id)
      window.setTimeout(()=>setSavedRule(current=>current===rule.id?null:current),1800)
      await load()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }

  async function linkProduct(rule:Rule,productId:string){
    const selected=products.find(p=>p.id===productId)
    if(!selected)return
    await saveRule(rule,{produto_id:productId,descricao_contem:selected.descricao,unidade:rule.criterio==='quantidade'?selected.unidade:rule.unidade})
  }

  async function createEmployee(){
    const nome=newEmployee.nome.trim(),cargo=newEmployee.cargo.trim()
    if(!canEdit||busy||!nome)return
    setBusy(true);setMsg('')
    try{
      const {error}=await supabase.from('funcionarios').insert({nome,cargo:cargo||'Produção',ativo:true})
      if(error)throw error
      setNewEmployee({nome:'',cargo:''})
      await load()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }

  async function createRule(){
    if(!canEdit||busy||!newRule.funcionario_id||!newRule.produto_id||!newRule.servico_nome.trim())return
    const employee=employees.find(e=>e.id===newRule.funcionario_id)
    const selected=products.find(p=>p.id===newRule.produto_id)
    if(!employee||!selected)return
    setBusy(true);setMsg('')
    try{
      const payload={
        chave:'custom_'+crypto.randomUUID(),
        funcionario_id:employee.id,funcionario_nome:employee.nome,servico_nome:newRule.servico_nome.trim(),
        produto_id:selected.id,descricao_contem:selected.descricao,
        unidade:newRule.criterio==='quantidade'?selected.unidade:'PERCENTUAL',
        criterio:newRule.criterio,valor_unitario:Number(newRule.valor_unitario||0),percentual:Number(newRule.percentual||0),ativo:true
      }
      const {error}=await supabase.from('producao_regras').insert(payload)
      if(error)throw error
      setNewRule({funcionario_id:'',servico_nome:'',produto_id:'',criterio:'quantidade',valor_unitario:0,percentual:0})
      await load()
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  }

  return <section className="prodEarn">
    {!management&&<div className="prodEarnHead">
      <div><span>PRODUÇÃO</span><h3>Ganhos por produção</h3><p>Controle por trabalhador, produto executado e regra de remuneração.</p></div>
      <div className="prodEarnActions">
        <button onClick={()=>setShowConfig(v=>!v)}><Settings2 size={15}/>Regras</button>
        <button onClick={()=>void load()}><RefreshCw size={15}/>Atualizar</button>
      </div>
    </div>}

    {management&&<div className="prodEarnHead">
      <div><span>PRODUÇÃO</span><h3>Equipe e funções</h3><p>Cadastre funcionários e crie novas funções vinculadas aos produtos existentes no SG.</p></div>
      <button onClick={()=>void load()}><RefreshCw size={15}/>Atualizar</button>
    </div>}

    {msg&&<div className="prodEarnNotice">{msg}</div>}

    {showConfig&&<section className="prodConfig">
      <header>
        <div><strong>Regras e valores de produção</strong><small>O produto é escolhido diretamente do cadastro existente. Não há mais vínculo por texto.</small></div>
        <span className="prodConfigHint">Cada regra aponta para um produto específico do SG.</span>
      </header>
      <div className="prodConfigRows">
        {rules.map(rule=><div className={'prodConfigRow'+(!rule.ativo?' inactive':'')} key={rule.id}>
          <label><span>Responsável</span><select value={rule.funcionario_id||''} disabled={!canEdit||busy} onChange={e=>{
            const emp=employees.find(x=>x.id===e.target.value)
            if(emp)void saveRule(rule,{funcionario_id:emp.id,funcionario_nome:emp.nome})
          }}><option value="">{rule.funcionario_nome} (não vinculado)</option>{employees.map(emp=><option key={emp.id} value={emp.id}>{emp.nome}{emp.cargo?' · '+emp.cargo:''}</option>)}</select></label>
          <label><span>Função / serviço</span><input defaultValue={rule.servico_nome} disabled={!canEdit||busy} onBlur={e=>{const value=e.target.value.trim();if(value&&value!==rule.servico_nome)void saveRule(rule,{servico_nome:value})}}/></label>
          <div className="prodLinkedProduct"><span>Produto vinculado</span><ProductLookup products={products} value={rule.produto_id||''} onSelect={id=>void linkProduct(rule,id)} fullWidth/></div>
          <label><span>Cálculo</span><select value={rule.criterio} disabled={!canEdit||busy} onChange={e=>{
            const criterio=e.target.value as Rule['criterio']
            const p=product(rule.produto_id)
            void saveRule(rule,{criterio,unidade:criterio==='quantidade'?(p?.unidade||rule.unidade):'PERCENTUAL'})
          }}><option value="quantidade">Por quantidade</option><option value="valor_percentual">% do valor</option></select></label>
          {rule.criterio==='valor_percentual'
            ? <label><span>Percentual (%)</span><input type="number" min="0" step="0.01" defaultValue={rule.percentual} disabled={!canEdit||busy} onBlur={e=>{const value=Number(e.target.value||0);if(value!==Number(rule.percentual))void saveRule(rule,{percentual:value})}}/></label>
            : <label><span>R$ / {(product(rule.produto_id)?.unidade||rule.unidade).toLowerCase()}</span><input type="number" min="0" step="0.01" defaultValue={rule.valor_unitario} disabled={!canEdit||busy} onBlur={e=>{const value=Number(e.target.value||0);if(value!==Number(rule.valor_unitario))void saveRule(rule,{valor_unitario:value})}}/></label>}
          <label className="prodActiveField"><span>Regra</span><span className="prodToggle"><input type="checkbox" checked={rule.ativo} disabled={!canEdit||busy} onChange={e=>void saveRule(rule,{ativo:e.target.checked})}/>{rule.ativo?'Ativa':'Inativa'}</span></label>
          <span className={'prodAutoSave'+(savedRule===rule.id?' saved':'')}><Save size={14}/>{savedRule===rule.id?'Salvo':'Auto'}</span>
        </div>)}
      </div>
    </section>}

    {management&&<div className="prodManagementGrid">
      <section className="prodCreateCard">
        <header><UserPlus size={18}/><div><strong>Novo funcionário</strong><small>O cadastro entra na lista geral de funcionários do SG.</small></div></header>
        <label><span>Nome</span><input value={newEmployee.nome} onChange={e=>setNewEmployee(v=>({...v,nome:e.target.value}))} placeholder="Nome do funcionário"/></label>
        <label><span>Função / cargo</span><input value={newEmployee.cargo} onChange={e=>setNewEmployee(v=>({...v,cargo:e.target.value}))} placeholder="Ex.: Vulcanização, Costura, Montagem"/></label>
        <button className="prodConfirm" disabled={!canEdit||busy||!newEmployee.nome.trim()} onClick={()=>void createEmployee()}><UserPlus size={15}/>Criar funcionário</button>
      </section>

      <section className="prodCreateCard">
        <header><PlusCircle size={18}/><div><strong>Nova função de produção</strong><small>Selecione um funcionário e um produto já existente.</small></div></header>
        <label><span>Funcionário</span><select value={newRule.funcionario_id} onChange={e=>setNewRule(v=>({...v,funcionario_id:e.target.value}))}><option value="">Selecionar funcionário</option>{employees.map(emp=><option key={emp.id} value={emp.id}>{emp.nome}{emp.cargo?' · '+emp.cargo:''}</option>)}</select></label>
        <label><span>Nome da função / serviço</span><input value={newRule.servico_nome} onChange={e=>setNewRule(v=>({...v,servico_nome:e.target.value}))} placeholder="Ex.: Solda especial"/></label>
        <div className="prodLinkedProduct"><span>Produto existente</span><ProductLookup products={products} value={newRule.produto_id} onSelect={id=>setNewRule(v=>({...v,produto_id:id}))} fullWidth/></div>
        <label><span>Forma de cálculo</span><select value={newRule.criterio} onChange={e=>setNewRule(v=>({...v,criterio:e.target.value as Rule['criterio']}))}><option value="quantidade">Valor por quantidade</option><option value="valor_percentual">Percentual do valor</option></select></label>
        {newRule.criterio==='quantidade'
          ? <label><span>Valor por unidade do produto</span><input type="number" min="0" step="0.01" value={newRule.valor_unitario} onChange={e=>setNewRule(v=>({...v,valor_unitario:Number(e.target.value||0)}))}/></label>
          : <label><span>Percentual (%)</span><input type="number" min="0" step="0.01" value={newRule.percentual} onChange={e=>setNewRule(v=>({...v,percentual:Number(e.target.value||0)}))}/></label>}
        <button className="prodConfirm" disabled={!canEdit||busy||!newRule.funcionario_id||!newRule.produto_id||!newRule.servico_nome.trim()} onClick={()=>void createRule()}><PlusCircle size={15}/>Criar função</button>
      </section>
    </div>}

    {!management&&<>
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
            <div><span>Produção</span><strong>{c.rule.chave==='israel_aluminio'
              ? qty(c.item.quantidade)+' '+c.product.unidade+' · '+money(Number(c.item.total||0))
              : c.rule.criterio==='valor_percentual'
                ? money(Number(c.item.total||0))
                : qty(c.item.quantidade)+' '+c.product.unidade}</strong></div>
            <div><span>Regra</span><strong>{c.rule.chave==='israel_aluminio'
              ? qty(c.rule.percentual)+'% do valor definido na venda'
              : c.rule.criterio==='valor_percentual'
                ? qty(c.rule.percentual)+'%'
                : money(c.rule.valor_unitario)+' / '+c.product.unidade}</strong></div>
            <div><span>A receber</span><strong>{money(c.amount)}</strong></div>
            <button className="prodConfirm" disabled={!canEdit||busy} onClick={()=>void register(c)}><CheckCircle2 size={15}/>Concluir</button>
          </div>)}
          {!candidates.length&&<div className="prodEmpty">Nenhum produto vinculado aguardando apontamento.</div>}
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
    </>}
  </section>
}
