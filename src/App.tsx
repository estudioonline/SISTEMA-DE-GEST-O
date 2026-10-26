import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LayoutDashboard, Users, Package, Boxes, ShoppingCart, ReceiptText, WalletCards, BarChart3, Settings, Moon, Sun, Plus, Building2, LogOut, Trash2, FileDown } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { generateInvoicePdf } from './lib/invoicePdf'

type ModuleKey='dashboard'|'clientes'|'fornecedores'|'produtos'|'estoque'|'compras'|'vendas'|'financeiro'|'relatorios'|'config'
type Cliente={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;limite_credito:number;ativo:boolean}
type Produto={id:string;codigo:string;descricao:string;unidade:string;custo:number;preco_venda:number;estoque_atual:number;estoque_minimo:number;ativo:boolean}
type Venda={id:string;cliente_id:string|null;vendedor_id:string|null;status:string;subtotal:number;desconto:number;total:number;observacoes:string|null;created_at:string}
type VendaItem={produto_id:string;quantidade:number;valor_unitario:number;desconto:number;total:number}
type SaleItemDraft={key:string;produto_id:string;quantidade:number;valor_unitario:number;desconto:number}

const menu=[
  ['dashboard','Dashboard',LayoutDashboard],['clientes','Clientes',Users],['fornecedores','Fornecedores',Building2],
  ['produtos','Produtos',Package],['estoque','Estoque',Boxes],['compras','Compras',ShoppingCart],
  ['vendas','Vendas',ReceiptText],['financeiro','Financeiro',WalletCards],['relatorios','Relatórios',BarChart3],['config','Configurações',Settings]
] as const

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const newSaleItem=():SaleItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,valor_unitario:0,desconto:0})

