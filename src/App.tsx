import { Fragment, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, ReceiptText, WalletCards,
  BarChart3, Settings, Moon, Sun, Plus, Building2, LogOut, Trash2, FileDown,
  Pencil, Ban, SlidersHorizontal, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { generateInvoicePdf } from './lib/invoicePdf'

type ModuleKey='dashboard'|'clientes'|'fornecedores'|'produtos'|'estoque'|'compras'|'vendas'|'financeiro'|'relatorios'|'config'
type PerfilRole='administrador'|'financeiro'|'vendas'|'estoque'
type PaymentMethod='pix'|'cartao'|'boleto'

type Cliente={
  id:string
  nome:string
  documento:string|null
  email:string|null
  telefone:string|null
  limite_credito:number
  ativo:boolean
}

type Produto={
  id:string
  codigo:string
  descricao:string
  unidade:string
  custo:number
  preco_venda:number
  estoque_atual:number
  estoque_minimo:number
  ativo:boolean
}

type Venda={
  id:string
  cliente_id:string|null
  vendedor_id:string|null
  status:string
  subtotal:number
  desconto:number
  total:number
  observacoes:string|null
  created_at:string
  forma_pagamento:PaymentMethod
  parcelas:number
  primeiro_vencimento:string
  fatura_numero:number|null
  fatura_gerada_em:string|null
}

type VendaItem={
  produto_id:string
  quantidade:number
  valor_unitario:number
  desconto:number
  total:number
}

type SaleItemDraft={
  key:string
  produto_id:string
  quantidade:number
  valor_unitario:number
  desconto:number
}

const menu=[
  ['dashboard','Dashboard',LayoutDashboard],['clientes','Clientes',Users],['fornecedores','Fornecedores',Building2],
  ['produtos','Produtos',Package],['estoque','Estoque',Boxes],['compras','Compras',ShoppingCart],
  ['vendas','Vendas',ReceiptText],['financeiro','Financeiro',WalletCards],['relatorios','Relatórios',BarChart3],['config','Configurações',Settings]
] as const

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const dateBr=(v:string)=>v ? new Intl.DateTimeFormat('pt-BR').format(new Date(v+'T12:00:00')) : '—'
const today=()=>new Date().toISOString().slice(0,10)
const invoiceNo=(n:number|null|undefined)=>String(n||0).padStart(7,'0')
const newSaleItem=():SaleItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,valor_unitario:0,desconto:0})

