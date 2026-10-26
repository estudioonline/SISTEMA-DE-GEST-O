import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LayoutDashboard, Users, Package, Boxes, ShoppingCart, ReceiptText, WalletCards, BarChart3, Settings, Moon, Sun, Plus, Building2, LogOut } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'

type ModuleKey='dashboard'|'clientes'|'fornecedores'|'produtos'|'estoque'|'compras'|'vendas'|'financeiro'|'relatorios'|'config'
type Cliente={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;limite_credito:number;ativo:boolean}
type Produto={id:string;codigo:string;descricao:string;unidade:string;custo:number;preco_venda:number;estoque_atual:number;estoque_minimo:number;ativo:boolean}

const menu=[
  ['dashboard','Dashboard',LayoutDashboard],['clientes','Clientes',Users],['fornecedores','Fornecedores',Building2],
  ['produtos','Produtos',Package],['estoque','Estoque',Boxes],['compras','Compras',ShoppingCart],
  ['vendas','Vendas',ReceiptText],['financeiro','Financeiro',WalletCards],['relatorios','Relatórios',BarChart3],['config','Configurações',Settings]
] as const

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)

function App(){
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(true)
  const [active,setActive]=useState<ModuleKey>('dashboard')
  const [dark,setDark]=useState(false)
  const [clientes,setClientes]=useState<Cliente[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [msg,setMsg]=useState('')
  const [showForm,setShowForm]=useState(false)
  const title=useMemo(()=>menu.find(m=>m[0]===active)?.[1]||'Dashboard',[active])

  useEffect(()=>{
    if(!supabaseConfigured){ setLoading(false); return }
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{ if(session) void loadData() },[session])

  async function loadData(){
    const [c,p]=await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('produtos').select('*').order('descricao')
    ])
    if(!c.error)setClientes((c.data||[]) as Cliente[])
    if(!p.error)setProdutos((p.data||[]) as Produto[])
  }

  async function login(e:FormEvent){
    e.preventDefault(); setMsg('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error)setMsg(error.message)
  }

  async function signup(){
    setMsg('')
    const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:email.split('@')[0]}}})
    setMsg(error?error.message:'Conta criada. Verifique seu e-mail se a confirmação estiver habilitada.')
  }

  async function addCliente(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget)
    const {error}=await supabase.from('clientes').insert({
      nome:String(f.get('nome')||''),documento:String(f.get('documento')||'')||null,
      email:String(f.get('email')||'')||null,telefone:String(f.get('telefone')||'')||null,
      limite_credito:Number(f.get('limite_credito')||0)
    })
    setMsg(error?error.message:'Cliente cadastrado.')
    if(!error){setShowForm(false);await loadData()}
  }

  async function addProduto(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget)
    const {error}=await supabase.from('produtos').insert({
      codigo:String(f.get('codigo')||''),descricao:String(f.get('descricao')||''),unidade:String(f.get('unidade')||'UN'),
      custo:Number(f.get('custo')||0),preco_venda:Number(f.get('preco_venda')||0),
      estoque_atual:Number(f.get('estoque_atual')||0),estoque_minimo:Number(f.get('estoque_minimo')||0)
    })
    setMsg(error?error.message:'Produto cadastrado.')
    if(!error){setShowForm(false);await loadData()}
  }

  if(loading)return <div className="modulePlaceholder">Carregando...</div>
  if(!supabaseConfigured)return <div className="modulePlaceholder"><div className="panel" style={{maxWidth:620}}><h2>Sistema de Gestão publicado</h2><p>O frontend está online, mas as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY ainda não estão configuradas no GitHub Actions.</p></div></div>
  if(!session)return <div className="modulePlaceholder"><form onSubmit={login} className="panel dataForm" style={{maxWidth:420,width:'100%'}}>
    <h2>Sistema de Gestão</h2><p>Acesse o ERP</p>
    <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
    <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
    <button className="primary">Entrar</button><button type="button" className="ghost" onClick={signup}>Criar conta</button>{msg&&<p>{msg}</p>}
  </form></div>

  const low=produtos.filter(p=>Number(p.estoque_atual)<=Number(p.estoque_minimo)).length
  const stockValue=produtos.reduce((s,p)=>s+Number(p.estoque_atual)*Number(p.custo),0)

  return <div className={dark?'app dark':'app'}>
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">SG</div><div><strong>Sistema de Gestão</strong><span>ERP Empresarial</span></div></div>
      <nav>{menu.map(([k,l,I])=><button key={k} className={active===k?'navItem active':'navItem'} onClick={()=>{setActive(k as ModuleKey);setShowForm(false);setMsg('')}}><I size={18}/><span>{l}</span></button>)}</nav>
      <div className="sidebarFooter"><span>{session.user.email}</span><button className="navItem" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/><span>Sair</span></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><h1>{title}</h1><p>Supabase ORGJSS1</p></div><div className="topActions">
        <button className="iconBtn" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
        {(active==='clientes'||active==='produtos')&&<button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={17}/>Novo</button>}
      </div></header>
      {msg&&<div className="panel" style={{marginBottom:14}}>{msg}</div>}

      {active==='dashboard'&&<section><div className="cards">
        <article className="card"><span>Clientes ativos</span><strong>{clientes.filter(c=>c.ativo).length}</strong><small>cadastros</small></article>
        <article className="card"><span>Produtos ativos</span><strong>{produtos.filter(p=>p.ativo).length}</strong><small>itens</small></article>
        <article className="card"><span>Estoque baixo</span><strong>{low}</strong><small>atenção</small></article>
        <article className="card"><span>Valor de custo</span><strong>{money(stockValue)}</strong><small>estoque atual</small></article>
      </div><ProductTable produtos={produtos}/></section>}

      {active==='clientes'&&<section>
        {showForm&&<form className="panel dataForm" onSubmit={addCliente}><input name="nome" placeholder="Nome / Razão social" required/><input name="documento" placeholder="CPF / CNPJ"/><input name="email" type="email" placeholder="E-mail"/><input name="telefone" placeholder="Telefone"/><input name="limite_credito" type="number" step="0.01" placeholder="Limite de crédito"/><button className="primary">Salvar</button></form>}
        <article className="panel tablePanel"><div className="panelHead"><h3>Clientes</h3></div><div className="tableWrap"><table><thead><tr><th>Nome</th><th>Documento</th><th>E-mail</th><th>Telefone</th><th>Limite</th></tr></thead><tbody>{clientes.map(c=><tr key={c.id}><td>{c.nome}</td><td>{c.documento||'—'}</td><td>{c.email||'—'}</td><td>{c.telefone||'—'}</td><td>{money(Number(c.limite_credito))}</td></tr>)}</tbody></table></div></article>
      </section>}

      {active==='produtos'&&<section>
        {showForm&&<form className="panel dataForm" onSubmit={addProduto}><input name="codigo" placeholder="Código" required/><input name="descricao" placeholder="Descrição" required/><input name="unidade" defaultValue="UN"/><input name="custo" type="number" step="0.01" placeholder="Custo"/><input name="preco_venda" type="number" step="0.01" placeholder="Preço de venda"/><input name="estoque_atual" type="number" step="0.001" placeholder="Estoque atual"/><input name="estoque_minimo" type="number" step="0.001" placeholder="Estoque mínimo"/><button className="primary">Salvar</button></form>}
        <ProductTable produtos={produtos}/>
      </section>}

      {!['dashboard','clientes','produtos'].includes(active)&&<section className="modulePlaceholder"><h2>{title}</h2><p>Módulo preparado para a próxima etapa.</p></section>}
    </main>
  </div>
}

function ProductTable({produtos}:{produtos:Produto[]}){return <article className="panel tablePanel"><div className="panelHead"><h3>Produtos</h3></div><div className="tableWrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Un.</th><th>Estoque</th><th>Custo</th><th>Venda</th></tr></thead><tbody>{produtos.map(p=><tr key={p.id}><td>{p.codigo}</td><td>{p.descricao}</td><td>{p.unidade}</td><td>{Number(p.estoque_atual).toLocaleString('pt-BR')}</td><td>{money(Number(p.custo))}</td><td>{money(Number(p.preco_venda))}</td></tr>)}</tbody></table></div></article>}

export default App