function App(){
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(true)
  const [active,setActive]=useState<ModuleKey>('dashboard')
  const [dark,setDark]=useState(false)
  const [clientes,setClientes]=useState<Cliente[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [vendas,setVendas]=useState<Venda[]>([])
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [msg,setMsg]=useState('')
  const [showForm,setShowForm]=useState(false)
  const [saleClient,setSaleClient]=useState('')
  const [saleStatus,setSaleStatus]=useState('pedido')
  const [saleNotes,setSaleNotes]=useState('')
  const [saleItems,setSaleItems]=useState<SaleItemDraft[]>([newSaleItem()])
  const [savingSale,setSavingSale]=useState(false)
  const title=useMemo(()=>menu.find(m=>m[0]===active)?.[1]||'Dashboard',[active])

  useEffect(()=>{
    if(!supabaseConfigured){ setLoading(false); return }
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{ if(session) void loadData() },[session])

  async function loadData(){
    const [c,p,v]=await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('produtos').select('*').order('descricao'),
      supabase.from('vendas').select('*').order('created_at',{ascending:false}).limit(100)
    ])
    if(!c.error)setClientes((c.data||[]) as Cliente[])
    if(!p.error)setProdutos((p.data||[]) as Produto[])
    if(!v.error)setVendas((v.data||[]) as Venda[])
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

  function chooseProduct(itemKey:string,produtoId:string){
    const produto=produtos.find(p=>p.id===produtoId)
    setSaleItems(items=>items.map(item=>item.key===itemKey?{
      ...item,
      produto_id:produtoId,
      valor_unitario:produto?Number(produto.preco_venda):0
    }:item))
  }

  function updateSaleItem(itemKey:string,field:'quantidade'|'valor_unitario'|'desconto',value:number){
    setSaleItems(items=>items.map(item=>item.key===itemKey?{...item,[field]:Math.max(0,value||0)}:item))
  }

  function removeSaleItem(itemKey:string){
    setSaleItems(items=>items.length===1?items:items.filter(item=>item.key!==itemKey))
  }

  function resetSaleForm(){
    setSaleClient('')
    setSaleStatus('pedido')
    setSaleNotes('')
    setSaleItems([newSaleItem()])
  }

  async function createSale(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!session)return
    const validItems=saleItems.filter(i=>i.produto_id && i.quantidade>0)
    if(!validItems.length){setMsg('Adicione pelo menos um produto à venda.');return}

    if(saleStatus!=='orcamento'){
      const demanda=new Map<string,number>()
      validItems.forEach(item=>demanda.set(item.produto_id,(demanda.get(item.produto_id)||0)+item.quantidade))
      const semEstoque=[...demanda.entries()].find(([produtoId,quantidade])=>{
        const produto=produtos.find(p=>p.id===produtoId)
        return !produto || Number(produto.estoque_atual)<quantidade
      })
      if(semEstoque){
        const produto=produtos.find(p=>p.id===semEstoque[0])
        setMsg(`Estoque insuficiente para ${produto?.descricao||'o produto selecionado'}. Disponível: ${Number(produto?.estoque_atual||0).toLocaleString('pt-BR')}`)
        return
      }
    }

    const subtotal=validItems.reduce((sum,item)=>sum+(item.quantidade*item.valor_unitario),0)
    const desconto=validItems.reduce((sum,item)=>sum+Math.min(item.desconto,item.quantidade*item.valor_unitario),0)
    const total=Math.max(0,subtotal-desconto)

    setSavingSale(true)
    setMsg('')

    const {data:venda,error:vendaError}=await supabase.from('vendas').insert({
      cliente_id:saleClient||null,
      vendedor_id:session.user.id,
      status:saleStatus,
      subtotal,
      desconto,
      total,
      observacoes:saleNotes||null
    }).select('*').single()

    if(vendaError||!venda){
      setSavingSale(false)
      setMsg('Não foi possível criar a venda: '+(vendaError?.message||'erro desconhecido'))
      return
    }

    const itens=validItems.map(item=>({
      venda_id:venda.id,
      produto_id:item.produto_id,
      quantidade:item.quantidade,
      valor_unitario:item.valor_unitario,
      desconto:Math.min(item.desconto,item.quantidade*item.valor_unitario),
      total:Math.max(0,(item.quantidade*item.valor_unitario)-item.desconto)
    }))

    const {error:itemError}=await supabase.from('venda_itens').insert(itens)
    if(itemError){
      await supabase.from('vendas').update({
        status:'cancelado',
        observacoes:`Cancelada automaticamente por erro ao salvar itens. ${saleNotes}`.trim()
      }).eq('id',venda.id)
      setSavingSale(false)
      setMsg('A venda foi cancelada automaticamente porque os itens não puderam ser salvos: '+itemError.message)
      await loadData()
      return
    }

    const savedSale=venda as Venda
    try{
      const cliente=clientes.find(c=>c.id===saleClient)||null
      generateInvoicePdf({
        id:savedSale.id,
        created_at:savedSale.created_at||new Date().toISOString(),
        status:saleStatus,
        subtotal,
        desconto,
        total,
        observacoes:saleNotes||null,
        cliente,
        items:validItems.map(item=>{
          const produto=produtos.find(p=>p.id===item.produto_id)
          return {
            codigo:produto?.codigo,
            descricao:produto?.descricao||'Produto',
            unidade:produto?.unidade||'UN',
            quantidade:item.quantidade,
            valor_unitario:item.valor_unitario,
            desconto:Math.min(item.desconto,item.quantidade*item.valor_unitario),
            total:Math.max(0,(item.quantidade*item.valor_unitario)-item.desconto),
          }
        }),
      })
      setMsg('Venda criada com sucesso. O PDF da fatura foi gerado.')
    }catch{
      setMsg('Venda criada com sucesso, mas não foi possível gerar o PDF automaticamente.')
    }

    setSavingSale(false)
    setShowForm(false)
    resetSaleForm()
    await loadData()
  }

  async function downloadSalePdf(venda:Venda){
    setMsg('')
    const {data,error}=await supabase.from('venda_itens')
      .select('produto_id,quantidade,valor_unitario,desconto,total')
      .eq('venda_id',venda.id)

    if(error){
      setMsg('Não foi possível carregar os itens da venda para gerar o PDF: '+error.message)
      return
    }

    const itens=(data||[]) as VendaItem[]
    if(!itens.length){
      setMsg('Esta venda não possui itens para gerar a fatura.')
      return
    }

    const cliente=clientes.find(c=>c.id===venda.cliente_id)||null

    try{
      generateInvoicePdf({
        id:venda.id,
        created_at:venda.created_at,
        status:venda.status,
        subtotal:Number(venda.subtotal),
        desconto:Number(venda.desconto),
        total:Number(venda.total),
        observacoes:venda.observacoes,
        cliente,
        items:itens.map(item=>{
          const produto=produtos.find(p=>p.id===item.produto_id)
          return {
            codigo:produto?.codigo,
            descricao:produto?.descricao||'Produto',
            unidade:produto?.unidade||'UN',
            quantidade:Number(item.quantidade),
            valor_unitario:Number(item.valor_unitario),
            desconto:Number(item.desconto),
            total:Number(item.total),
          }
        }),
      })
    }catch{
      setMsg('Não foi possível gerar o PDF desta venda.')
    }
  }

  if(loading)return <div className="modulePlaceholder">Carregando...</div>
  if(!supabaseConfigured)return <div className="modulePlaceholder"><div className="panel" style={{maxWidth:620}}><h2>Sistema de Gestão publicado</h2><p>O frontend está online, mas as variáveis do Supabase ainda não estão configuradas.</p></div></div>
  if(!session)return <div className="modulePlaceholder"><form onSubmit={login} className="panel dataForm" style={{maxWidth:420,width:'100%'}}>
    <h2>Sistema de Gestão</h2><p>Acesse o ERP</p>
    <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
    <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
    <button className="primary">Entrar</button><button type="button" className="ghost" onClick={signup}>Criar conta</button>{msg&&<p>{msg}</p>}
  </form></div>

  const low=produtos.filter(p=>Number(p.estoque_atual)<=Number(p.estoque_minimo)).length
  const stockValue=produtos.reduce((s,p)=>s+Number(p.estoque_atual)*Number(p.custo),0)
  const monthSales=vendas.filter(v=>{
    const d=new Date(v.created_at),n=new Date()
    return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&v.status!=='cancelado'
  }).reduce((s,v)=>s+Number(v.total),0)
  const saleSubtotal=saleItems.reduce((sum,item)=>sum+(item.quantidade*item.valor_unitario),0)
  const saleDiscount=saleItems.reduce((sum,item)=>sum+Math.min(item.desconto,item.quantidade*item.valor_unitario),0)
  const saleTotal=Math.max(0,saleSubtotal-saleDiscount)

  return <div className={dark?'app dark':'app'}>
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">SG</div><div><strong>Sistema de Gestão</strong><span>ERP Empresarial</span></div></div>
      <nav>{menu.map(([k,l,I])=><button key={k} className={active===k?'navItem active':'navItem'} onClick={()=>{setActive(k as ModuleKey);setShowForm(false);setMsg('')}}><I size={18}/><span>{l}</span></button>)}</nav>
      <div className="sidebarFooter"><span>{session.user.email}</span><button className="navItem" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/><span>Sair</span></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><h1>{title}</h1><p>Supabase ORGJSS1</p></div><div className="topActions">
        <button className="iconBtn" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
        {(active==='clientes'||active==='produtos'||active==='vendas')&&<button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={17}/>{active==='vendas'?'Criar venda':'Novo'}</button>}
      </div></header>
      {msg&&<div className="panel noticePanel">{msg}</div>}

      {active==='dashboard'&&<section><div className="cards">
        <article className="card"><span>Clientes ativos</span><strong>{clientes.filter(c=>c.ativo).length}</strong><small>cadastros</small></article>
        <article className="card"><span>Produtos ativos</span><strong>{produtos.filter(p=>p.ativo).length}</strong><small>itens</small></article>
        <article className="card"><span>Vendas no mês</span><strong>{money(monthSales)}</strong><small>{vendas.filter(v=>v.status!=='cancelado').length} vendas registradas</small></article>
        <article className="card"><span>Estoque baixo</span><strong>{low}</strong><small>atenção</small></article>
      </div><ProductTable produtos={produtos}/></section>}

      {active==='clientes'&&<section>
        {showForm&&<form className="panel dataForm" onSubmit={addCliente}><input name="nome" placeholder="Nome / Razão social" required/><input name="documento" placeholder="CPF / CNPJ"/><input name="email" type="email" placeholder="E-mail"/><input name="telefone" placeholder="Telefone"/><input name="limite_credito" type="number" step="0.01" placeholder="Limite de crédito"/><button className="primary">Salvar</button></form>}
        <article className="panel tablePanel"><div className="panelHead"><h3>Clientes</h3></div><div className="tableWrap"><table><thead><tr><th>Nome</th><th>Documento</th><th>E-mail</th><th>Telefone</th><th>Limite</th></tr></thead><tbody>{clientes.map(c=><tr key={c.id}><td>{c.nome}</td><td>{c.documento||'—'}</td><td>{c.email||'—'}</td><td>{c.telefone||'—'}</td><td>{money(Number(c.limite_credito))}</td></tr>)}</tbody></table></div></article>
      </section>}

      {active==='produtos'&&<section>
        {showForm&&<form className="panel dataForm" onSubmit={addProduto}><input name="codigo" placeholder="Código" required/><input name="descricao" placeholder="Descrição" required/><input name="unidade" defaultValue="UN"/><input name="custo" type="number" step="0.01" placeholder="Custo"/><input name="preco_venda" type="number" step="0.01" placeholder="Preço de venda"/><input name="estoque_atual" type="number" step="0.001" placeholder="Estoque atual"/><input name="estoque_minimo" type="number" step="0.001" placeholder="Estoque mínimo"/><button className="primary">Salvar</button></form>}
        <ProductTable produtos={produtos}/>
      </section>}

      {active==='vendas'&&<section>
        {showForm&&<form className="panel saleForm" onSubmit={createSale}>
          <div className="saleHeader">
            <label>Cliente
              <select value={saleClient} onChange={e=>setSaleClient(e.target.value)}>
                <option value="">Consumidor / sem cliente</option>
                {clientes.filter(c=>c.ativo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label>Status
              <select value={saleStatus} onChange={e=>setSaleStatus(e.target.value)}>
                <option value="orcamento">Orçamento</option>
                <option value="pedido">Pedido</option>
                <option value="faturado">Faturado</option>
              </select>
            </label>
            <label className="saleNotes">Observações
              <input value={saleNotes} onChange={e=>setSaleNotes(e.target.value)} placeholder="Observações da venda"/>
            </label>
          </div>

          <div className="saleItemsHead"><h3>Itens da venda</h3><button type="button" className="ghost" onClick={()=>setSaleItems(items=>[...items,newSaleItem()])}><Plus size={16}/>Adicionar item</button></div>
          <div className="saleItems">
            {saleItems.map(item=>{
              const lineBase=item.quantidade*item.valor_unitario
              const lineTotal=Math.max(0,lineBase-item.desconto)
              return <div className="saleItemRow" key={item.key}>
                <select value={item.produto_id} onChange={e=>chooseProduct(item.key,e.target.value)} required>
                  <option value="">Selecione o produto</option>
                  {produtos.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.descricao} — estoque: {Number(p.estoque_atual).toLocaleString('pt-BR')}</option>)}
                </select>
                <input type="number" min="0.001" step="0.001" value={item.quantidade} onChange={e=>updateSaleItem(item.key,'quantidade',Number(e.target.value))} title="Quantidade"/>
                <input type="number" min="0" step="0.01" value={item.valor_unitario} onChange={e=>updateSaleItem(item.key,'valor_unitario',Number(e.target.value))} title="Valor unitário"/>
                <input type="number" min="0" step="0.01" value={item.desconto} onChange={e=>updateSaleItem(item.key,'desconto',Number(e.target.value))} title="Desconto"/>
                <strong>{money(lineTotal)}</strong>
                <button type="button" className="iconBtn dangerBtn" onClick={()=>removeSaleItem(item.key)} title="Remover item"><Trash2 size={16}/></button>
              </div>
            })}
          </div>

          <div className="saleTotals">
            <div><span>Subtotal</span><strong>{money(saleSubtotal)}</strong></div>
            <div><span>Desconto</span><strong>{money(saleDiscount)}</strong></div>
            <div className="grandTotal"><span>Total</span><strong>{money(saleTotal)}</strong></div>
          </div>
          <div className="saleActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);resetSaleForm()}}>Cancelar</button><button className="primary" disabled={savingSale}>{savingSale?'Salvando...':'Salvar venda'}</button></div>
        </form>}

        <article className="panel tablePanel">
          <div className="panelHead"><div><h3>Vendas</h3><p>{vendas.length} registros</p></div></div>
          <div className="tableWrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Status</th><th>Subtotal</th><th>Desconto</th><th>Total</th><th>Fatura</th></tr></thead>
            <tbody>{vendas.map(v=>{
              const cliente=clientes.find(c=>c.id===v.cliente_id)
              return <tr key={v.id}><td>{new Date(v.created_at).toLocaleString('pt-BR')}</td><td>{cliente?.nome||'Consumidor'}</td><td><span className={`statusBadge status-${v.status}`}>{v.status}</span></td><td>{money(Number(v.subtotal))}</td><td>{money(Number(v.desconto))}</td><td><strong>{money(Number(v.total))}</strong></td><td><button className="ghost" onClick={()=>void downloadSalePdf(v)}><FileDown size={15}/>PDF</button></td></tr>
            })}</tbody>
          </table></div>
        </article>
      </section>}

      {!['dashboard','clientes','produtos','vendas'].includes(active)&&<section className="modulePlaceholder"><h2>{title}</h2><p>Módulo preparado para a próxima etapa.</p></section>}
    </main>
  </div>
}

function ProductTable({produtos}:{produtos:Produto[]}){return <article className="panel tablePanel"><div className="panelHead"><h3>Produtos</h3></div><div className="tableWrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Un.</th><th>Estoque</th><th>Custo</th><th>Venda</th></tr></thead><tbody>{produtos.map(p=><tr key={p.id}><td>{p.codigo}</td><td>{p.descricao}</td><td>{p.unidade}</td><td>{Number(p.estoque_atual).toLocaleString('pt-BR')}</td><td>{money(Number(p.custo))}</td><td>{money(Number(p.preco_venda))}</td></tr>)}</tbody></table></div></article>}

export default App
