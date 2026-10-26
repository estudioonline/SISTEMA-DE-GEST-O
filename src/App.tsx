import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, ReceiptText, WalletCards,
  BarChart3, Settings, Moon, Sun, Plus, Building2, LogOut, Trash2, FileDown,
  Pencil, Ban, SlidersHorizontal, ChevronDown, ChevronUp, RefreshCw, CheckCircle2,
  Upload, Download, FileSpreadsheet
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { generateInvoicePdf } from './lib/invoicePdf'
import { downloadProductsTemplate, exportProductsExcel, parseProductsExcel } from './lib/productsExcel'

type ModuleKey='dashboard'|'clientes'|'fornecedores'|'produtos'|'compras'|'vendas'|'financeiro'|'relatorios'|'config'
type PerfilRole='administrador'|'financeiro'|'vendas'|'estoque'|'visualizador'
type PaymentMethod='pix'|'cartao'|'boleto'

type Cliente={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;limite_credito:number;ativo:boolean}
type Fornecedor={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;ativo:boolean}
type Produto={id:string;codigo:string;descricao:string;unidade:string;custo:number;preco_venda:number;estoque_atual:number;estoque_minimo:number;ativo:boolean}
type Venda={id:string;cliente_id:string|null;vendedor_id:string|null;status:string;subtotal:number;desconto:number;total:number;observacoes:string|null;created_at:string;forma_pagamento:PaymentMethod;parcelas:number;primeiro_vencimento:string;fatura_numero:number|null;fatura_gerada_em:string|null}
type VendaItem={produto_id:string;quantidade:number;valor_unitario:number;desconto:number;total:number}
type SaleItemDraft={key:string;produto_id:string;quantidade:number;valor_unitario:number;desconto:number}
type Compra={id:string;fornecedor_id:string|null;status:string;total:number;observacoes:string|null;created_at:string}
type CompraItem={produto_id:string;quantidade:number;custo_unitario:number;total:number}
type PurchaseItemDraft={key:string;produto_id:string;quantidade:number;custo_unitario:number}
type Titulo={id:string;tipo:'pagar'|'receber';descricao:string;entidade_nome:string|null;vencimento:string;valor:number;valor_pago:number;status:'aberto'|'parcial'|'pago'|'cancelado';categoria:string|null;centro_custo:string|null;venda_id:string|null;parcela_numero:number|null;forma_pagamento:string|null;created_at:string}
type EmpresaConfig={id:number;razao_social:string;nome_fantasia:string;cnpj:string|null;email:string|null;telefone:string|null;endereco:string|null;cidade:string|null;uf:string|null;cep:string|null;pix_chave:string|null;banco:string|null;agencia:string|null;conta:string|null;condicoes_gerais:string|null}

const menu=[
  ['dashboard','Dashboard',LayoutDashboard],['clientes','Clientes',Users],['fornecedores','Fornecedores',Building2],
  ['produtos','Produtos / Estoque',Package],['compras','Compras',ShoppingCart],
  ['vendas','Vendas',ReceiptText],['financeiro','Financeiro',WalletCards],['relatorios','Relatórios',BarChart3],['config','Configurações',Settings]
] as const

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const today=()=>new Date().toISOString().slice(0,10)
const dateBr=(v:string)=>v?new Intl.DateTimeFormat('pt-BR').format(new Date(v.length===10?v+'T12:00:00':v)):'—'
const invoiceNo=(n:number|null|undefined)=>String(n||0).padStart(7,'0')
const newSaleItem=():SaleItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,valor_unitario:0,desconto:0})
const newPurchaseItem=():PurchaseItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,custo_unitario:0})