function App(){
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(true)
  const [active,setActive]=useState<ModuleKey>('dashboard')
  const [dark,setDark]=useState(false)
  const [profileRole,setProfileRole]=useState<PerfilRole>('vendas')
  const [clientes,setClientes]=useState<Cliente[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [vendas,setVendas]=useState<Venda[]>([])
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [msg,setMsg]=useState('')
  const [showForm,setShowForm]=useState(false)

  const [editingProduct,setEditingProduct]=useState<Produto|null>(null)
  const [productPanel,setProductPanel]=useState<string|null>(null)
  const [adjustingProduct,setAdjustingProduct]=useState<Produto|null>(null)
  const [stockNew,setStockNew]=useState('')
  const [stockReason,setStockReason]=useState('Ajuste manual')

  const [editingSale,setEditingSale]=useState<Venda|null>(null)
  const [salePanel,setSalePanel]=useState<string|null>(null)
  const [saleClient,setSaleClient]=useState('')
  const [saleStatus,setSaleStatus]=useState('pedido')
  const [saleNotes,setSaleNotes]=useState('')
  const [salePayment,setSalePayment]=useState<PaymentMethod>('pix')
  const [saleInstallments,setSaleInstallments]=useState(1)
  const [saleDueDate,setSaleDueDate]=useState(today())
  const [saleItems,setSaleItems]=useState<SaleItemDraft[]>([newSaleItem()])
  const [savingSale,setSavingSale]=useState(false)

  const title=useMemo(()=>menu.find(m=>m[0]===active)?.[1]||'Dashboard',[active])
  const isAdmin=profileRole==='administrador'

  useEffect(()=>{
    if(!supabaseConfigured){setLoading(false);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{if(session)void loadData()},[session])

  async function loadData(){
    if(!session)return
    const [c,p,v,pr]=await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('produtos').select('*').order('descricao'),
      supabase.from('vendas').select('*').order('created_at',{ascending:false}).limit(200),
      supabase.from('profiles').select('perfil').eq('id',session.user.id).maybeSingle()
    ])
    if(!c.error)setClientes((c.data||[]) as Cliente[])
    if(!p.error)setProdutos((p.data||[]) as Produto[])
    if(!v.error)setVendas((v.data||[]) as Venda[])
    if(!pr.error&&pr.data?.perfil)setProfileRole(pr.data.perfil as PerfilRole)
  }

  async function login(e:FormEvent){
    e.preventDefault();setMsg('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error)setMsg(error.message)
  }

  async function signup(){
    setMsg('')
    const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:email.split('@')[0]}}})
    setMsg(error?error.message:'Conta criada. Verifique seu e-mail se a confirmação estiver habilitada.')
  }

  async function addCliente(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const f=new FormData(e.currentTarget)
    const {error}=await supabase.from('clientes').insert({
      nome:String(f.get('nome')||''),
      documento:String(f.get('documento')||'')||null,
      email:String(f.get('email')||'')||null,
      telefone:String(f.get('telefone')||'')||null,
      limite_credito:Number(f.get('limite_credito')||0)
    })
    setMsg(error?error.message:'Cliente cadastrado.')
    if(!error){setShowForm(false);await loadData()}
  }

  function startNewProduct(){
    setEditingProduct(null)
    setAdjustingProduct(null)
    setShowForm(true)
    setMsg('')
  }

  function startEditProduct(produto:Produto){
    setEditingProduct(produto)
    setAdjustingProduct(null)
    setShowForm(true)
    setMsg('')
  }

  async function saveProduct(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const f=new FormData(e.currentTarget)
    const base={
      codigo:String(f.get('codigo')||''),
      descricao:String(f.get('descricao')||''),
      unidade:String(f.get('unidade')||'UN'),
      custo:Number(f.get('custo')||0),
      preco_venda:Number(f.get('preco_venda')||0),
      estoque_minimo:Number(f.get('estoque_minimo')||0),
      ativo:String(f.get('ativo')||'true')==='true'
    }

    const result=editingProduct
      ? await supabase.from('produtos').update(base).eq('id',editingProduct.id)
      : await supabase.from('produtos').insert({...base,estoque_atual:Number(f.get('estoque_atual')||0)})

    setMsg(result.error?result.error.message:editingProduct?'Produto atualizado.':'Produto cadastrado.')
    if(!result.error){
      setEditingProduct(null)
      setShowForm(false)
      await loadData()
    }
  }

  function startAdjustStock(produto:Produto){
    setAdjustingProduct(produto)
    setStockNew(String(produto.estoque_atual))
    setStockReason('Ajuste manual')
    setShowForm(false)
    setMsg('')
  }

  async function adjustStock(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!adjustingProduct)return
    const novo=Number(stockNew)
    const {error}=await supabase.rpc('ajustar_estoque_produto',{
      p_produto_id:adjustingProduct.id,
      p_novo_estoque:novo,
      p_motivo:stockReason
    })
    setMsg(error?error.message:'Estoque ajustado e movimento registrado.')
    if(!error){
      setAdjustingProduct(null)
      await loadData()
    }
  }

  async function deleteProduct(produto:Produto){
    if(!window.confirm(`Excluir o produto "${produto.descricao}"?`))return
    const {error}=await supabase.from('produtos').delete().eq('id',produto.id)
    if(error?.code==='23503'){
      const fallback=await supabase.from('produtos').update({ativo:false}).eq('id',produto.id)
      setMsg(fallback.error?fallback.error.message:'O produto possui histórico e foi desativado em vez de apagado.')
    }else{
      setMsg(error?error.message:'Produto excluído.')
    }
    await loadData()
  }

  function resetSaleForm(){
    setEditingSale(null)
    setSaleClient('')
    setSaleStatus('pedido')
    setSaleNotes('')
    setSalePayment('pix')
    setSaleInstallments(1)
    setSaleDueDate(today())
    setSaleItems([newSaleItem()])
  }

  function startNewSale(){
    resetSaleForm()
    setShowForm(true)
    setMsg('')
  }

  async function startEditSale(venda:Venda){
    if(venda.status==='cancelado'){
      setMsg('Venda cancelada não pode ser editada.')
      return
    }

    const {data,error}=await supabase.from('venda_itens')
      .select('produto_id,quantidade,valor_unitario,desconto,total')
      .eq('venda_id',venda.id)

    if(error){
      setMsg('Não foi possível abrir a venda: '+error.message)
      return
    }

    const itens=(data||[]) as VendaItem[]
    setEditingSale(venda)
    setSaleClient(venda.cliente_id||'')
    setSaleStatus(venda.status)
    setSaleNotes(venda.observacoes||'')
    setSalePayment(venda.forma_pagamento||'pix')
    setSaleInstallments(Number(venda.parcelas)||1)
    setSaleDueDate(venda.primeiro_vencimento||today())
    setSaleItems(itens.map(item=>({
      key:`${Date.now()}-${Math.random()}`,
      produto_id:item.produto_id,
      quantidade:Number(item.quantidade),
      valor_unitario:Number(item.valor_unitario),
      desconto:Number(item.desconto)
    })))
    setShowForm(true)
    setMsg('')
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

  function changePayment(value:PaymentMethod){
    setSalePayment(value)
    if(value==='pix')setSaleInstallments(1)
    if(value==='cartao')setSaleInstallments(v=>Math.min(Math.max(v,1),12))
    if(value==='boleto')setSaleInstallments(v=>Math.min(Math.max(v,1),24))
  }

  function pdfItems(items:SaleItemDraft[]){
    return items.map(item=>{
      const produto=produtos.find(p=>p.id===item.produto_id)
      const desconto=Math.min(item.desconto,item.quantidade*item.valor_unitario)
      return {
        codigo:produto?.codigo,
        descricao:produto?.descricao||'Produto',
        unidade:produto?.unidade||'UN',
        quantidade:item.quantidade,
        valor_unitario:item.valor_unitario,
        desconto,
        total:Math.max(0,(item.quantidade*item.valor_unitario)-desconto)
      }
    })
  }

  async function saveSale(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!session)return

    const validItems=saleItems.filter(i=>i.produto_id&&i.quantidade>0)
    if(!validItems.length){setMsg('Adicione pelo menos um produto à venda.');return}

    const maxInstallments=salePayment==='pix'?1:salePayment==='cartao'?12:24
    if(saleInstallments<1||saleInstallments>maxInstallments){
      setMsg(`Quantidade de parcelas inválida para ${salePayment}.`)
      return
    }

    setSavingSale(true)
    setMsg('')

    const args={
      p_cliente_id:saleClient||null,
      p_status:saleStatus,
      p_forma_pagamento:salePayment,
      p_parcelas:saleInstallments,
      p_primeiro_vencimento:saleDueDate,
      p_observacoes:saleNotes,
      p_itens:validItems.map(i=>({
        produto_id:i.produto_id,
        quantidade:i.quantidade,
        valor_unitario:i.valor_unitario,
        desconto:i.desconto
      }))
    }

    const result=editingSale
      ? await supabase.rpc('atualizar_venda_completa',{p_venda_id:editingSale.id,...args})
      : await supabase.rpc('criar_venda_completa',args)

    if(result.error||!result.data){
      setSavingSale(false)
      setMsg('Não foi possível salvar a venda: '+(result.error?.message||'erro desconhecido'))
      return
    }

    const saved=(Array.isArray(result.data)?result.data[0]:result.data) as Venda
    const subtotal=validItems.reduce((sum,item)=>sum+(item.quantidade*item.valor_unitario),0)
    const desconto=validItems.reduce((sum,item)=>sum+Math.min(item.desconto,item.quantidade*item.valor_unitario),0)
    const total=Math.max(0,subtotal-desconto)
    const cliente=clientes.find(c=>c.id===saleClient)||null

    try{
      generateInvoicePdf({
        id:saved.id,
        fatura_numero:saved.fatura_numero,
        created_at:saved.created_at||new Date().toISOString(),
        status:saved.status,
        subtotal,
        desconto,
        total,
        observacoes:saleNotes||null,
        forma_pagamento:salePayment,
        parcelas:saleInstallments,
        primeiro_vencimento:saleDueDate,
        cliente,
        items:pdfItems(validItems)
      })
      await supabase.from('vendas').update({fatura_gerada_em:new Date().toISOString()}).eq('id',saved.id)
      setMsg(editingSale?'Venda atualizada e nova fatura PDF emitida.':'Venda criada e fatura PDF emitida.')
    }catch{
      setMsg('Venda salva e fatura registrada. O PDF pode ser reemitido pelo painel da venda.')
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
        fatura_numero:venda.fatura_numero,
        created_at:venda.created_at,
        status:venda.status,
        subtotal:Number(venda.subtotal),
        desconto:Number(venda.desconto),
        total:Number(venda.total),
        observacoes:venda.observacoes,
        forma_pagamento:venda.forma_pagamento,
        parcelas:Number(venda.parcelas),
        primeiro_vencimento:venda.primeiro_vencimento,
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
            total:Number(item.total)
          }
        })
      })
      await supabase.from('vendas').update({fatura_gerada_em:new Date().toISOString()}).eq('id',venda.id)
    }catch{
      setMsg('Não foi possível gerar o PDF desta venda.')
    }
  }

  async function cancelSale(venda:Venda){
    if(venda.status==='cancelado')return
    if(!window.confirm(`Cancelar a fatura ${invoiceNo(venda.fatura_numero)}? O estoque será estornado e as parcelas em aberto serão canceladas.`))return

    const {error}=await supabase.from('vendas').update({status:'cancelado'}).eq('id',venda.id)
    setMsg(error?error.message:'Venda cancelada. Estoque e financeiro foram estornados.')
    if(!error){
      setSalePanel(null)
      await loadData()
    }
  }

  async function deleteSale(venda:Venda){
    if(!isAdmin){
      setMsg('Somente administrador pode excluir uma venda.')
      return
    }
    if(!window.confirm(`Excluir definitivamente a fatura ${invoiceNo(venda.fatura_numero)}? Essa ação apaga a venda e suas parcelas, preservando os movimentos de estoque.`))return

    const {error}=await supabase.from('vendas').delete().eq('id',venda.id)
    setMsg(error?error.message:'Venda excluída. Estoque restaurado quando aplicável.')
    if(!error){
      setSalePanel(null)
      await loadData()
    }
  }

  if(loading)return <div className="modulePlaceholder">Carregando...</div>
  if(!supabaseConfigured)return <div className="modulePlaceholder"><div className="panel" style={{maxWidth:620}}><h2>Sistema de Gestão publicado</h2><p>O frontend está online, mas as variáveis do Supabase ainda não estão configuradas.</p></div></div>
  if(!session)return <div className="modulePlaceholder"><form onSubmit={login} className="panel dataForm" style={{maxWidth:420,width:'100%'}}>
    <h2>Sistema de Gestão</h2><p>Acesse o ERP</p>
    <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
    <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
    <button className="primary">Entrar</button>
    <button type="button" className="ghost" onClick={signup}>Criar conta</button>
    {msg&&<p>{msg}</p>}
  </form></div>

  const low=produtos.filter(p=>p.ativo&&Number(p.estoque_atual)<=Number(p.estoque_minimo)).length
  const stockValue=produtos.reduce((s,p)=>s+Number(p.estoque_atual)*Number(p.custo),0)
  const monthSales=vendas.filter(v=>{
    const d=new Date(v.created_at),n=new Date()
    return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&v.status!=='cancelado'
  }).reduce((s,v)=>s+Number(v.total),0)
  const saleSubtotal=saleItems.reduce((sum,item)=>sum+(item.quantidade*item.valor_unitario),0)
  const saleDiscount=saleItems.reduce((sum,item)=>sum+Math.min(item.desconto,item.quantidade*item.valor_unitario),0)
  const saleTotal=Math.max(0,saleSubtotal-saleDiscount)

  function headerAction(){
    if(active==='vendas')startNewSale()
    else if(active==='produtos')startNewProduct()
    else setShowForm(v=>!v)
  }

  const productSection=(mode:'produtos'|'estoque')=><section>
    {mode==='produtos'&&showForm&&<form className="panel dataForm" onSubmit={saveProduct}>
      <input name="codigo" placeholder="Código" required defaultValue={editingProduct?.codigo||''}/>
      <input name="descricao" placeholder="Descrição" required defaultValue={editingProduct?.descricao||''}/>
      <input name="unidade" defaultValue={editingProduct?.unidade||'UN'}/>
      <input name="custo" type="number" step="0.01" placeholder="Custo" defaultValue={editingProduct?.custo||0}/>
      <input name="preco_venda" type="number" step="0.01" placeholder="Preço de venda" defaultValue={editingProduct?.preco_venda||0}/>
      {!editingProduct&&<input name="estoque_atual" type="number" step="0.001" placeholder="Estoque inicial" defaultValue={0}/>}
      <input name="estoque_minimo" type="number" step="0.001" placeholder="Estoque mínimo" defaultValue={editingProduct?.estoque_minimo||0}/>
      <select name="ativo" defaultValue={editingProduct?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select>
      <div className="formActions">
        <button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingProduct(null)}}>Cancelar</button>
        <button className="primary">{editingProduct?'Salvar alterações':'Cadastrar produto'}</button>
      </div>
    </form>}

    {adjustingProduct&&<form className="panel stockForm" onSubmit={adjustStock}>
      <div><strong>Ajustar estoque</strong><span>{adjustingProduct.codigo} - {adjustingProduct.descricao}</span></div>
      <label>Novo estoque<input type="number" min="0" step="0.001" value={stockNew} onChange={e=>setStockNew(e.target.value)} required/></label>
      <label>Motivo<input value={stockReason} onChange={e=>setStockReason(e.target.value)} required/></label>
      <div className="formActions">
        <button type="button" className="ghost" onClick={()=>setAdjustingProduct(null)}>Cancelar</button>
        <button className="primary">Aplicar ajuste</button>
      </div>
    </form>}

    {mode==='estoque'&&<div className="cards compactCards">
      <article className="card"><span>Produtos ativos</span><strong>{produtos.filter(p=>p.ativo).length}</strong><small>itens</small></article>
      <article className="card"><span>Estoque baixo</span><strong>{low}</strong><small>atenção</small></article>
      <article className="card"><span>Valor de custo</span><strong>{money(stockValue)}</strong><small>estoque atual</small></article>
    </div>}

    <ProductTable
      produtos={produtos}
      openId={productPanel}
      onToggle={id=>setProductPanel(productPanel===id?null:id)}
      onEdit={startEditProduct}
      onAdjust={startAdjustStock}
      onDelete={deleteProduct}
      canDelete={isAdmin}
    />
  </section>

  return <div className={dark?'app dark':'app'}>
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">SG</div><div><strong>Sistema de Gestão</strong><span>ERP Empresarial</span></div></div>
      <nav>{menu.map(([k,l,I])=><button key={k} className={active===k?'navItem active':'navItem'} onClick={()=>{
        setActive(k as ModuleKey);setShowForm(false);setEditingProduct(null);setAdjustingProduct(null);resetSaleForm();setMsg('')
      }}><I size={18}/><span>{l}</span></button>)}</nav>
      <div className="sidebarFooter">
        <span>{session.user.email}</span>
        <small>{profileRole}</small>
        <button className="navItem" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/><span>Sair</span></button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><h1>{title}</h1><p>Supabase ORGJSS1</p></div>
        <div className="topActions">
          <button className="iconBtn" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
          {(active==='clientes'||active==='produtos'||active==='vendas')&&<button className="primary" onClick={headerAction}><Plus size={17}/>{active==='vendas'?'Criar venda':active==='produtos'?'Novo produto':'Novo'}</button>}
        </div>
      </header>

      {msg&&<div className="panel noticePanel">{msg}</div>}

      {active==='dashboard'&&<section>
        <div className="cards">
          <article className="card"><span>Clientes ativos</span><strong>{clientes.filter(c=>c.ativo).length}</strong><small>cadastros</small></article>
          <article className="card"><span>Produtos ativos</span><strong>{produtos.filter(p=>p.ativo).length}</strong><small>itens</small></article>
          <article className="card"><span>Vendas no mês</span><strong>{money(monthSales)}</strong><small>{vendas.filter(v=>v.status!=='cancelado').length} vendas registradas</small></article>
          <article className="card"><span>Estoque baixo</span><strong>{low}</strong><small>atenção</small></article>
        </div>
        <ProductTable
          produtos={produtos}
          openId={productPanel}
          onToggle={id=>setProductPanel(productPanel===id?null:id)}
          onEdit={startEditProduct}
          onAdjust={startAdjustStock}
          onDelete={deleteProduct}
          canDelete={isAdmin}
        />
      </section>}

      {active==='clientes'&&<section>
        {showForm&&<form className="panel dataForm" onSubmit={addCliente}>
          <input name="nome" placeholder="Nome / Razão social" required/>
          <input name="documento" placeholder="CPF / CNPJ"/>
          <input name="email" type="email" placeholder="E-mail"/>
          <input name="telefone" placeholder="Telefone"/>
          <input name="limite_credito" type="number" step="0.01" placeholder="Limite de crédito"/>
          <button className="primary">Salvar</button>
        </form>}
        <article className="panel tablePanel">
          <div className="panelHead"><h3>Clientes</h3></div>
          <div className="tableWrap"><table>
            <thead><tr><th>Nome</th><th>Documento</th><th>E-mail</th><th>Telefone</th><th>Limite</th></tr></thead>
            <tbody>{clientes.map(c=><tr key={c.id}><td>{c.nome}</td><td>{c.documento||'—'}</td><td>{c.email||'—'}</td><td>{c.telefone||'—'}</td><td>{money(Number(c.limite_credito))}</td></tr>)}</tbody>
          </table></div>
        </article>
      </section>}

      {active==='produtos'&&productSection('produtos')}
      {active==='estoque'&&productSection('estoque')}

      {active==='vendas'&&<section>
        {showForm&&<form className="panel saleForm" onSubmit={saveSale}>
          <div className="formTitle">
            <div><h3>{editingSale?`Editar fatura ${invoiceNo(editingSale.fatura_numero)}`:'Nova venda / fatura'}</h3><p>Forma de pagamento é obrigatória para concluir a venda.</p></div>
          </div>

          <div className="saleHeader saleHeaderExpanded">
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
            <label>Pagamento
              <select value={salePayment} onChange={e=>changePayment(e.target.value as PaymentMethod)} required>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
              </select>
            </label>
            <label>Parcelas
              <select value={saleInstallments} onChange={e=>setSaleInstallments(Number(e.target.value))} disabled={salePayment==='pix'}>
                {Array.from({length:salePayment==='pix'?1:salePayment==='cartao'?12:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x</option>)}
              </select>
            </label>
            <label>Primeiro vencimento
              <input type="date" value={saleDueDate} onChange={e=>setSaleDueDate(e.target.value)} required/>
            </label>
            <label className="saleNotes">Observações
              <input value={saleNotes} onChange={e=>setSaleNotes(e.target.value)} placeholder="Observações da venda"/>
            </label>
          </div>

          <div className="paymentNotice">
            <strong>Fatura obrigatória</strong>
            <span>{salePayment==='pix'?'PIX à vista':salePayment==='cartao'?`Cartão em ${saleInstallments}x`:`Boleto em ${saleInstallments}x`} - 1º vencimento {dateBr(saleDueDate)}</span>
          </div>

          <div className="saleItemsHead">
            <h3>Itens da venda</h3>
            <button type="button" className="ghost" onClick={()=>setSaleItems(items=>[...items,newSaleItem()])}><Plus size={16}/>Adicionar item</button>
          </div>

          <div className="saleItems">
            {saleItems.map(item=>{
              const lineBase=item.quantidade*item.valor_unitario
              const lineTotal=Math.max(0,lineBase-item.desconto)
              return <div className="saleItemRow" key={item.key}>
                <select value={item.produto_id} onChange={e=>chooseProduct(item.key,e.target.value)} required>
                  <option value="">Selecione o produto</option>
                  {produtos.filter(p=>p.ativo||p.id===item.produto_id).map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.descricao} — estoque: {Number(p.estoque_atual).toLocaleString('pt-BR')}</option>)}
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

          <div className="saleActions">
            <button type="button" className="ghost" onClick={()=>{setShowForm(false);resetSaleForm()}}>Cancelar edição</button>
            <button className="primary" disabled={savingSale}>{savingSale?'Salvando...':editingSale?'Salvar e reemitir fatura':'Salvar venda e emitir fatura'}</button>
          </div>
        </form>}

        <article className="panel tablePanel">
          <div className="panelHead"><div><h3>Vendas e faturas</h3><p>{vendas.length} registros</p></div></div>
          <div className="tableWrap"><table>
            <thead><tr><th>Fatura</th><th>Data</th><th>Cliente</th><th>Status</th><th>Pagamento</th><th>Total</th><th>Gerenciar</th></tr></thead>
            <tbody>{vendas.map(v=>{
              const cliente=clientes.find(c=>c.id===v.cliente_id)
              const opened=salePanel===v.id
              return <Fragment key={v.id}>
                <tr>
                  <td><strong>#{invoiceNo(v.fatura_numero)}</strong></td>
                  <td>{new Date(v.created_at).toLocaleString('pt-BR')}</td>
                  <td>{cliente?.nome||'Consumidor'}</td>
                  <td><span className={`statusBadge status-${v.status}`}>{v.status}</span></td>
                  <td>{paymentLabel(v.forma_pagamento)} {Number(v.parcelas)>1?`• ${v.parcelas}x`:''}</td>
                  <td><strong>{money(Number(v.total))}</strong></td>
                  <td><button className="ghost" onClick={()=>setSalePanel(opened?null:v.id)}><SlidersHorizontal size={15}/>Painel {opened?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button></td>
                </tr>
                {opened&&<tr className="manageRow"><td colSpan={7}>
                  <div className="actionPanel">
                    <div className="actionMeta">
                      <strong>Fatura #{invoiceNo(v.fatura_numero)}</strong>
                      <span>{paymentLabel(v.forma_pagamento)} • {v.parcelas}x • 1º vencimento {dateBr(v.primeiro_vencimento)}</span>
                    </div>
                    <div className="rowActions">
                      <button className="ghost" onClick={()=>void downloadSalePdf(v)}><FileDown size={15}/>PDF</button>
                      <button className="ghost" disabled={v.status==='cancelado'} onClick={()=>void startEditSale(v)}><Pencil size={15}/>Editar</button>
                      <button className="warningBtn" disabled={v.status==='cancelado'} onClick={()=>void cancelSale(v)}><Ban size={15}/>Cancelar venda</button>
                      {isAdmin&&<button className="dangerAction" onClick={()=>void deleteSale(v)}><Trash2 size={15}/>Excluir</button>}
                    </div>
                  </div>
                </td></tr>}
              </Fragment>
            })}</tbody>
          </table></div>
        </article>
      </section>}

      {!['dashboard','clientes','produtos','estoque','vendas'].includes(active)&&<section className="modulePlaceholder"><h2>{title}</h2><p>Módulo preparado para a próxima etapa.</p></section>}
    </main>
  </div>
}

function paymentLabel(method:PaymentMethod|string){
  if(method==='pix')return 'PIX'
  if(method==='cartao')return 'Cartão'
  if(method==='boleto')return 'Boleto'
  return method||'—'
}

function ProductTable({
  produtos,openId,onToggle,onEdit,onAdjust,onDelete,canDelete
}:{
  produtos:Produto[]
  openId:string|null
  onToggle:(id:string)=>void
  onEdit:(p:Produto)=>void
  onAdjust:(p:Produto)=>void
  onDelete:(p:Produto)=>void
  canDelete:boolean
}){
  return <article className="panel tablePanel">
    <div className="panelHead"><div><h3>Produtos / Estoque</h3><p>{produtos.length} produtos cadastrados</p></div></div>
    <div className="tableWrap"><table>
      <thead><tr><th>Código</th><th>Produto</th><th>Status</th><th>Un.</th><th>Estoque</th><th>Mínimo</th><th>Custo</th><th>Venda</th><th>Gerenciar</th></tr></thead>
      <tbody>{produtos.map(p=>{
        const opened=openId===p.id
        const low=Number(p.estoque_atual)<=Number(p.estoque_minimo)
        return <Fragment key={p.id}>
          <tr>
            <td>{p.codigo}</td>
            <td>{p.descricao}</td>
            <td><span className={p.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{p.ativo?'ativo':'inativo'}</span></td>
            <td>{p.unidade}</td>
            <td><strong className={low?'stockLow':''}>{Number(p.estoque_atual).toLocaleString('pt-BR')}</strong></td>
            <td>{Number(p.estoque_minimo).toLocaleString('pt-BR')}</td>
            <td>{money(Number(p.custo))}</td>
            <td>{money(Number(p.preco_venda))}</td>
            <td><button className="ghost" onClick={()=>onToggle(p.id)}><SlidersHorizontal size={15}/>Painel {opened?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button></td>
          </tr>
          {opened&&<tr className="manageRow"><td colSpan={9}>
            <div className="actionPanel">
              <div className="actionMeta"><strong>{p.codigo} - {p.descricao}</strong><span>Estoque atual: {Number(p.estoque_atual).toLocaleString('pt-BR')} {p.unidade}</span></div>
              <div className="rowActions">
                <button className="ghost" onClick={()=>onEdit(p)}><Pencil size={15}/>Editar</button>
                <button className="ghost" onClick={()=>onAdjust(p)}><Boxes size={15}/>Ajustar estoque</button>
                {canDelete&&<button className="dangerAction" onClick={()=>void onDelete(p)}><Trash2 size={15}/>Excluir</button>}
              </div>
            </div>
          </td></tr>}
        </Fragment>
      })}</tbody>
    </table></div>
  </article>
}

export default App