function App(){
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(true)
  const [active,setActive]=useState<ModuleKey>('dashboard')
  const [dark,setDark]=useState(false)
  const [profileRole,setProfileRole]=useState<PerfilRole>('vendas')
  const [msg,setMsg]=useState('')

  const [clientes,setClientes]=useState<Cliente[]>([])
  const [fornecedores,setFornecedores]=useState<Fornecedor[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [vendas,setVendas]=useState<Venda[]>([])
  const [compras,setCompras]=useState<Compra[]>([])
  const [titulos,setTitulos]=useState<Titulo[]>([])
  const [empresa,setEmpresa]=useState<EmpresaConfig|null>(null)

  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')

  const [showForm,setShowForm]=useState(false)
  const [editingClient,setEditingClient]=useState<Cliente|null>(null)
  const [clientPanel,setClientPanel]=useState<string|null>(null)
  const [editingSupplier,setEditingSupplier]=useState<Fornecedor|null>(null)
  const [supplierPanel,setSupplierPanel]=useState<string|null>(null)

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

  const [editingPurchase,setEditingPurchase]=useState<Compra|null>(null)
  const [purchasePanel,setPurchasePanel]=useState<string|null>(null)
  const [purchaseSupplier,setPurchaseSupplier]=useState('')
  const [purchaseStatus,setPurchaseStatus]=useState('aberta')
  const [purchaseNotes,setPurchaseNotes]=useState('')
  const [purchaseItems,setPurchaseItems]=useState<PurchaseItemDraft[]>([newPurchaseItem()])
  const [savingPurchase,setSavingPurchase]=useState(false)

  const [editingTitle,setEditingTitle]=useState<Titulo|null>(null)
  const [financePanel,setFinancePanel]=useState<string|null>(null)

  const [reportStart,setReportStart]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10))
  const [reportEnd,setReportEnd]=useState(today())
  const [reportStatus,setReportStatus]=useState('todos')

  const title=useMemo(()=>menu.find(m=>m[0]===active)?.[1]||'Dashboard',[active])
  const isAdmin=profileRole==='administrador'
  const isViewer=profileRole==='visualizador'
  const canManageStock=isAdmin||profileRole==='estoque'

  useEffect(()=>{
    if(!supabaseConfigured){setLoading(false);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{if(session)void loadData()},[session])

  async function loadData(){
    if(!session)return
    const [c,f,p,v,cp,t,ec,pr]=await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('fornecedores').select('*').order('nome'),
      supabase.from('produtos').select('*').order('descricao'),
      supabase.from('vendas').select('*').order('created_at',{ascending:false}).limit(300),
      supabase.from('compras').select('*').order('created_at',{ascending:false}).limit(300),
      supabase.from('titulos_financeiros').select('*').order('vencimento',{ascending:true}).limit(500),
      supabase.from('empresa_config').select('*').eq('id',1).maybeSingle(),
      supabase.from('profiles').select('perfil').eq('id',session.user.id).maybeSingle()
    ])
    if(!c.error)setClientes((c.data||[]) as Cliente[])
    if(!f.error)setFornecedores((f.data||[]) as Fornecedor[])
    if(!p.error)setProdutos((p.data||[]) as Produto[])
    if(!v.error)setVendas((v.data||[]) as Venda[])
    if(!cp.error)setCompras((cp.data||[]) as Compra[])
    if(!t.error)setTitulos((t.data||[]) as Titulo[])
    if(!ec.error&&ec.data)setEmpresa(ec.data as EmpresaConfig)
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

  function closeForms(){
    setShowForm(false)
    setEditingClient(null)
    setEditingSupplier(null)
    setEditingProduct(null)
    setAdjustingProduct(null)
    setEditingTitle(null)
    resetSaleForm()
    resetPurchaseForm()
  }

  // CLIENTES
  function startNewClient(){setEditingClient(null);setShowForm(true);setMsg('')}
  function startEditClient(c:Cliente){setEditingClient(c);setShowForm(true);setMsg('')}
  async function saveClient(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const f=new FormData(e.currentTarget)
    const payload={
      nome:String(f.get('nome')||''),documento:String(f.get('documento')||'')||null,
      email:String(f.get('email')||'')||null,telefone:String(f.get('telefone')||'')||null,
      limite_credito:Number(f.get('limite_credito')||0),ativo:String(f.get('ativo')||'true')==='true'
    }
    const r=editingClient?await supabase.from('clientes').update(payload).eq('id',editingClient.id):await supabase.from('clientes').insert(payload)
    setMsg(r.error?r.error.message:editingClient?'Cliente atualizado.':'Cliente cadastrado.')
    if(!r.error){setShowForm(false);setEditingClient(null);await loadData()}
  }
  async function deleteClient(c:Cliente){
    if(!isAdmin){setMsg('Somente administrador pode excluir clientes.');return}
    if(!window.confirm(`Excluir o cliente "${c.nome}"?`))return
    const r=await supabase.from('clientes').delete().eq('id',c.id)
    if(r.error?.code==='23503'){
      const d=await supabase.from('clientes').update({ativo:false}).eq('id',c.id)
      setMsg(d.error?d.error.message:'Cliente com histórico foi desativado.')
    }else setMsg(r.error?r.error.message:'Cliente excluído.')
    await loadData()
  }

  // FORNECEDORES
  function startNewSupplier(){setEditingSupplier(null);setShowForm(true);setMsg('')}
  function startEditSupplier(f:Fornecedor){setEditingSupplier(f);setShowForm(true);setMsg('')}
  async function saveSupplier(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const f=new FormData(e.currentTarget)
    const payload={
      nome:String(f.get('nome')||''),documento:String(f.get('documento')||'')||null,
      email:String(f.get('email')||'')||null,telefone:String(f.get('telefone')||'')||null,
      ativo:String(f.get('ativo')||'true')==='true'
    }
    const r=editingSupplier?await supabase.from('fornecedores').update(payload).eq('id',editingSupplier.id):await supabase.from('fornecedores').insert(payload)
    setMsg(r.error?r.error.message:editingSupplier?'Fornecedor atualizado.':'Fornecedor cadastrado.')
    if(!r.error){setShowForm(false);setEditingSupplier(null);await loadData()}
  }
  async function deleteSupplier(f:Fornecedor){
    if(!isAdmin){setMsg('Somente administrador pode excluir fornecedores.');return}
    if(!window.confirm(`Excluir o fornecedor "${f.nome}"?`))return
    const r=await supabase.from('fornecedores').delete().eq('id',f.id)
    if(r.error?.code==='23503'){
      const d=await supabase.from('fornecedores').update({ativo:false}).eq('id',f.id)
      setMsg(d.error?d.error.message:'Fornecedor com histórico foi desativado.')
    }else setMsg(r.error?r.error.message:'Fornecedor excluído.')
    await loadData()
  }

  // PRODUTOS / ESTOQUE
  function startNewProduct(){setEditingProduct(null);setAdjustingProduct(null);setShowForm(true);setMsg('')}
  function startEditProduct(p:Produto){setEditingProduct(p);setAdjustingProduct(null);setShowForm(true);setMsg('')}
  async function saveProduct(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const f=new FormData(e.currentTarget)
    const base={codigo:String(f.get('codigo')||''),descricao:String(f.get('descricao')||''),unidade:String(f.get('unidade')||'UN'),custo:Number(f.get('custo')||0),preco_venda:Number(f.get('preco_venda')||0),estoque_minimo:Number(f.get('estoque_minimo')||0),ativo:String(f.get('ativo')||'true')==='true'}
    const r=editingProduct?await supabase.from('produtos').update(base).eq('id',editingProduct.id):await supabase.from('produtos').insert({...base,estoque_atual:Number(f.get('estoque_atual')||0)})
    setMsg(r.error?r.error.message:editingProduct?'Produto atualizado.':'Produto cadastrado.')
    if(!r.error){setEditingProduct(null);setShowForm(false);await loadData()}
  }
  function startAdjustStock(p:Produto){setAdjustingProduct(p);setStockNew(String(p.estoque_atual));setStockReason('Ajuste manual');setShowForm(false);setMsg('')}
  async function adjustStock(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!adjustingProduct)return
    const {error}=await supabase.rpc('ajustar_estoque_produto',{p_produto_id:adjustingProduct.id,p_novo_estoque:Number(stockNew),p_motivo:stockReason})
    setMsg(error?error.message:'Estoque ajustado e movimento registrado.')
    if(!error){setAdjustingProduct(null);await loadData()}
  }
  async function deleteProduct(p:Produto){
    if(!isAdmin){setMsg('Somente administrador pode excluir produtos.');return}
    if(!window.confirm(`Excluir o produto "${p.descricao}"?`))return
    const r=await supabase.from('produtos').delete().eq('id',p.id)
    if(r.error?.code==='23503'){
      const d=await supabase.from('produtos').update({ativo:false}).eq('id',p.id)
      setMsg(d.error?d.error.message:'Produto com histórico foi desativado.')
    }else setMsg(r.error?r.error.message:'Produto excluído.')
    await loadData()
  }

  function exportProducts(){
    try{
      exportProductsExcel(produtos)
      setMsg(`Relatório Excel exportado com ${produtos.length} produto(s).`)
    }catch{
      setMsg('Não foi possível exportar o relatório Excel.')
    }
  }

  function downloadProductModel(){
    try{
      downloadProductsTemplate()
      setMsg('Modelo Excel de importação gerado.')
    }catch{
      setMsg('Não foi possível gerar o modelo Excel.')
    }
  }

  async function importProducts(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]
    e.target.value=''
    if(!file)return

    if(!canManageStock){
      setMsg('Somente administrador ou perfil de estoque pode importar produtos e ajustar estoque.')
      return
    }

    try{
      setMsg('Validando planilha...')
      const rows=await parseProductsExcel(file)

      const confirmed=window.confirm(
        `Importar ${rows.length} linha(s)?\n\nProdutos com o mesmo código serão atualizados. O valor da coluna "Estoque Atual" substituirá o saldo atual e a diferença ficará registrada no histórico.`
      )
      if(!confirmed){
        setMsg('Importação cancelada.')
        return
      }

      const {data,error}=await supabase.rpc('importar_produtos_estoque',{p_linhas:rows})
      if(error){
        setMsg('Falha na importação: '+error.message)
        return
      }

      const result=(data||{}) as {inseridos?:number;atualizados?:number;ajustes_estoque?:number;total_linhas?:number}
      setMsg(
        `Importação concluída: ${result.inseridos||0} novo(s), ${result.atualizados||0} atualizado(s) e ${result.ajustes_estoque||0} ajuste(s) de estoque.`
      )
      await loadData()
    }catch(error){
      setMsg(error instanceof Error?error.message:'Não foi possível ler a planilha Excel.')
    }
  }

  // VENDAS
  function resetSaleForm(){setEditingSale(null);setSaleClient('');setSaleStatus('pedido');setSaleNotes('');setSalePayment('pix');setSaleInstallments(1);setSaleDueDate(today());setSaleItems([newSaleItem()])}
  function startNewSale(){resetSaleForm();setShowForm(true);setMsg('')}
  async function startEditSale(v:Venda){
    if(v.status==='cancelado'){setMsg('Venda cancelada não pode ser editada.');return}
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total').eq('venda_id',v.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as VendaItem[]
    setEditingSale(v);setSaleClient(v.cliente_id||'');setSaleStatus(v.status);setSaleNotes(v.observacoes||'');setSalePayment(v.forma_pagamento||'pix');setSaleInstallments(Number(v.parcelas)||1);setSaleDueDate(v.primeiro_vencimento||today())
    setSaleItems(items.map(i=>({key:`${Date.now()}-${Math.random()}`,produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto)})))
    setShowForm(true);setMsg('')
  }
  function chooseProduct(key:string,id:string){const p=produtos.find(x=>x.id===id);setSaleItems(items=>items.map(i=>i.key===key?{...i,produto_id:id,valor_unitario:p?Number(p.preco_venda):0}:i))}
  function updateSaleItem(key:string,field:'quantidade'|'valor_unitario'|'desconto',value:number){setSaleItems(items=>items.map(i=>i.key===key?{...i,[field]:Math.max(0,value||0)}:i))}
  function removeSaleItem(key:string){setSaleItems(items=>items.length===1?items:items.filter(i=>i.key!==key))}
  function changePayment(v:PaymentMethod){setSalePayment(v);if(v==='pix')setSaleInstallments(1);if(v==='cartao')setSaleInstallments(x=>Math.min(Math.max(x,1),12));if(v==='boleto')setSaleInstallments(x=>Math.min(Math.max(x,1),24))}
  function invoiceItems(items:SaleItemDraft[]){return items.map(i=>{const p=produtos.find(x=>x.id===i.produto_id);const d=Math.min(i.desconto,i.quantidade*i.valor_unitario);return{codigo:p?.codigo,descricao:p?.descricao||'Produto',unidade:p?.unidade||'UN',quantidade:i.quantidade,valor_unitario:i.valor_unitario,desconto:d,total:Math.max(0,i.quantidade*i.valor_unitario-d)}})}
  async function saveSale(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!session)return
    const items=saleItems.filter(i=>i.produto_id&&i.quantidade>0)
    if(!items.length){setMsg('Adicione pelo menos um produto.');return}
    setSavingSale(true);setMsg('')
    const args={p_cliente_id:saleClient||null,p_status:saleStatus,p_forma_pagamento:salePayment,p_parcelas:saleInstallments,p_primeiro_vencimento:saleDueDate,p_observacoes:saleNotes,p_itens:items.map(i=>({produto_id:i.produto_id,quantidade:i.quantidade,valor_unitario:i.valor_unitario,desconto:i.desconto}))}
    const r=editingSale?await supabase.rpc('atualizar_venda_completa',{p_venda_id:editingSale.id,...args}):await supabase.rpc('criar_venda_completa',args)
    if(r.error||!r.data){setSavingSale(false);setMsg('Não foi possível salvar a venda: '+(r.error?.message||'erro desconhecido'));return}
    const saved=(Array.isArray(r.data)?r.data[0]:r.data) as Venda
    const subtotal=items.reduce((s,i)=>s+i.quantidade*i.valor_unitario,0)
    const desconto=items.reduce((s,i)=>s+Math.min(i.desconto,i.quantidade*i.valor_unitario),0)
    const total=Math.max(0,subtotal-desconto)
    try{
      generateInvoicePdf({id:saved.id,fatura_numero:saved.fatura_numero,created_at:saved.created_at||new Date().toISOString(),status:saved.status,subtotal,desconto,total,observacoes:saleNotes||null,forma_pagamento:salePayment,parcelas:saleInstallments,primeiro_vencimento:saleDueDate,cliente:clientes.find(c=>c.id===saleClient)||null,company:empresa||undefined,items:invoiceItems(items)})
      await supabase.from('vendas').update({fatura_gerada_em:new Date().toISOString()}).eq('id',saved.id)
      setMsg(editingSale?'Venda atualizada e fatura reemitida.':'Venda criada e fatura emitida.')
    }catch{setMsg('Venda salva. A fatura pode ser reemitida pelo painel.')}
    setSavingSale(false);setShowForm(false);resetSaleForm();await loadData()
  }
  async function downloadSalePdf(v:Venda){
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total').eq('venda_id',v.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as VendaItem[]
    const drafts=items.map(i=>({key:'pdf',produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto)}))
    try{generateInvoicePdf({id:v.id,fatura_numero:v.fatura_numero,created_at:v.created_at,status:v.status,subtotal:Number(v.subtotal),desconto:Number(v.desconto),total:Number(v.total),observacoes:v.observacoes,forma_pagamento:v.forma_pagamento,parcelas:Number(v.parcelas),primeiro_vencimento:v.primeiro_vencimento,cliente:clientes.find(c=>c.id===v.cliente_id)||null,company:empresa||undefined,items:invoiceItems(drafts)});await supabase.from('vendas').update({fatura_gerada_em:new Date().toISOString()}).eq('id',v.id)}catch{setMsg('Não foi possível gerar o PDF.')}
  }
  async function cancelSale(v:Venda){if(v.status==='cancelado'||!window.confirm(`Cancelar fatura ${invoiceNo(v.fatura_numero)}?`))return;const r=await supabase.from('vendas').update({status:'cancelado'}).eq('id',v.id);setMsg(r.error?r.error.message:'Venda cancelada e estoque/financeiro estornados.');if(!r.error){setSalePanel(null);await loadData()}}
  async function deleteSale(v:Venda){if(!isAdmin){setMsg('Somente administrador pode excluir venda.');return}if(!window.confirm(`Excluir fatura ${invoiceNo(v.fatura_numero)} definitivamente?`))return;const r=await supabase.from('vendas').delete().eq('id',v.id);setMsg(r.error?r.error.message:'Venda excluída.');if(!r.error){setSalePanel(null);await loadData()}}

  // COMPRAS
  function resetPurchaseForm(){setEditingPurchase(null);setPurchaseSupplier('');setPurchaseStatus('aberta');setPurchaseNotes('');setPurchaseItems([newPurchaseItem()])}
  function startNewPurchase(){resetPurchaseForm();setShowForm(true);setMsg('')}
  async function startEditPurchase(c:Compra){
    if(c.status==='cancelada'){setMsg('Compra cancelada não pode ser editada.');return}
    const {data,error}=await supabase.from('compra_itens').select('produto_id,quantidade,custo_unitario,total').eq('compra_id',c.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as CompraItem[]
    setEditingPurchase(c);setPurchaseSupplier(c.fornecedor_id||'');setPurchaseStatus(c.status);setPurchaseNotes(c.observacoes||'')
    setPurchaseItems(items.map(i=>({key:`${Date.now()}-${Math.random()}`,produto_id:i.produto_id,quantidade:Number(i.quantidade),custo_unitario:Number(i.custo_unitario)})))
    setShowForm(true);setMsg('')
  }
  function choosePurchaseProduct(key:string,id:string){const p=produtos.find(x=>x.id===id);setPurchaseItems(items=>items.map(i=>i.key===key?{...i,produto_id:id,custo_unitario:p?Number(p.custo):0}:i))}
  function updatePurchaseItem(key:string,field:'quantidade'|'custo_unitario',value:number){setPurchaseItems(items=>items.map(i=>i.key===key?{...i,[field]:Math.max(0,value||0)}:i))}
  function removePurchaseItem(key:string){setPurchaseItems(items=>items.length===1?items:items.filter(i=>i.key!==key))}
  async function savePurchase(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const items=purchaseItems.filter(i=>i.produto_id&&i.quantidade>0)
    if(!items.length){setMsg('Adicione pelo menos um produto.');return}
    setSavingPurchase(true)
    const args={p_fornecedor_id:purchaseSupplier||null,p_status:purchaseStatus,p_observacoes:purchaseNotes,p_itens:items.map(i=>({produto_id:i.produto_id,quantidade:i.quantidade,custo_unitario:i.custo_unitario}))}
    const r=editingPurchase?await supabase.rpc('atualizar_compra_completa',{p_compra_id:editingPurchase.id,...args}):await supabase.rpc('criar_compra_completa',args)
    setSavingPurchase(false)
    setMsg(r.error?r.error.message:editingPurchase?'Compra atualizada.':'Compra criada.')
    if(!r.error){setShowForm(false);resetPurchaseForm();await loadData()}
  }
  async function cancelPurchase(c:Compra){if(c.status==='cancelada'||!window.confirm('Cancelar esta compra?'))return;const r=await supabase.from('compras').update({status:'cancelada'}).eq('id',c.id);setMsg(r.error?r.error.message:'Compra cancelada e estoque estornado.');if(!r.error){setPurchasePanel(null);await loadData()}}
  async function deletePurchase(c:Compra){if(!isAdmin){setMsg('Somente administrador pode excluir compra.');return}if(!window.confirm('Excluir esta compra definitivamente?'))return;const r=await supabase.from('compras').delete().eq('id',c.id);setMsg(r.error?r.error.message:'Compra excluída.');if(!r.error){setPurchasePanel(null);await loadData()}}

  // FINANCEIRO
  function startNewTitle(){setEditingTitle(null);setShowForm(true);setMsg('')}
  function startEditTitle(t:Titulo){setEditingTitle(t);setShowForm(true);setMsg('')}
  async function saveTitle(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const f=new FormData(e.currentTarget)
    const payload={tipo:String(f.get('tipo')) as 'pagar'|'receber',descricao:String(f.get('descricao')||''),entidade_nome:String(f.get('entidade_nome')||'')||null,vencimento:String(f.get('vencimento')||today()),valor:Number(f.get('valor')||0),valor_pago:Number(f.get('valor_pago')||0),status:String(f.get('status')||'aberto'),categoria:String(f.get('categoria')||'')||null,centro_custo:String(f.get('centro_custo')||'')||null}
    const r=editingTitle?await supabase.from('titulos_financeiros').update(payload).eq('id',editingTitle.id):await supabase.from('titulos_financeiros').insert(payload)
    setMsg(r.error?r.error.message:editingTitle?'Lançamento atualizado.':'Lançamento criado.')
    if(!r.error){setShowForm(false);setEditingTitle(null);await loadData()}
  }
  async function markPaid(t:Titulo){const r=await supabase.from('titulos_financeiros').update({valor_pago:Number(t.valor),status:'pago'}).eq('id',t.id);setMsg(r.error?r.error.message:'Lançamento marcado como pago.');if(!r.error)await loadData()}
  async function cancelTitle(t:Titulo){const r=await supabase.from('titulos_financeiros').update({status:'cancelado'}).eq('id',t.id);setMsg(r.error?r.error.message:'Lançamento cancelado.');if(!r.error)await loadData()}
  async function deleteTitle(t:Titulo){if(!isAdmin){setMsg('Somente administrador pode excluir lançamento.');return}if(!window.confirm('Excluir este lançamento?'))return;const r=await supabase.from('titulos_financeiros').delete().eq('id',t.id);setMsg(r.error?r.error.message:'Lançamento excluído.');if(!r.error)await loadData()}

  // CONFIG
  async function saveCompany(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!isAdmin){setMsg('Somente administrador pode alterar configurações.');return}
    const f=new FormData(e.currentTarget)
    const payload={id:1,razao_social:String(f.get('razao_social')||'SUA EMPRESA'),nome_fantasia:String(f.get('nome_fantasia')||'SUA EMPRESA'),cnpj:String(f.get('cnpj')||'')||null,email:String(f.get('email')||'')||null,telefone:String(f.get('telefone')||'')||null,endereco:String(f.get('endereco')||'')||null,cidade:String(f.get('cidade')||'')||null,uf:String(f.get('uf')||'')||null,cep:String(f.get('cep')||'')||null,pix_chave:String(f.get('pix_chave')||'')||null,banco:String(f.get('banco')||'')||null,agencia:String(f.get('agencia')||'')||null,conta:String(f.get('conta')||'')||null,condicoes_gerais:String(f.get('condicoes_gerais')||'')||null,updated_at:new Date().toISOString()}
    const r=await supabase.from('empresa_config').upsert(payload,{onConflict:'id'})
    setMsg(r.error?r.error.message:'Configurações da empresa salvas.')
    if(!r.error)await loadData()
  }

  if(loading)return <div className="modulePlaceholder">Carregando...</div>
  if(!supabaseConfigured)return <div className="modulePlaceholder"><div className="panel" style={{maxWidth:620}}><h2>Sistema de Gestão publicado</h2><p>Configuração do Supabase ausente.</p></div></div>
  if(!session)return <div className="modulePlaceholder"><form onSubmit={login} className="panel dataForm" style={{maxWidth:420,width:'100%'}}><h2>Sistema de Gestão</h2><p>Acesse o ERP</p><input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/><button className="primary">Entrar</button><button type="button" className="ghost" onClick={signup}>Criar conta</button>{msg&&<p>{msg}</p>}</form></div>

  const low=produtos.filter(p=>p.ativo&&Number(p.estoque_atual)<=Number(p.estoque_minimo)).length
  const stockValue=produtos.reduce((s,p)=>s+Number(p.estoque_atual)*Number(p.custo),0)
  const monthSales=vendas.filter(v=>{const d=new Date(v.created_at),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&v.status!=='cancelado'}).reduce((s,v)=>s+Number(v.total),0)
  const openReceivables=titulos.filter(t=>t.tipo==='receber'&&t.status!=='pago'&&t.status!=='cancelado').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const openPayables=titulos.filter(t=>t.tipo==='pagar'&&t.status!=='pago'&&t.status!=='cancelado').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const saleSubtotal=saleItems.reduce((s,i)=>s+i.quantidade*i.valor_unitario,0)
  const saleDiscount=saleItems.reduce((s,i)=>s+Math.min(i.desconto,i.quantidade*i.valor_unitario),0)
  const saleTotal=Math.max(0,saleSubtotal-saleDiscount)
  const purchaseTotal=purchaseItems.reduce((s,i)=>s+i.quantidade*i.custo_unitario,0)

  const filteredSales=vendas.filter(v=>{const d=v.created_at.slice(0,10);return d>=reportStart&&d<=reportEnd&&(reportStatus==='todos'||v.status===reportStatus)})
  const filteredPurchases=compras.filter(c=>{const d=c.created_at.slice(0,10);return d>=reportStart&&d<=reportEnd})
  const reportSalesTotal=filteredSales.filter(v=>v.status!=='cancelado').reduce((s,v)=>s+Number(v.total),0)
  const reportPurchaseTotal=filteredPurchases.filter(c=>c.status!=='cancelada').reduce((s,c)=>s+Number(c.total),0)

  function headerAction(){
    if(active==='clientes')startNewClient()
    else if(active==='fornecedores')startNewSupplier()
    else if(active==='produtos')startNewProduct()
    else if(active==='compras')startNewPurchase()
    else if(active==='vendas')startNewSale()
    else if(active==='financeiro')startNewTitle()
  }

  return <div className={dark?'app dark':'app'}>
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">SG</div><div><strong>Sistema de Gestão</strong><span>ERP Empresarial</span></div></div>
      <nav>{menu.map(([k,l,I])=><button key={k} className={active===k?'navItem active':'navItem'} onClick={()=>{setActive(k as ModuleKey);closeForms();setMsg('')}}><I size={18}/><span>{l}</span></button>)}</nav>
      <div className="sidebarFooter"><span>{session.user.email}</span><small>{profileRole}</small><button className="navItem" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/><span>Sair</span></button></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><h1>{title}</h1><p>{empresa?.nome_fantasia||'Sistema de Gestão'} • ORGJSS1</p></div>
        <div className="topActions">
          <button className="iconBtn" onClick={()=>void loadData()} title="Atualizar"><RefreshCw size={18}/></button>
          <button className="iconBtn" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
          {!isViewer&&['clientes','fornecedores','produtos','compras','vendas','financeiro'].includes(active)&&<button className="primary" onClick={headerAction}><Plus size={17}/>Novo</button>}
        </div>
      </header>

      {msg&&<div className="panel noticePanel">{msg}</div>}

      {active==='dashboard'&&<section>
        <div className="cards">
          <article className="card"><span>Vendas no mês</span><strong>{money(monthSales)}</strong><small>{vendas.filter(v=>v.status!=='cancelado').length} registros</small></article>
          <article className="card"><span>A receber</span><strong>{money(openReceivables)}</strong><small>em aberto</small></article>
          <article className="card"><span>A pagar</span><strong>{money(openPayables)}</strong><small>em aberto</small></article>
          <article className="card"><span>Estoque baixo</span><strong>{low}</strong><small>de {produtos.filter(p=>p.ativo).length} produtos ativos</small></article>
        </div>
        <div className="cards compactCards">
          <article className="card"><span>Clientes</span><strong>{clientes.filter(c=>c.ativo).length}</strong><button className="ghost" onClick={()=>setActive('clientes')}>Gerenciar</button></article>
          <article className="card"><span>Fornecedores</span><strong>{fornecedores.filter(f=>f.ativo).length}</strong><button className="ghost" onClick={()=>setActive('fornecedores')}>Gerenciar</button></article>
          <article className="card"><span>Valor em estoque</span><strong>{money(stockValue)}</strong><button className="ghost" onClick={()=>setActive('produtos')}>Gerenciar</button></article>
        </div>
      </section>}

      {active==='clientes'&&<section>
        {showForm&&<form className="panel dataForm" onSubmit={saveClient}><input name="nome" placeholder="Nome / Razão social" required defaultValue={editingClient?.nome||''}/><input name="documento" placeholder="CPF / CNPJ" defaultValue={editingClient?.documento||''}/><input name="email" type="email" placeholder="E-mail" defaultValue={editingClient?.email||''}/><input name="telefone" placeholder="Telefone" defaultValue={editingClient?.telefone||''}/><input name="limite_credito" type="number" step="0.01" placeholder="Limite de crédito" defaultValue={editingClient?.limite_credito||0}/><select name="ativo" defaultValue={editingClient?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select><div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingClient(null)}}>Cancelar</button><button className="primary">Salvar</button></div></form>}
        <EditableEntityTable readOnly={isViewer} title="Clientes" headers={['Nome','Documento','E-mail','Telefone','Limite','Status','Gerenciar']} rows={clientes.map(c=>({id:c.id,cells:[c.nome,c.documento||'—',c.email||'—',c.telefone||'—',money(Number(c.limite_credito)),c.ativo?'Ativo':'Inativo'],opened:clientPanel===c.id,onToggle:()=>setClientPanel(clientPanel===c.id?null:c.id),panel:<div className="rowActions"><button className="ghost" onClick={()=>startEditClient(c)}><Pencil size={15}/>Editar</button>{isAdmin&&<button className="dangerAction" onClick={()=>void deleteClient(c)}><Trash2 size={15}/>Excluir</button>}</div>}))}/>
      </section>}

      {active==='fornecedores'&&<section>
        {showForm&&<form className="panel dataForm" onSubmit={saveSupplier}><input name="nome" placeholder="Nome / Razão social" required defaultValue={editingSupplier?.nome||''}/><input name="documento" placeholder="CNPJ / CPF" defaultValue={editingSupplier?.documento||''}/><input name="email" type="email" placeholder="E-mail" defaultValue={editingSupplier?.email||''}/><input name="telefone" placeholder="Telefone" defaultValue={editingSupplier?.telefone||''}/><select name="ativo" defaultValue={editingSupplier?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select><div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingSupplier(null)}}>Cancelar</button><button className="primary">Salvar</button></div></form>}
        <EditableEntityTable readOnly={isViewer} title="Fornecedores" headers={['Nome','Documento','E-mail','Telefone','Status','Gerenciar']} rows={fornecedores.map(f=>({id:f.id,cells:[f.nome,f.documento||'—',f.email||'—',f.telefone||'—',f.ativo?'Ativo':'Inativo'],opened:supplierPanel===f.id,onToggle:()=>setSupplierPanel(supplierPanel===f.id?null:f.id),panel:<div className="rowActions"><button className="ghost" onClick={()=>startEditSupplier(f)}><Pencil size={15}/>Editar</button>{isAdmin&&<button className="dangerAction" onClick={()=>void deleteSupplier(f)}><Trash2 size={15}/>Excluir</button>}</div>}))}/>
      </section>}

      {active==='produtos'&&<section>
        <div className="panel excelPanel">
          <div className="excelPanelText">
            <div className="excelIcon"><FileSpreadsheet size={22}/></div>
            <div><strong>Importação e exportação Excel</strong><span>Exporte o cadastro atual ou importe uma planilha para cadastrar itens e ajustar o estoque pelo código do produto.</span></div>
          </div>
          <div className="excelActions">
            <button type="button" className="ghost" onClick={downloadProductModel}><FileSpreadsheet size={16}/>Baixar modelo</button>
            <button type="button" className="ghost" onClick={exportProducts}><Download size={16}/>Exportar Excel</button>
            <label className={canManageStock?'primary excelUpload':'ghost excelUpload disabledUpload'}>
              <Upload size={16}/>Importar Excel
              <input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv" onChange={e=>void importProducts(e)} disabled={!canManageStock}/>
            </label>
          </div>
          <small className="excelWarning">Na importação, o <strong>Estoque Atual</strong> da planilha substitui o saldo existente. Toda diferença é registrada como ajuste de estoque.</small>
        </div>
        {showForm&&<form className="panel dataForm" onSubmit={saveProduct}><input name="codigo" placeholder="Código" required defaultValue={editingProduct?.codigo||''}/><input name="descricao" placeholder="Descrição" required defaultValue={editingProduct?.descricao||''}/><input name="unidade" defaultValue={editingProduct?.unidade||'UN'}/><input name="custo" type="number" step="0.01" placeholder="Custo" defaultValue={editingProduct?.custo||0}/><input name="preco_venda" type="number" step="0.01" placeholder="Preço de venda" defaultValue={editingProduct?.preco_venda||0}/>{!editingProduct&&<input name="estoque_atual" type="number" step="0.001" placeholder="Estoque inicial" defaultValue={0}/>}<input name="estoque_minimo" type="number" step="0.001" placeholder="Estoque mínimo" defaultValue={editingProduct?.estoque_minimo||0}/><select name="ativo" defaultValue={editingProduct?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select><div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingProduct(null)}}>Cancelar</button><button className="primary">Salvar</button></div></form>}
        {adjustingProduct&&<form className="panel stockForm" onSubmit={adjustStock}><div><strong>Ajustar estoque</strong><span>{adjustingProduct.codigo} - {adjustingProduct.descricao}</span></div><label>Novo estoque<input type="number" min="0" step="0.001" value={stockNew} onChange={e=>setStockNew(e.target.value)} required/></label><label>Motivo<input value={stockReason} onChange={e=>setStockReason(e.target.value)} required/></label><div className="formActions"><button type="button" className="ghost" onClick={()=>setAdjustingProduct(null)}>Cancelar</button><button className="primary">Aplicar</button></div></form>}
        {<div className="cards compactCards"><article className="card"><span>Produtos ativos</span><strong>{produtos.filter(p=>p.ativo).length}</strong></article><article className="card"><span>Estoque baixo</span><strong>{low}</strong></article><article className="card"><span>Valor de custo</span><strong>{money(stockValue)}</strong></article></div>}
        <ProductTable produtos={produtos} openId={productPanel} onToggle={id=>setProductPanel(productPanel===id?null:id)} onEdit={startEditProduct} onAdjust={startAdjustStock} onDelete={deleteProduct} canDelete={isAdmin} readOnly={isViewer}/>
      </section>}

      {active==='compras'&&<section>
        {showForm&&<form className="panel saleForm" onSubmit={savePurchase}><div className="formTitle"><div><h3>{editingPurchase?'Editar compra':'Nova compra'}</h3><p>Compras recebidas entram automaticamente no estoque.</p></div></div><div className="saleHeader"><label>Fornecedor<select value={purchaseSupplier} onChange={e=>setPurchaseSupplier(e.target.value)}><option value="">Sem fornecedor</option>{fornecedores.filter(f=>f.ativo).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select></label><label>Status<select value={purchaseStatus} onChange={e=>setPurchaseStatus(e.target.value)}><option value="aberta">Aberta</option><option value="recebida">Recebida</option></select></label><label className="saleNotes">Observações<input value={purchaseNotes} onChange={e=>setPurchaseNotes(e.target.value)}/></label></div><div className="saleItemsHead"><h3>Itens</h3><button type="button" className="ghost" onClick={()=>setPurchaseItems(x=>[...x,newPurchaseItem()])}><Plus size={16}/>Adicionar item</button></div><div className="saleItems">{purchaseItems.map(i=><div className="purchaseItemRow" key={i.key}><select value={i.produto_id} onChange={e=>choosePurchaseProduct(i.key,e.target.value)} required><option value="">Produto</option>{produtos.filter(p=>p.ativo||p.id===i.produto_id).map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}</select><input type="number" min="0.001" step="0.001" value={i.quantidade} onChange={e=>updatePurchaseItem(i.key,'quantidade',Number(e.target.value))}/><input type="number" min="0" step="0.01" value={i.custo_unitario} onChange={e=>updatePurchaseItem(i.key,'custo_unitario',Number(e.target.value))}/><strong>{money(i.quantidade*i.custo_unitario)}</strong><button type="button" className="iconBtn dangerBtn" onClick={()=>removePurchaseItem(i.key)}><Trash2 size={16}/></button></div>)}</div><div className="saleTotals"><div className="grandTotal"><span>Total</span><strong>{money(purchaseTotal)}</strong></div></div><div className="saleActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);resetPurchaseForm()}}>Cancelar</button><button className="primary" disabled={savingPurchase}>{savingPurchase?'Salvando...':'Salvar compra'}</button></div></form>}
        <article className="panel tablePanel"><div className="panelHead"><h3>Compras</h3></div><div className="tableWrap"><table><thead><tr><th>Data</th><th>Fornecedor</th><th>Status</th><th>Total</th><th>Gerenciar</th></tr></thead><tbody>{compras.map(c=>{const f=fornecedores.find(x=>x.id===c.fornecedor_id);const opened=purchasePanel===c.id;return <Fragment key={c.id}><tr><td>{new Date(c.created_at).toLocaleString('pt-BR')}</td><td>{f?.nome||'Sem fornecedor'}</td><td><span className={`statusBadge status-${c.status==='recebida'?'faturado':c.status==='cancelada'?'cancelado':'pedido'}`}>{c.status}</span></td><td>{money(Number(c.total))}</td><td>{isViewer?<span className="readOnlyTag">Somente leitura</span>:<button className="ghost" onClick={()=>setPurchasePanel(opened?null:c.id)}><SlidersHorizontal size={15}/>Painel {opened?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>}</td></tr>{!readOnly&&opened&&<tr className="manageRow"><td colSpan={5}><div className="actionPanel"><div className="actionMeta"><strong>{f?.nome||'Compra'}</strong><span>{money(Number(c.total))}</span></div><div className="rowActions"><button className="ghost" disabled={c.status==='cancelada'} onClick={()=>void startEditPurchase(c)}><Pencil size={15}/>Editar</button><button className="warningBtn" disabled={c.status==='cancelada'} onClick={()=>void cancelPurchase(c)}><Ban size={15}/>Cancelar</button>{isAdmin&&<button className="dangerAction" onClick={()=>void deletePurchase(c)}><Trash2 size={15}/>Excluir</button>}</div></div></td></tr>}</Fragment>})}</tbody></table></div></article>
      </section>}

      {active==='vendas'&&<section>
        {showForm&&<form className="panel saleForm" onSubmit={saveSale}><div className="formTitle"><div><h3>{editingSale?`Editar fatura ${invoiceNo(editingSale.fatura_numero)}`:'Nova venda / fatura'}</h3><p>Pagamento e fatura são obrigatórios.</p></div></div><div className="saleHeader saleHeaderExpanded"><label>Cliente<select value={saleClient} onChange={e=>setSaleClient(e.target.value)}><option value="">Consumidor</option>{clientes.filter(c=>c.ativo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><label>Status<select value={saleStatus} onChange={e=>setSaleStatus(e.target.value)}><option value="orcamento">Orçamento</option><option value="pedido">Pedido</option><option value="faturado">Faturado</option></select></label><label>Pagamento<select value={salePayment} onChange={e=>changePayment(e.target.value as PaymentMethod)}><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option></select></label><label>Parcelas<select value={saleInstallments} onChange={e=>setSaleInstallments(Number(e.target.value))} disabled={salePayment==='pix'}>{Array.from({length:salePayment==='pix'?1:salePayment==='cartao'?12:24},(_,i)=>i+1).map(n=><option key={n}>{n}</option>)}</select></label><label>1º vencimento<input type="date" value={saleDueDate} onChange={e=>setSaleDueDate(e.target.value)} required/></label><label className="saleNotes">Observações<input value={saleNotes} onChange={e=>setSaleNotes(e.target.value)}/></label></div><div className="paymentNotice"><strong>Fatura obrigatória</strong><span>{paymentLabel(salePayment)} • {saleInstallments}x • vencimento {dateBr(saleDueDate)}</span></div><div className="saleItemsHead"><h3>Itens</h3><button type="button" className="ghost" onClick={()=>setSaleItems(x=>[...x,newSaleItem()])}><Plus size={16}/>Adicionar item</button></div><div className="saleItems">{saleItems.map(i=><div className="saleItemRow" key={i.key}><select value={i.produto_id} onChange={e=>chooseProduct(i.key,e.target.value)} required><option value="">Produto</option>{produtos.filter(p=>p.ativo||p.id===i.produto_id).map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.descricao} — estoque {Number(p.estoque_atual).toLocaleString('pt-BR')}</option>)}</select><input type="number" min="0.001" step="0.001" value={i.quantidade} onChange={e=>updateSaleItem(i.key,'quantidade',Number(e.target.value))}/><input type="number" min="0" step="0.01" value={i.valor_unitario} onChange={e=>updateSaleItem(i.key,'valor_unitario',Number(e.target.value))}/><input type="number" min="0" step="0.01" value={i.desconto} onChange={e=>updateSaleItem(i.key,'desconto',Number(e.target.value))}/><strong>{money(Math.max(0,i.quantidade*i.valor_unitario-i.desconto))}</strong><button type="button" className="iconBtn dangerBtn" onClick={()=>removeSaleItem(i.key)}><Trash2 size={16}/></button></div>)}</div><div className="saleTotals"><div><span>Subtotal</span><strong>{money(saleSubtotal)}</strong></div><div><span>Desconto</span><strong>{money(saleDiscount)}</strong></div><div className="grandTotal"><span>Total</span><strong>{money(saleTotal)}</strong></div></div><div className="saleActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);resetSaleForm()}}>Cancelar</button><button className="primary" disabled={savingSale}>{savingSale?'Salvando...':editingSale?'Salvar e reemitir':'Salvar e emitir fatura'}</button></div></form>}
        <article className="panel tablePanel"><div className="panelHead"><h3>Vendas e faturas</h3></div><div className="tableWrap"><table><thead><tr><th>Fatura</th><th>Data</th><th>Cliente</th><th>Status</th><th>Pagamento</th><th>Total</th><th>Gerenciar</th></tr></thead><tbody>{vendas.map(v=>{const c=clientes.find(x=>x.id===v.cliente_id);const opened=salePanel===v.id;return <Fragment key={v.id}><tr><td><strong>#{invoiceNo(v.fatura_numero)}</strong></td><td>{new Date(v.created_at).toLocaleString('pt-BR')}</td><td>{c?.nome||'Consumidor'}</td><td><span className={`statusBadge status-${v.status}`}>{v.status}</span></td><td>{paymentLabel(v.forma_pagamento)} {Number(v.parcelas)>1?`• ${v.parcelas}x`:''}</td><td>{money(Number(v.total))}</td><td>{isViewer?<button className="ghost" onClick={()=>void downloadSalePdf(v)}><FileDown size={15}/>PDF</button>:<button className="ghost" onClick={()=>setSalePanel(opened?null:v.id)}><SlidersHorizontal size={15}/>Painel {opened?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>}</td></tr>{opened&&<tr className="manageRow"><td colSpan={7}><div className="actionPanel"><div className="actionMeta"><strong>Fatura #{invoiceNo(v.fatura_numero)}</strong><span>{paymentLabel(v.forma_pagamento)} • {v.parcelas}x • {dateBr(v.primeiro_vencimento)}</span></div><div className="rowActions"><button className="ghost" onClick={()=>void downloadSalePdf(v)}><FileDown size={15}/>PDF</button><button className="ghost" disabled={v.status==='cancelado'} onClick={()=>void startEditSale(v)}><Pencil size={15}/>Editar</button><button className="warningBtn" disabled={v.status==='cancelado'} onClick={()=>void cancelSale(v)}><Ban size={15}/>Cancelar</button>{isAdmin&&<button className="dangerAction" onClick={()=>void deleteSale(v)}><Trash2 size={15}/>Excluir</button>}</div></div></td></tr>}</Fragment>})}</tbody></table></div></article>
      </section>}

      {active==='financeiro'&&<section>
        {showForm&&<form className="panel dataForm" onSubmit={saveTitle}><select name="tipo" defaultValue={editingTitle?.tipo||'receber'}><option value="receber">A receber</option><option value="pagar">A pagar</option></select><input name="descricao" placeholder="Descrição" required defaultValue={editingTitle?.descricao||''}/><input name="entidade_nome" placeholder="Cliente / Fornecedor" defaultValue={editingTitle?.entidade_nome||''}/><input name="vencimento" type="date" required defaultValue={editingTitle?.vencimento||today()}/><input name="valor" type="number" min="0" step="0.01" required defaultValue={editingTitle?.valor||0}/><input name="valor_pago" type="number" min="0" step="0.01" defaultValue={editingTitle?.valor_pago||0}/><select name="status" defaultValue={editingTitle?.status||'aberto'}><option value="aberto">Aberto</option><option value="parcial">Parcial</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select><input name="categoria" placeholder="Categoria" defaultValue={editingTitle?.categoria||''}/><input name="centro_custo" placeholder="Centro de custo" defaultValue={editingTitle?.centro_custo||''}/><div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingTitle(null)}}>Cancelar</button><button className="primary">Salvar</button></div></form>}
        <div className="cards compactCards"><article className="card"><span>A receber</span><strong>{money(openReceivables)}</strong></article><article className="card"><span>A pagar</span><strong>{money(openPayables)}</strong></article><article className="card"><span>Saldo projetado</span><strong>{money(openReceivables-openPayables)}</strong></article></div>
        <article className="panel tablePanel"><div className="panelHead"><h3>Lançamentos financeiros</h3></div><div className="tableWrap"><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Entidade</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Status</th><th>Gerenciar</th></tr></thead><tbody>{titulos.map(t=>{const opened=financePanel===t.id;return <Fragment key={t.id}><tr><td>{t.tipo==='receber'?'Receber':'Pagar'}</td><td>{t.descricao}</td><td>{t.entidade_nome||'—'}</td><td>{dateBr(t.vencimento)}</td><td>{money(Number(t.valor))}</td><td>{money(Number(t.valor_pago))}</td><td><span className={`statusBadge status-${t.status==='pago'?'faturado':t.status==='cancelado'?'cancelado':'pedido'}`}>{t.status}</span></td><td>{isViewer?<span className="readOnlyTag">Somente leitura</span>:<button className="ghost" onClick={()=>setFinancePanel(opened?null:t.id)}><SlidersHorizontal size={15}/>Painel</button>}</td></tr>{opened&&<tr className="manageRow"><td colSpan={8}><div className="actionPanel"><div className="actionMeta"><strong>{t.descricao}</strong><span>{t.venda_id?`Ligado à venda • parcela ${t.parcela_numero||1}`:'Lançamento manual'}</span></div><div className="rowActions"><button className="ghost" onClick={()=>startEditTitle(t)}><Pencil size={15}/>Editar</button><button className="ghost" disabled={t.status==='pago'||t.status==='cancelado'} onClick={()=>void markPaid(t)}><CheckCircle2 size={15}/>Marcar pago</button><button className="warningBtn" disabled={t.status==='cancelado'} onClick={()=>void cancelTitle(t)}><Ban size={15}/>Cancelar</button>{isAdmin&&<button className="dangerAction" onClick={()=>void deleteTitle(t)}><Trash2 size={15}/>Excluir</button>}</div></div></td></tr>}</Fragment>})}</tbody></table></div></article>
      </section>}

      {active==='relatorios'&&<section>
        <div className="panel reportFilters"><label>De<input type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/></label><label>Até<input type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/></label><label>Status da venda<select value={reportStatus} onChange={e=>setReportStatus(e.target.value)}><option value="todos">Todos</option><option value="orcamento">Orçamento</option><option value="pedido">Pedido</option><option value="faturado">Faturado</option><option value="cancelado">Cancelado</option></select></label></div>
        <div className="cards compactCards"><article className="card"><span>Vendas no período</span><strong>{money(reportSalesTotal)}</strong><small>{filteredSales.length} registros</small></article><article className="card"><span>Compras no período</span><strong>{money(reportPurchaseTotal)}</strong><small>{filteredPurchases.length} registros</small></article><article className="card"><span>Resultado bruto</span><strong>{money(reportSalesTotal-reportPurchaseTotal)}</strong><small>vendas - compras</small></article></div>
        <div className="grid2"><article className="panel tablePanel"><div className="panelHead"><h3>Vendas filtradas</h3></div><div className="tableWrap"><table><thead><tr><th>Fatura</th><th>Data</th><th>Status</th><th>Total</th></tr></thead><tbody>{filteredSales.map(v=><tr key={v.id}><td>#{invoiceNo(v.fatura_numero)}</td><td>{dateBr(v.created_at)}</td><td>{v.status}</td><td>{money(Number(v.total))}</td></tr>)}</tbody></table></div></article><article className="panel tablePanel"><div className="panelHead"><h3>Compras filtradas</h3></div><div className="tableWrap"><table><thead><tr><th>Data</th><th>Status</th><th>Total</th></tr></thead><tbody>{filteredPurchases.map(c=><tr key={c.id}><td>{dateBr(c.created_at)}</td><td>{c.status}</td><td>{money(Number(c.total))}</td></tr>)}</tbody></table></div></article></div>
      </section>}

      {active==='config'&&<section>
        <form className="panel configForm" onSubmit={saveCompany}>
          <div className="formTitle"><div><h3>Dados da empresa</h3><p>Esses dados alimentam as faturas e a identificação do ERP.</p></div>{!isAdmin&&<span className="readOnlyTag">Somente leitura</span>}</div><fieldset className="configFieldset" disabled={!isAdmin}>
          <input name="razao_social" placeholder="Razão social" defaultValue={empresa?.razao_social||''} required/>
          <input name="nome_fantasia" placeholder="Nome fantasia" defaultValue={empresa?.nome_fantasia||''} required/>
          <input name="cnpj" placeholder="CNPJ" defaultValue={empresa?.cnpj||''}/>
          <input name="email" type="email" placeholder="E-mail" defaultValue={empresa?.email||''}/>
          <input name="telefone" placeholder="Telefone" defaultValue={empresa?.telefone||''}/>
          <input name="endereco" placeholder="Endereço" defaultValue={empresa?.endereco||''}/>
          <input name="cidade" placeholder="Cidade" defaultValue={empresa?.cidade||''}/>
          <input name="uf" placeholder="UF" maxLength={2} defaultValue={empresa?.uf||''}/>
          <input name="cep" placeholder="CEP" defaultValue={empresa?.cep||''}/>
          <input name="pix_chave" placeholder="Chave PIX" defaultValue={empresa?.pix_chave||''}/>
          <input name="banco" placeholder="Banco" defaultValue={empresa?.banco||''}/>
          <input name="agencia" placeholder="Agência" defaultValue={empresa?.agencia||''}/>
          <input name="conta" placeholder="Conta" defaultValue={empresa?.conta||''}/>
          <textarea name="condicoes_gerais" placeholder="Condições gerais da fatura" defaultValue={empresa?.condicoes_gerais||''}/>
          <div className="formActions"><button className="primary">Salvar configurações</button></div></fieldset>
        </form>
      </section>}
    </main>
  </div>
}

function paymentLabel(v:string){return v==='pix'?'PIX':v==='cartao'?'Cartão':v==='boleto'?'Boleto':v||'—'}

function EditableEntityTable({title,headers,rows,readOnly=false}:{title:string;headers:string[];rows:{id:string;cells:(string|number)[];opened:boolean;onToggle:()=>void;panel:ReactNode}[];readOnly?:boolean}){
  return <article className="panel tablePanel"><div className="panelHead"><h3>{title}</h3></div><div className="tableWrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><Fragment key={r.id}><tr>{r.cells.map((c,i)=><td key={i}>{c}</td>)}<td>{readOnly?<span className="readOnlyTag">Somente leitura</span>:<button className="ghost" onClick={r.onToggle}><SlidersHorizontal size={15}/>Painel {r.opened?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>}</td></tr>{!readOnly&&r.opened&&<tr className="manageRow"><td colSpan={headers.length}><div className="actionPanel">{r.panel}</div></td></tr>}</Fragment>)}</tbody></table></div></article>
}

function ProductTable({produtos,openId,onToggle,onEdit,onAdjust,onDelete,canDelete,readOnly=false}:{produtos:Produto[];openId:string|null;onToggle:(id:string)=>void;onEdit:(p:Produto)=>void;onAdjust:(p:Produto)=>void;onDelete:(p:Produto)=>void;canDelete:boolean;readOnly?:boolean}){
  return <article className="panel tablePanel"><div className="panelHead"><div><h3>Produtos / Estoque</h3><p>{produtos.length} cadastrados</p></div></div><div className="tableWrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Status</th><th>Un.</th><th>Estoque</th><th>Mínimo</th><th>Custo</th><th>Venda</th><th>Gerenciar</th></tr></thead><tbody>{produtos.map(p=>{const opened=openId===p.id;const low=Number(p.estoque_atual)<=Number(p.estoque_minimo);return <Fragment key={p.id}><tr><td>{p.codigo}</td><td>{p.descricao}</td><td><span className={p.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{p.ativo?'ativo':'inativo'}</span></td><td>{p.unidade}</td><td><strong className={low?'stockLow':''}>{Number(p.estoque_atual).toLocaleString('pt-BR')}</strong></td><td>{Number(p.estoque_minimo).toLocaleString('pt-BR')}</td><td>{money(Number(p.custo))}</td><td>{money(Number(p.preco_venda))}</td><td>{readOnly?<span className="readOnlyTag">Somente leitura</span>:<button className="ghost" onClick={()=>onToggle(p.id)}><SlidersHorizontal size={15}/>Painel {opened?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>}</td></tr>{opened&&<tr className="manageRow"><td colSpan={9}><div className="actionPanel"><div className="actionMeta"><strong>{p.codigo} - {p.descricao}</strong><span>Estoque: {Number(p.estoque_atual).toLocaleString('pt-BR')} {p.unidade}</span></div><div className="rowActions"><button className="ghost" onClick={()=>onEdit(p)}><Pencil size={15}/>Editar</button><button className="ghost" onClick={()=>onAdjust(p)}><Boxes size={15}/>Ajustar estoque</button>{canDelete&&<button className="dangerAction" onClick={()=>void onDelete(p)}><Trash2 size={15}/>Excluir</button>}</div></div></td></tr>}</Fragment>})}</tbody></table></div></article>
}

export default App
