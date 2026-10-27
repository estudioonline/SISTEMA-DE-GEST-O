import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, ReceiptText, WalletCards,
  BarChart3, Settings, Moon, Sun, Plus, Building2, LogOut, Trash2, FileDown,
  Pencil, Ban, MoreVertical, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight,
  Upload, Download, FileSpreadsheet, BadgeDollarSign, UserPlus, Paperclip, ExternalLink, Search, X
} from 'lucide-react'
import { supabase, supabaseConfigured, supabasePublishableKey, supabaseUrl } from './lib/supabase'
import { generateInvoicePdf } from './lib/invoicePdf'
import { generatePurchaseInvoicePdf } from './lib/purchaseInvoicePdf'
import { generateCommissionReportPdf } from './lib/commissionReportPdf'
import type { CommissionReportRow } from './lib/commissionReportPdf'
import { downloadProductsTemplate, exportProductsExcel, parseProductsExcel } from './lib/productsExcel'

type ModuleKey='dashboard'|'clientes'|'fornecedores'|'produtos'|'compras'|'vendas'|'comissoes'|'financeiro'|'relatorios'|'config'
type PerfilRole='administrador'|'financeiro'|'vendas'|'estoque'|'visualizador'
type PaymentMethod='dinheiro'|'pix'|'cartao'|'boleto'
type PurchasePaymentMethod='pix'|'cartao'|'boleto'

type Cliente={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;limite_credito:number;ativo:boolean}
type Fornecedor={id:string;nome:string;documento:string|null;email:string|null;telefone:string|null;ativo:boolean}
type Produto={id:string;codigo:string;descricao:string;unidade:string;custo:number;preco_venda:number;estoque_atual:number;estoque_minimo:number;ativo:boolean}
type Venda={id:string;cliente_id:string|null;vendedor_id:string|null;vendedor_cadastro_id:string|null;status:string;subtotal:number;desconto:number;total:number;observacoes:string|null;created_at:string;forma_pagamento:PaymentMethod;parcelas:number;primeiro_vencimento:string;fatura_numero:number|null;fatura_gerada_em:string|null;estoque_negativo_autorizado_por?:string|null;estoque_negativo_autorizado_em?:string|null}
type VendaItem={produto_id:string;quantidade:number;valor_unitario:number;desconto:number;total:number}
type SaleItemDraft={key:string;produto_id:string;quantidade:number;valor_unitario:number;desconto:number}
type Compra={id:string;fornecedor_id:string|null;status:string;total:number;observacoes:string|null;created_at:string;forma_pagamento:PurchasePaymentMethod;parcelas:number;primeiro_vencimento:string;vencimentos_parcelas:string[];fatura_numero:number|null;fatura_gerada_em:string|null}
type CompraItem={produto_id:string;quantidade:number;custo_unitario:number;total:number}
type PurchaseItemDraft={key:string;produto_id:string;quantidade:number;custo_unitario:number}
type Titulo={id:string;tipo:'pagar'|'receber';descricao:string;entidade_nome:string|null;vencimento:string;valor:number;valor_pago:number;status:'aberto'|'parcial'|'pago'|'cancelado';categoria:string|null;centro_custo:string|null;venda_id:string|null;compra_id:string|null;parcela_numero:number|null;forma_pagamento:string|null;created_at:string}
type EmpresaConfig={id:number;razao_social:string;nome_fantasia:string;cnpj:string|null;email:string|null;telefone:string|null;endereco:string|null;cidade:string|null;uf:string|null;cep:string|null;pix_chave:string|null;banco:string|null;agencia:string|null;conta:string|null;condicoes_gerais:string|null}
type Vendedor={id:string;nome:string;email:string|null;telefone:string|null;percentual_comissao:number;ativo:boolean;created_at:string}
type ManagedUser={user_id:string;nome:string;email:string;perfil:PerfilRole;ativo:boolean;criado_em:string;ultimo_acesso:string|null;usuario_atual:boolean}
type ComissaoResumo={vendedor_id:string;vendedor_nome:string;percentual_comissao:number;total_recebido:number;comissao_apurada:number;pagamentos:number;vendas:number}
type Comprovante={id:string;venda_id:string|null;compra_id:string|null;storage_path:string;nome_arquivo:string;mime_type:string|null;tamanho:number|null;created_at:string}
type MovimentoEstoque={id:string;produto_id:string;tipo:string;quantidade:number;referencia:string|null;created_at:string}

const menu=[
  ['vendas','Vendas',ReceiptText],['dashboard','Dashboard',LayoutDashboard],['clientes','Clientes',Users],['fornecedores','Fornecedores',Building2],
  ['produtos','Produtos / Estoque',Package],['compras','Compras',ShoppingCart],
  ['comissoes','Comissões',BadgeDollarSign],['financeiro','Financeiro',WalletCards],['relatorios','Relatórios',BarChart3],['config','Configurações',Settings]
] as const

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)
const today=()=>new Date().toISOString().slice(0,10)
const dateBr=(v:string)=>v?new Intl.DateTimeFormat('pt-BR').format(new Date(v.length===10?v+'T12:00:00':v)):'—'
const invoiceNo=(n:number|null|undefined)=>String(n||0).padStart(7,'0')
const onlyDigits=(value:string,max:number)=>value.replace(/\D/g,'').slice(0,max)
const maskDocument=(value:string)=>{
  const d=onlyDigits(value,14)
  if(d.length<=11){
    return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')
  }
  return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}
const maskCnpj=(value:string)=>{
  const d=onlyDigits(value,14)
  return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}
const maskPhone=(value:string)=>{
  const d=onlyDigits(value,11)
  if(d.length<=10)return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d{1,4})$/,'$1-$2')
  return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d{1,4})$/,'$1-$2')
}
const maskCep=(value:string)=>{
  const d=onlyDigits(value,8)
  return d.replace(/(\d{5})(\d{1,3})$/,'$1-$2')
}
const newSaleItem=():SaleItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,valor_unitario:0,desconto:0})
const newPurchaseItem=():PurchaseItemDraft=>({key:`${Date.now()}-${Math.random()}`,produto_id:'',quantidade:1,custo_unitario:0})
const addMonthsIso=(base:string,months:number)=>{
  const [y,m,d]=base.split('-').map(Number)
  const first=new Date(y,m-1+months,1,12)
  const lastDay=new Date(first.getFullYear(),first.getMonth()+1,0,12).getDate()
  const result=new Date(first.getFullYear(),first.getMonth(),Math.min(d,lastDay),12)
  return `${result.getFullYear()}-${String(result.getMonth()+1).padStart(2,'0')}-${String(result.getDate()).padStart(2,'0')}`
}
const buildInstallmentDates=(base:string,count:number)=>Array.from({length:count},(_,i)=>addMonthsIso(base,i))

function App(){
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(true)
  const [active,setActive]=useState<ModuleKey>('dashboard')
  const [dark,setDark]=useState(false)
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false)
  const [profileRole,setProfileRole]=useState<PerfilRole>('vendas')
  const [msg,setMsg]=useState('')
  const [tableSearch,setTableSearch]=useState<Record<string,string>>({})

  const [clientes,setClientes]=useState<Cliente[]>([])
  const [fornecedores,setFornecedores]=useState<Fornecedor[]>([])
  const [produtos,setProdutos]=useState<Produto[]>([])
  const [vendas,setVendas]=useState<Venda[]>([])
  const [compras,setCompras]=useState<Compra[]>([])
  const [titulos,setTitulos]=useState<Titulo[]>([])
  const [empresa,setEmpresa]=useState<EmpresaConfig|null>(null)
  const [vendedores,setVendedores]=useState<Vendedor[]>([])
  const [comprovantes,setComprovantes]=useState<Comprovante[]>([])
  const [comissoes,setComissoes]=useState<ComissaoResumo[]>([])
  const [movimentosEstoque,setMovimentosEstoque]=useState<MovimentoEstoque[]>([])

  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [viewerName,setViewerName]=useState('Visualizador')
  const [viewerEmail,setViewerEmail]=useState('')
  const [viewerPassword,setViewerPassword]=useState('')
  const [creatingViewer,setCreatingViewer]=useState(false)
  const [newUserRole,setNewUserRole]=useState<PerfilRole>('visualizador')
  const [managedUsers,setManagedUsers]=useState<ManagedUser[]>([])
  const [userEdits,setUserEdits]=useState<Record<string,{nome:string;perfil:PerfilRole;ativo:boolean}>>({})
  const [savingUserId,setSavingUserId]=useState<string|null>(null)

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
  const [productSubtab,setProductSubtab]=useState<'cadastro'|'movimentos'>('cadastro')
  const [excelToolsOpen,setExcelToolsOpen]=useState(false)

  const [editingSale,setEditingSale]=useState<Venda|null>(null)
  const [salePanel,setSalePanel]=useState<string|null>(null)
  const [saleClient,setSaleClient]=useState('')
  const [saleSeller,setSaleSeller]=useState('')
  const [saleStatus,setSaleStatus]=useState('pedido')
  const [saleNotes,setSaleNotes]=useState('')
  const [salePayment,setSalePayment]=useState<PaymentMethod>('pix')
  const [saleInstallments,setSaleInstallments]=useState(1)
  const [saleDueDate,setSaleDueDate]=useState(today())
  const [saleItems,setSaleItems]=useState<SaleItemDraft[]>([newSaleItem()])
  const [originalSaleItems,setOriginalSaleItems]=useState<VendaItem[]>([])
  const [savingSale,setSavingSale]=useState(false)

  const [editingPurchase,setEditingPurchase]=useState<Compra|null>(null)
  const [purchasePanel,setPurchasePanel]=useState<string|null>(null)
  const [purchaseSupplier,setPurchaseSupplier]=useState('')
  const [purchaseStatus,setPurchaseStatus]=useState('aberta')
  const [purchaseNotes,setPurchaseNotes]=useState('')
  const [purchasePayment,setPurchasePayment]=useState<PurchasePaymentMethod>('pix')
  const [purchaseInstallments,setPurchaseInstallments]=useState(1)
  const [purchaseDueDate,setPurchaseDueDate]=useState(today())
  const [purchaseInstallmentDates,setPurchaseInstallmentDates]=useState<string[]>([today()])
  const [purchaseItems,setPurchaseItems]=useState<PurchaseItemDraft[]>([newPurchaseItem()])
  const [savingPurchase,setSavingPurchase]=useState(false)

  const [editingTitle,setEditingTitle]=useState<Titulo|null>(null)
  const [financePanel,setFinancePanel]=useState<string|null>(null)
  const [financeSubtab,setFinanceSubtab]=useState<'geral'|'vencidos'>('geral')
  const [paymentDate,setPaymentDate]=useState(today())
  const [paymentAmount,setPaymentAmount]=useState('')

  const [editingSeller,setEditingSeller]=useState<Vendedor|null>(null)
  const [sellerPanel,setSellerPanel]=useState<string|null>(null)
  const [commissionStart,setCommissionStart]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10))
  const [commissionEnd,setCommissionEnd]=useState(today())
  const [commissionReportSeller,setCommissionReportSeller]=useState('todos')

  const [reportStart,setReportStart]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10))
  const [reportEnd,setReportEnd]=useState(today())
  const [reportStatus,setReportStatus]=useState('todos')

  const title=useMemo(()=>menu.find(m=>m[0]===active)?.[1]||'Dashboard',[active])
  const isAdmin=profileRole==='administrador'
  const isViewer=profileRole==='visualizador'
  const canManageStock=isAdmin||profileRole==='estoque'
  const canManageFinance=isAdmin||profileRole==='financeiro'

  useEffect(()=>{
    if(!supabaseConfigured){setLoading(false);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{if(session)void loadData()},[session])
  useEffect(()=>{
    if(session&&active==='comissoes')void loadCommissions()
  },[session,active,commissionStart,commissionEnd])
  useEffect(()=>{
    if(session&&active==='config'&&profileRole==='administrador')void loadManagedUsers()
  },[session,active,profileRole])

  async function loadData(){
    if(!session)return
    const [c,f,p,v,cp,t,ec,pr,vd,cv,me]=await Promise.all([
      supabase.from('clientes').select('*').order('nome'),
      supabase.from('fornecedores').select('*').order('nome'),
      supabase.from('produtos').select('*').order('descricao'),
      supabase.from('vendas').select('*').order('created_at',{ascending:false}).limit(300),
      supabase.from('compras').select('*').order('created_at',{ascending:false}).limit(300),
      supabase.from('titulos_financeiros').select('*').order('vencimento',{ascending:true}).limit(500),
      supabase.from('empresa_config').select('*').eq('id',1).maybeSingle(),
      supabase.from('profiles').select('perfil,ativo').eq('id',session.user.id).maybeSingle(),
      supabase.from('vendedores').select('*').order('nome'),
      supabase.from('comprovantes_pagamento').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('movimentos_estoque').select('*').order('created_at',{ascending:false}).limit(1000)
    ])
    if(!c.error)setClientes((c.data||[]) as Cliente[])
    if(!f.error)setFornecedores((f.data||[]) as Fornecedor[])
    if(!p.error)setProdutos((p.data||[]) as Produto[])
    if(!v.error)setVendas((v.data||[]) as Venda[])
    if(!cp.error)setCompras((cp.data||[]) as Compra[])
    if(!t.error)setTitulos((t.data||[]) as Titulo[])
    if(!ec.error&&ec.data)setEmpresa(ec.data as EmpresaConfig)
    if(!pr.error&&pr.data?.perfil){
      setProfileRole(pr.data.perfil as PerfilRole)
      if(pr.data.ativo===false){
        setMsg('Seu usuário está desativado. Procure um administrador do sistema.')
        await supabase.auth.signOut()
        return
      }
    }
    if(!vd.error)setVendedores((vd.data||[]) as Vendedor[])
    if(!cv.error)setComprovantes((cv.data||[]) as Comprovante[])
    if(!me.error)setMovimentosEstoque((me.data||[]) as MovimentoEstoque[])
  }

  async function loadCommissions(){
    const {data,error}=await supabase.rpc('comissoes_por_periodo',{
      p_inicio:commissionStart,
      p_fim:commissionEnd
    })
    if(error){setMsg('Não foi possível calcular as comissões: '+error.message);return}
    setComissoes((data||[]) as ComissaoResumo[])
  }

  async function downloadCommissionReport(){
    setMsg('')
    const {data,error}=await supabase.rpc('relatorio_comissoes_vendas',{
      p_inicio:commissionStart,
      p_fim:commissionEnd
    })
    if(error){
      setMsg('Não foi possível gerar o relatório de comissões: '+error.message)
      return
    }

    const allRows=(data||[]) as CommissionReportRow[]
    const rows=commissionReportSeller==='todos'
      ? allRows
      : allRows.filter(r=>r.vendedor_id===commissionReportSeller)
    const sellerName=commissionReportSeller==='todos'
      ? null
      : vendedores.find(v=>v.id===commissionReportSeller)?.nome||'Vendedor'

    generateCommissionReportPdf({
      inicio:commissionStart,
      fim:commissionEnd,
      company:empresa,
      vendedorFiltro:sellerName,
      rows
    })
    setMsg(`Relatório PDF gerado para ${sellerName||'todos os vendedores'} com ${rows.length} recebimento(s) apurado(s).`)
  }

  function startNewSeller(){
    setEditingSeller(null)
    setShowForm(true)
    setMsg('')
  }

  function startEditSeller(v:Vendedor){
    setEditingSeller(v)
    setShowForm(true)
    setMsg('')
  }

  async function saveSeller(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!isAdmin){setMsg('Somente administrador pode cadastrar ou editar vendedores.');return}
    const f=new FormData(e.currentTarget)
    const payload={
      nome:String(f.get('nome')||'').trim(),
      email:String(f.get('email')||'').trim()||null,
      telefone:String(f.get('telefone')||'').trim()||null,
      percentual_comissao:Number(f.get('percentual_comissao')||0),
      ativo:String(f.get('ativo')||'true')==='true',
      updated_at:new Date().toISOString()
    }
    const r=editingSeller
      ? await supabase.from('vendedores').update(payload).eq('id',editingSeller.id)
      : await supabase.from('vendedores').insert(payload)
    setMsg(r.error?r.error.message:editingSeller?'Vendedor atualizado.':'Vendedor cadastrado.')
    if(!r.error){
      setEditingSeller(null)
      setShowForm(false)
      await loadData()
      await loadCommissions()
    }
  }

  async function deactivateSeller(v:Vendedor){
    if(!isAdmin)return
    const {error}=await supabase.from('vendedores').update({ativo:false,updated_at:new Date().toISOString()}).eq('id',v.id)
    setMsg(error?error.message:'Vendedor desativado.')
    if(!error){await loadData();await loadCommissions()}
  }

  function proofsFor(kind:'venda'|'compra',id:string){
    return comprovantes.filter(p=>kind==='venda'?p.venda_id===id:p.compra_id===id)
  }

  async function uploadProof(kind:'venda'|'compra',id:string,e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]
    e.target.value=''
    if(!file)return
    if(isViewer){setMsg('Usuário visualizador não pode anexar comprovantes.');return}
    const allowed=['application/pdf','image/jpeg','image/png','image/webp']
    if(!allowed.includes(file.type)){setMsg('Envie um comprovante em PDF, JPG, PNG ou WEBP.');return}
    if(file.size>10*1024*1024){setMsg('O comprovante deve ter no máximo 10 MB.');return}

    const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')
    const folder=kind==='venda'?'vendas':'compras'
    const path=`${folder}/${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const upload=await supabase.storage.from('comprovantes-pagamento').upload(path,file,{
      contentType:file.type,
      upsert:false
    })
    if(upload.error){setMsg('Falha ao enviar comprovante: '+upload.error.message);return}

    const payload={
      venda_id:kind==='venda'?id:null,
      compra_id:kind==='compra'?id:null,
      storage_path:path,
      nome_arquivo:file.name,
      mime_type:file.type,
      tamanho:file.size
    }
    const meta=await supabase.from('comprovantes_pagamento').insert(payload)
    if(meta.error){
      await supabase.storage.from('comprovantes-pagamento').remove([path])
      setMsg('Falha ao registrar comprovante: '+meta.error.message)
      return
    }

    setMsg('Comprovante anexado à fatura.')
    await loadData()
  }

  async function openProof(p:Comprovante){
    const {data,error}=await supabase.storage.from('comprovantes-pagamento').createSignedUrl(p.storage_path,300)
    if(error||!data?.signedUrl){setMsg('Não foi possível abrir o comprovante.');return}
    window.open(data.signedUrl,'_blank','noopener,noreferrer')
  }

  async function deleteProof(p:Comprovante){
    if(!(isAdmin||profileRole==='financeiro')){setMsg('Somente administrador ou financeiro pode excluir comprovante.');return}
    if(!window.confirm('Excluir este comprovante?'))return
    const storage=await supabase.storage.from('comprovantes-pagamento').remove([p.storage_path])
    if(storage.error){setMsg(storage.error.message);return}
    const meta=await supabase.from('comprovantes_pagamento').delete().eq('id',p.id)
    setMsg(meta.error?meta.error.message:'Comprovante excluído.')
    if(!meta.error)await loadData()
  }

  async function login(e:FormEvent){
    e.preventDefault();setMsg('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error)setMsg(error.message)
  }

  function closeForms(){
    setShowForm(false)
    setEditingClient(null)
    setEditingSupplier(null)
    setEditingProduct(null)
    setAdjustingProduct(null)
    setEditingTitle(null)
    setEditingSeller(null)
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
  function resetSaleForm(){setEditingSale(null);setOriginalSaleItems([]);setSaleClient('');setSaleSeller('');setSaleStatus('pedido');setSaleNotes('');setSalePayment('pix');setSaleInstallments(1);setSaleDueDate(today());setSaleItems([newSaleItem()])}
  function startNewSale(){resetSaleForm();setShowForm(true);setMsg('')}
  async function startEditSale(v:Venda){
    if(v.status==='cancelado'){setMsg('Venda cancelada não pode ser editada.');return}
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total').eq('venda_id',v.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as VendaItem[]
    setOriginalSaleItems(items)
    setEditingSale(v);setSaleClient(v.cliente_id||'');setSaleSeller(v.vendedor_cadastro_id||'');setSaleStatus(v.status);setSaleNotes(v.observacoes||'');setSalePayment(v.forma_pagamento||'pix');setSaleInstallments(Number(v.parcelas)||1);setSaleDueDate(v.primeiro_vencimento||today())
    setSaleItems(items.map(i=>({key:`${Date.now()}-${Math.random()}`,produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto)})))
    setShowForm(true);setMsg('')
  }
  function chooseProduct(key:string,id:string){const p=produtos.find(x=>x.id===id);setSaleItems(items=>items.map(i=>i.key===key?{...i,produto_id:id,valor_unitario:p?Number(p.preco_venda):0}:i))}
  function updateSaleItem(key:string,field:'quantidade'|'valor_unitario'|'desconto',value:number){setSaleItems(items=>items.map(i=>i.key===key?{...i,[field]:Math.max(0,value||0)}:i))}
  function removeSaleItem(key:string){setSaleItems(items=>items.length===1?items:items.filter(i=>i.key!==key))}
  function changePayment(v:PaymentMethod){setSalePayment(v);if(v==='dinheiro'){setSaleInstallments(1);setSaleDueDate(today())}if(v==='pix')setSaleInstallments(1);if(v==='cartao')setSaleInstallments(x=>Math.min(Math.max(x,1),12));if(v==='boleto')setSaleInstallments(x=>Math.min(Math.max(x,1),24))}
  function invoiceItems(items:SaleItemDraft[]){return items.map(i=>{const p=produtos.find(x=>x.id===i.produto_id);const d=Math.min(i.desconto,i.quantidade*i.valor_unitario);return{codigo:p?.codigo,descricao:p?.descricao||'Produto',unidade:p?.unidade||'UN',quantidade:i.quantidade,valor_unitario:i.valor_unitario,desconto:d,total:Math.max(0,i.quantidade*i.valor_unitario-d)}})}
  async function saveSale(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!session)return
    const items=saleItems.filter(i=>i.produto_id&&i.quantidade>0)
    if(!items.length){setMsg('Adicione pelo menos um produto.');return}

    const precisaAutorizar=saleConsumesStock&&saleStockShortages.length>0
    let autorizarSemEstoque=false
    if(precisaAutorizar){
      const resumo=saleStockShortages.map(s=>`${s.produto.codigo} - ${s.produto.descricao}: faltam ${s.missing.toLocaleString('pt-BR')} ${s.produto.unidade}`).join('\n')
      if(!isAdmin){
        setMsg('Venda bloqueada por estoque insuficiente. É necessária autorização de um administrador. '+saleStockShortages.map(s=>s.produto.descricao).join(', '))
        return
      }
      const confirmacao=window.prompt(`ATENÇÃO: a venda deixará o estoque negativo.\n\n${resumo}\n\nPara autorizar como administrador, digite AUTORIZAR.`)
      if((confirmacao||'').trim().toUpperCase()!=='AUTORIZAR'){
        setMsg('Venda não concluída: autorização de estoque não confirmada.')
        return
      }
      autorizarSemEstoque=true
    }

    setSavingSale(true);setMsg('')
    const args={p_cliente_id:saleClient||null,p_vendedor_cadastro_id:saleSeller||null,p_status:saleStatus,p_forma_pagamento:salePayment,p_parcelas:saleInstallments,p_primeiro_vencimento:saleDueDate,p_observacoes:saleNotes,p_itens:items.map(i=>({produto_id:i.produto_id,quantidade:i.quantidade,valor_unitario:i.valor_unitario,desconto:i.desconto}))}
    const rpcName=editingSale
      ? (autorizarSemEstoque?'atualizar_venda_completa_admin_sem_estoque':'atualizar_venda_completa')
      : (autorizarSemEstoque?'criar_venda_completa_admin_sem_estoque':'criar_venda_completa')
    const r=editingSale
      ? await supabase.rpc(rpcName,{p_venda_id:editingSale.id,...args})
      : await supabase.rpc(rpcName,args)
    if(r.error||!r.data){setSavingSale(false);setMsg('Não foi possível salvar a venda: '+(r.error?.message||'erro desconhecido'));return}
    const saved=(Array.isArray(r.data)?r.data[0]:r.data) as Venda
    const subtotal=items.reduce((s,i)=>s+i.quantidade*i.valor_unitario,0)
    const desconto=items.reduce((s,i)=>s+Math.min(i.desconto,i.quantidade*i.valor_unitario),0)
    const total=Math.max(0,subtotal-desconto)
    try{
      generateInvoicePdf({id:saved.id,fatura_numero:saved.fatura_numero,created_at:saved.created_at||new Date().toISOString(),status:saved.status,subtotal,desconto,total,observacoes:saleNotes||null,forma_pagamento:salePayment,parcelas:saleInstallments,primeiro_vencimento:saleDueDate,vendedor_nome:vendedores.find(v=>v.id===saleSeller)?.nome||null,cliente:clientes.find(c=>c.id===saleClient)||null,company:empresa||undefined,items:invoiceItems(items)})
      await supabase.from('vendas').update({fatura_gerada_em:new Date().toISOString()}).eq('id',saved.id)
      setMsg(autorizarSemEstoque?(editingSale?'Venda atualizada com autorização administrativa de estoque e fatura reemitida.':'Venda criada com autorização administrativa de estoque e fatura emitida.'):(editingSale?'Venda atualizada e fatura reemitida.':'Venda criada e fatura emitida.'))
    }catch{setMsg('Venda salva. A fatura pode ser reemitida pelo painel.')}
    setSavingSale(false);setShowForm(false);resetSaleForm();await loadData()
  }
  async function downloadSalePdf(v:Venda){
    const {data,error}=await supabase.from('venda_itens').select('produto_id,quantidade,valor_unitario,desconto,total').eq('venda_id',v.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as VendaItem[]
    const drafts=items.map(i=>({key:'pdf',produto_id:i.produto_id,quantidade:Number(i.quantidade),valor_unitario:Number(i.valor_unitario),desconto:Number(i.desconto)}))
    try{generateInvoicePdf({id:v.id,fatura_numero:v.fatura_numero,created_at:v.created_at,status:v.status,subtotal:Number(v.subtotal),desconto:Number(v.desconto),total:Number(v.total),observacoes:v.observacoes,forma_pagamento:v.forma_pagamento,parcelas:Number(v.parcelas),primeiro_vencimento:v.primeiro_vencimento,vendedor_nome:vendedores.find(s=>s.id===v.vendedor_cadastro_id)?.nome||null,cliente:clientes.find(c=>c.id===v.cliente_id)||null,company:empresa||undefined,items:invoiceItems(drafts)});await supabase.from('vendas').update({fatura_gerada_em:new Date().toISOString()}).eq('id',v.id)}catch{setMsg('Não foi possível gerar o PDF.')}
  }
  async function cancelSale(v:Venda){if(v.status==='cancelado'||!window.confirm(`Cancelar fatura ${invoiceNo(v.fatura_numero)}?`))return;const r=await supabase.from('vendas').update({status:'cancelado'}).eq('id',v.id);setMsg(r.error?r.error.message:'Venda cancelada e estoque/financeiro estornados.');if(!r.error){setSalePanel(null);await loadData()}}
  async function deleteSale(v:Venda){if(!isAdmin){setMsg('Somente administrador pode excluir venda.');return}if(!window.confirm(`Excluir fatura ${invoiceNo(v.fatura_numero)} definitivamente?`))return;const r=await supabase.from('vendas').delete().eq('id',v.id);setMsg(r.error?r.error.message:'Venda excluída.');if(!r.error){setSalePanel(null);await loadData()}}

  // COMPRAS
  function resetPurchaseForm(){const base=today();setEditingPurchase(null);setPurchaseSupplier('');setPurchaseStatus('aberta');setPurchaseNotes('');setPurchasePayment('pix');setPurchaseInstallments(1);setPurchaseDueDate(base);setPurchaseInstallmentDates([base]);setPurchaseItems([newPurchaseItem()])}
  function startNewPurchase(){resetPurchaseForm();setShowForm(true);setMsg('')}
  async function startEditPurchase(c:Compra){
    if(c.status==='cancelada'){setMsg('Compra cancelada não pode ser editada.');return}
    const {data,error}=await supabase.from('compra_itens').select('produto_id,quantidade,custo_unitario,total').eq('compra_id',c.id)
    if(error){setMsg(error.message);return}
    const items=(data||[]) as CompraItem[]
    const base=c.primeiro_vencimento||today();const count=Number(c.parcelas)||1;const dates=Array.isArray(c.vencimentos_parcelas)&&c.vencimentos_parcelas.length===count?c.vencimentos_parcelas:buildInstallmentDates(base,count);setEditingPurchase(c);setPurchaseSupplier(c.fornecedor_id||'');setPurchaseStatus(c.status);setPurchaseNotes(c.observacoes||'');setPurchasePayment(c.forma_pagamento||'pix');setPurchaseInstallments(count);setPurchaseDueDate(dates[0]||base);setPurchaseInstallmentDates(dates)
    setPurchaseItems(items.map(i=>({key:`${Date.now()}-${Math.random()}`,produto_id:i.produto_id,quantidade:Number(i.quantidade),custo_unitario:Number(i.custo_unitario)})))
    setShowForm(true);setMsg('')
  }
  function choosePurchaseProduct(key:string,id:string){const p=produtos.find(x=>x.id===id);setPurchaseItems(items=>items.map(i=>i.key===key?{...i,produto_id:id,custo_unitario:p?Number(p.custo):0}:i))}
  function updatePurchaseItem(key:string,field:'quantidade'|'custo_unitario',value:number){setPurchaseItems(items=>items.map(i=>i.key===key?{...i,[field]:Math.max(0,value||0)}:i))}
  function removePurchaseItem(key:string){setPurchaseItems(items=>items.length===1?items:items.filter(i=>i.key!==key))}
  function resizePurchaseDates(count:number){
    const base=purchaseInstallmentDates[0]||purchaseDueDate||today()
    setPurchaseInstallments(count)
    setPurchaseDueDate(base)
    setPurchaseInstallmentDates(prev=>Array.from({length:count},(_,i)=>prev[i]||addMonthsIso(base,i)))
  }

  function changePurchasePayment(v:PurchasePaymentMethod){
    setPurchasePayment(v)
    if(v==='pix')resizePurchaseDates(1)
    if(v==='cartao')resizePurchaseDates(Math.min(Math.max(purchaseInstallments,1),12))
    if(v==='boleto')resizePurchaseDates(Math.min(Math.max(purchaseInstallments,1),24))
  }

  function changePurchaseInstallmentDate(index:number,value:string){
    setPurchaseInstallmentDates(prev=>{
      const next=[...prev]
      next[index]=value
      if(index===0)setPurchaseDueDate(value)
      return next
    })
  }

  function purchasePdfItems(items:PurchaseItemDraft[]){
    return items.map(i=>{
      const p=produtos.find(x=>x.id===i.produto_id)
      return {
        codigo:p?.codigo,
        descricao:p?.descricao||'Produto',
        unidade:p?.unidade||'UN',
        quantidade:i.quantidade,
        custo_unitario:i.custo_unitario,
        total:i.quantidade*i.custo_unitario
      }
    })
  }

  async function savePurchase(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const items=purchaseItems.filter(i=>i.produto_id&&i.quantidade>0)
    if(!items.length){setMsg('Adicione pelo menos um produto.');return}

    const maxInstallments=purchasePayment==='pix'?1:purchasePayment==='cartao'?12:24
    if(purchaseInstallments<1||purchaseInstallments>maxInstallments){
      setMsg('Quantidade de parcelas inválida para a forma de pagamento.')
      return
    }

    if(purchaseInstallmentDates.length!==purchaseInstallments||purchaseInstallmentDates.some(v=>!v)){
      setMsg('Informe a data de vencimento de cada parcela.')
      return
    }

    setSavingPurchase(true)
    const args={
      p_fornecedor_id:purchaseSupplier||null,
      p_status:purchaseStatus,
      p_forma_pagamento:purchasePayment,
      p_parcelas:purchaseInstallments,
      p_primeiro_vencimento:purchaseInstallmentDates[0]||purchaseDueDate,
      p_vencimentos:purchaseInstallmentDates,
      p_observacoes:purchaseNotes,
      p_itens:items.map(i=>({produto_id:i.produto_id,quantidade:i.quantidade,custo_unitario:i.custo_unitario}))
    }
    const r=editingPurchase
      ? await supabase.rpc('atualizar_compra_completa',{p_compra_id:editingPurchase.id,...args})
      : await supabase.rpc('criar_compra_completa',args)

    if(r.error||!r.data){
      setSavingPurchase(false)
      setMsg(r.error?.message||'Não foi possível salvar a compra.')
      return
    }

    const saved=(Array.isArray(r.data)?r.data[0]:r.data) as Compra
    const total=items.reduce((s,i)=>s+(i.quantidade*i.custo_unitario),0)
    const fornecedor=fornecedores.find(f=>f.id===purchaseSupplier)||null

    try{
      generatePurchaseInvoicePdf({
        id:saved.id,
        fatura_numero:saved.fatura_numero,
        created_at:saved.created_at||new Date().toISOString(),
        status:saved.status,
        total,
        observacoes:purchaseNotes||null,
        forma_pagamento:purchasePayment,
        parcelas:purchaseInstallments,
        primeiro_vencimento:purchaseInstallmentDates[0]||purchaseDueDate,
        vencimentos_parcelas:purchaseInstallmentDates,
        fornecedor,
        company:empresa||undefined,
        items:purchasePdfItems(items)
      })
      await supabase.from('compras').update({fatura_gerada_em:new Date().toISOString()}).eq('id',saved.id)
      setMsg(editingPurchase?'Compra atualizada, contas a pagar recalculadas e PDF reemitido.':'Compra criada, contas a pagar geradas e PDF emitido.')
    }catch{
      setMsg('Compra salva e contas a pagar geradas. O PDF pode ser reemitido pelo painel.')
    }

    setSavingPurchase(false)
    setShowForm(false)
    resetPurchaseForm()
    await loadData()
  }

  async function downloadPurchasePdf(compra:Compra){
    const {data,error}=await supabase.from('compra_itens')
      .select('produto_id,quantidade,custo_unitario,total')
      .eq('compra_id',compra.id)

    if(error){setMsg(error.message);return}

    const items=(data||[]) as CompraItem[]
    const fornecedor=fornecedores.find(f=>f.id===compra.fornecedor_id)||null

    try{
      generatePurchaseInvoicePdf({
        id:compra.id,
        fatura_numero:compra.fatura_numero,
        created_at:compra.created_at,
        status:compra.status,
        total:Number(compra.total),
        observacoes:compra.observacoes,
        forma_pagamento:compra.forma_pagamento,
        parcelas:Number(compra.parcelas),
        primeiro_vencimento:compra.primeiro_vencimento,
        vencimentos_parcelas:Array.isArray(compra.vencimentos_parcelas)?compra.vencimentos_parcelas:buildInstallmentDates(compra.primeiro_vencimento,Number(compra.parcelas)),
        fornecedor,
        company:empresa||undefined,
        items:items.map(i=>{
          const p=produtos.find(x=>x.id===i.produto_id)
          return {
            codigo:p?.codigo,
            descricao:p?.descricao||'Produto',
            unidade:p?.unidade||'UN',
            quantidade:Number(i.quantidade),
            custo_unitario:Number(i.custo_unitario),
            total:Number(i.total)
          }
        })
      })
      await supabase.from('compras').update({fatura_gerada_em:new Date().toISOString()}).eq('id',compra.id)
    }catch{
      setMsg('Não foi possível gerar o PDF desta compra.')
    }
  }
  async function cancelPurchase(c:Compra){if(c.status==='cancelada'||!window.confirm('Cancelar esta compra? O estoque será estornado e as contas a pagar em aberto serão canceladas.'))return;const r=await supabase.from('compras').update({status:'cancelada'}).eq('id',c.id);setMsg(r.error?r.error.message:'Compra cancelada, estoque estornado e contas a pagar canceladas.');if(!r.error){setPurchasePanel(null);await loadData()}}
  async function deletePurchase(c:Compra){if(!isAdmin){setMsg('Somente administrador pode excluir compra.');return}if(!window.confirm('Excluir esta compra definitivamente?'))return;const r=await supabase.from('compras').delete().eq('id',c.id);setMsg(r.error?r.error.message:'Compra excluída.');if(!r.error){setPurchasePanel(null);await loadData()}}

  // FINANCEIRO
  function startNewTitle(){
    setEditingTitle(null)
    setShowForm(true)
    setMsg('')
  }

  function startEditTitle(t:Titulo){
    setEditingTitle(t)
    setShowForm(true)
    setMsg('')
  }

  function openFinancePanel(t:Titulo){
    if(financePanel===t.id){
      setFinancePanel(null)
      return
    }
    setFinancePanel(t.id)
    setPaymentDate(today())
    setPaymentAmount(String(Math.max(0,Number(t.valor)-Number(t.valor_pago)).toFixed(2)))
  }

  async function saveTitle(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    const f=new FormData(e.currentTarget)
    const valor=Number(f.get('valor')||0)
    if(editingTitle&&valor<Number(editingTitle.valor_pago)){
      setMsg('O valor do título não pode ficar abaixo do que já foi pago/recebido.')
      return
    }

    const payload={
      tipo:String(f.get('tipo')) as 'pagar'|'receber',
      descricao:String(f.get('descricao')||''),
      entidade_nome:String(f.get('entidade_nome')||'')||null,
      vencimento:String(f.get('vencimento')||today()),
      valor,
      categoria:String(f.get('categoria')||'')||null,
      centro_custo:String(f.get('centro_custo')||'')||null
    }

    const r=editingTitle
      ? await supabase.from('titulos_financeiros').update(payload).eq('id',editingTitle.id)
      : await supabase.from('titulos_financeiros').insert({...payload,valor_pago:0,status:'aberto'})

    setMsg(r.error?r.error.message:editingTitle?'Lançamento atualizado.':'Lançamento criado.')
    if(!r.error){
      setShowForm(false)
      setEditingTitle(null)
      await loadData()
    }
  }

  async function registerPayment(t:Titulo){
    const amount=Number(paymentAmount)
    const balance=Math.max(0,Number(t.valor)-Number(t.valor_pago))
    if(!paymentDate){setMsg('Informe a data do pagamento/recebimento.');return}
    if(!Number.isFinite(amount)||amount<=0){setMsg('Informe um valor válido.');return}
    if(amount>balance){setMsg('O valor informado é maior que o saldo em aberto.');return}

    const {error}=await supabase.rpc('registrar_pagamento_titulo',{
      p_titulo_id:t.id,
      p_valor:amount,
      p_data_pagamento:paymentDate,
      p_observacao:t.tipo==='receber'?'Recebimento registrado no financeiro':'Pagamento registrado no financeiro'
    })

    setMsg(error
      ? error.message
      : t.tipo==='receber'
        ? 'Recebimento registrado. A comissão foi atualizada pela data informada.'
        : 'Pagamento registrado.')

    if(!error){
      setFinancePanel(null)
      await loadData()
      if(active==='comissoes')await loadCommissions()
    }
  }

  async function cancelTitle(t:Titulo){
    const r=await supabase.from('titulos_financeiros').update({status:'cancelado'}).eq('id',t.id)
    setMsg(r.error?r.error.message:'Lançamento cancelado.')
    if(!r.error)await loadData()
  }

  async function deleteTitle(t:Titulo){
    if(!isAdmin){setMsg('Somente administrador pode excluir lançamento.');return}
    if(!window.confirm('Excluir este lançamento?'))return
    const r=await supabase.from('titulos_financeiros').delete().eq('id',t.id)
    setMsg(r.error?r.error.message:'Lançamento excluído.')
    if(!r.error)await loadData()
  }

  // CONFIG
  async function loadManagedUsers(){
    if(!isAdmin)return
    const {data,error}=await supabase.rpc('listar_usuarios_erp')
    if(error){setMsg('Não foi possível carregar os usuários: '+error.message);return}
    const rows=(data||[]) as ManagedUser[]
    setManagedUsers(rows)
    setUserEdits(Object.fromEntries(rows.map(u=>[u.user_id,{nome:u.nome,perfil:u.perfil,ativo:u.ativo}])))
  }

  function editManagedUser(id:string,field:'nome'|'perfil'|'ativo',value:string|boolean){
    setUserEdits(prev=>({
      ...prev,
      [id]:{
        ...(prev[id]||{nome:'',perfil:'visualizador' as PerfilRole,ativo:true}),
        [field]:value
      }
    }))
  }

  async function saveManagedUser(u:ManagedUser){
    if(!isAdmin){setMsg('Somente administrador pode gerenciar usuários.');return}
    const draft=userEdits[u.user_id]||{nome:u.nome,perfil:u.perfil,ativo:u.ativo}
    if(!draft.ativo&&u.ativo&&!window.confirm(`Desativar o acesso de "${u.nome}" ao sistema?`))return

    setSavingUserId(u.user_id)
    setMsg('')
    const {error}=await supabase.rpc('atualizar_usuario_erp',{
      p_user_id:u.user_id,
      p_nome:draft.nome.trim(),
      p_perfil:draft.perfil,
      p_ativo:draft.ativo
    })
    setSavingUserId(null)

    if(error){setMsg(error.message);return}
    setMsg('Usuário atualizado com sucesso.')
    await loadManagedUsers()
  }

  async function createManagedUserAccount(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!isAdmin){
      setMsg('Somente administrador pode criar usuários.')
      return
    }
    if(!supabaseUrl||!supabasePublishableKey){
      setMsg('Configuração do Supabase indisponível.')
      return
    }

    setCreatingViewer(true)
    setMsg('')

    const creator=createClient(supabaseUrl,supabasePublishableKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    })

    const {data,error}=await creator.auth.signUp({
      email:viewerEmail.trim(),
      password:viewerPassword,
      options:{data:{full_name:viewerName.trim()||'Visualizador'}}
    })

    if(error||!data.user){
      setCreatingViewer(false)
      setMsg(error?.message||'Não foi possível criar o usuário.')
      return
    }

    const {error:roleError}=await supabase.rpc('atualizar_usuario_erp',{p_user_id:data.user.id,p_nome:viewerName.trim()||'Usuário',p_perfil:newUserRole,p_ativo:true})
    if(roleError){
      setCreatingViewer(false)
      setMsg('Usuário criado, mas não foi possível aplicar o perfil selecionado: '+roleError.message)
      return
    }

    if(data.session)await creator.auth.signOut()

    setViewerEmail('')
    setViewerPassword('')
    setNewUserRole('visualizador')
    setCreatingViewer(false)
    setMsg(data.session
      ? 'Usuário criado e liberado para acesso.'
      : 'Usuário criado. Confirme o e-mail enviado para liberar o acesso.')
    await loadManagedUsers()
  }

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
  if(!session)return <div className="modulePlaceholder"><form onSubmit={login} className="panel dataForm" style={{maxWidth:420,width:'100%'}}><h2>Sistema de Gestão</h2><p>Acesse o ERP</p><input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/><button className="primary">Entrar</button>{msg&&<p>{msg}</p>}</form></div>

  const low=produtos.filter(p=>p.ativo&&Number(p.estoque_atual)<=Number(p.estoque_minimo)).length
  const stockValue=produtos.reduce((s,p)=>s+Number(p.estoque_atual)*Number(p.custo),0)
  const monthSales=vendas.filter(v=>{const d=new Date(v.created_at),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&v.status!=='cancelado'}).reduce((s,v)=>s+Number(v.total),0)
  const openReceivables=titulos.filter(t=>t.tipo==='receber'&&t.status!=='pago'&&t.status!=='cancelado').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const openPayables=titulos.filter(t=>t.tipo==='pagar'&&t.status!=='pago'&&t.status!=='cancelado').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const overdueTitles=titulos.filter(t=>t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0)
  const overdueReceivables=overdueTitles.filter(t=>t.tipo==='receber').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const overduePayables=overdueTitles.filter(t=>t.tipo==='pagar').reduce((s,t)=>s+Math.max(0,Number(t.valor)-Number(t.valor_pago)),0)
  const saleSubtotal=saleItems.reduce((s,i)=>s+i.quantidade*i.valor_unitario,0)
  const saleDiscount=saleItems.reduce((s,i)=>s+Math.min(i.desconto,i.quantidade*i.valor_unitario),0)
  const saleTotal=Math.max(0,saleSubtotal-saleDiscount)
  const saleConsumesStock=saleStatus==='pedido'||saleStatus==='faturado'
  const saleDemandByProduct=saleItems.reduce<Record<string,number>>((acc,item)=>{
    if(item.produto_id)acc[item.produto_id]=(acc[item.produto_id]||0)+Number(item.quantidade||0)
    return acc
  },{})
  const originalSaleQtyByProduct=originalSaleItems.reduce<Record<string,number>>((acc,item)=>{
    acc[item.produto_id]=(acc[item.produto_id]||0)+Number(item.quantidade||0)
    return acc
  },{})
  const saleStockShortages=Object.entries(saleDemandByProduct).flatMap(([produtoId,demand])=>{
    const produto=produtos.find(p=>p.id===produtoId)
    if(!produto)return []
    const available=Number(produto.estoque_atual)+(editingSale?Number(originalSaleQtyByProduct[produtoId]||0):0)
    return demand>available?[{produto,available,demand,missing:demand-available}]:[]
  })
  function saleItemStockInfo(item:SaleItemDraft){
    const produto=produtos.find(p=>p.id===item.produto_id)
    if(!produto)return null
    const available=Number(produto.estoque_atual)+(editingSale?Number(originalSaleQtyByProduct[item.produto_id]||0):0)
    const demand=Number(saleDemandByProduct[item.produto_id]||0)
    if(available<=0)return {kind:'none',label:'Sem estoque',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade}`}
    if(demand>available)return {kind:'low',label:'Estoque insuficiente',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade} • solicitado: ${demand.toLocaleString('pt-BR')}`}
    return {kind:'ok',label:'Em estoque',detail:`Disponível: ${available.toLocaleString('pt-BR')} ${produto.unidade}`}
  }
  const purchaseTotal=purchaseItems.reduce((s,i)=>s+i.quantidade*i.custo_unitario,0)

  const filteredSales=vendas.filter(v=>{const d=v.created_at.slice(0,10);return d>=reportStart&&d<=reportEnd&&(reportStatus==='todos'||v.status===reportStatus)})
  const filteredPurchases=compras.filter(c=>{const d=c.created_at.slice(0,10);return d>=reportStart&&d<=reportEnd})
  const reportSalesTotal=filteredSales.filter(v=>v.status!=='cancelado').reduce((s,v)=>s+Number(v.total),0)
  const reportPurchaseTotal=filteredPurchases.filter(c=>c.status!=='cancelada').reduce((s,c)=>s+Number(c.total),0)

  const normalizeSearch=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  const searchMatches=(key:string,values:unknown[])=>{
    const query=normalizeSearch(tableSearch[key]||'').trim()
    if(!query)return true
    return normalizeSearch(values.join(' ')).includes(query)
  }
  const setSearch=(key:string,value:string)=>setTableSearch(prev=>({...prev,[key]:value}))

  const commissionReceived=comissoes.reduce((s,c)=>s+Number(c.total_recebido),0)
  const commissionTotal=comissoes.reduce((s,c)=>s+Number(c.comissao_apurada),0)
  const salesWithoutSeller=vendas.filter(v=>v.status!=='cancelado'&&!v.vendedor_cadastro_id).length
  const visiblePurchases=compras.filter(c=>{const f=fornecedores.find(x=>x.id===c.fornecedor_id);return searchMatches('compras',[invoiceNo(c.fatura_numero),new Date(c.created_at).toLocaleString('pt-BR'),f?.nome||'Sem fornecedor',c.status,paymentLabel(c.forma_pagamento),c.parcelas,money(Number(c.total))])})
  const visibleSales=vendas.filter(v=>{const client=clientes.find(x=>x.id===v.cliente_id);const seller=vendedores.find(x=>x.id===v.vendedor_cadastro_id);const ps=salePaymentStatus(v);return searchMatches('vendas',[invoiceNo(v.fatura_numero),new Date(v.created_at).toLocaleString('pt-BR'),client?.nome||'Consumidor',seller?.nome||'',v.status,paymentLabel(v.forma_pagamento),v.parcelas,ps.label,money(Number(v.total))])})
  const visibleSellers=vendedores.filter(v=>{const summary=comissoes.find(c=>c.vendedor_id===v.id);return searchMatches('comissoes',[v.nome,v.email||'',v.telefone||'',v.percentual_comissao,money(Number(summary?.total_recebido||0)),money(Number(summary?.comissao_apurada||0)),summary?.pagamentos||0,summary?.vendas||0,v.ativo?'ativo':'inativo'])})

  function salePaymentStatus(venda:Venda){
    const related=titulos.filter(t=>t.venda_id===venda.id)
    if(venda.status==='cancelado'||(related.length>0&&related.every(t=>t.status==='cancelado'))){
      return {label:'Cancelado',key:'cancelado'}
    }
    if(!related.length)return {label:'Sem cobrança',key:'sem-cobranca'}

    const valid=related.filter(t=>t.status!=='cancelado')
    if(!valid.length)return {label:'Cancelado',key:'cancelado'}

    const total=valid.reduce((s,t)=>s+Number(t.valor),0)
    const paid=valid.reduce((s,t)=>s+Number(t.valor_pago),0)

    if(total>0&&paid>=total-0.005)return {label:'Pago',key:'pago'}
    if(paid>0)return {label:'Parcial',key:'parcial'}
    return {label:'Pendente',key:'pendente'}
  }

  function proofPanel(kind:'venda'|'compra',id:string){
    const list=proofsFor(kind,id)
    return <div className="proofPanel">
      <div className="proofHead">
        <div><strong>Comprovantes de pagamento</strong><span>{list.length?String(list.length)+' arquivo(s) anexado(s)':'Nenhum comprovante anexado'}</span></div>
        {!isViewer&&<label className="ghost proofUpload"><Paperclip size={15}/>Anexar comprovante<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={e=>void uploadProof(kind,id,e)}/></label>}
      </div>
      {list.length>0&&<div className="proofList">{list.map(p=><div className="proofItem" key={p.id}>
        <div><strong>{p.nome_arquivo}</strong><span>{dateBr(p.created_at)}{p.tamanho?' • '+(Number(p.tamanho)/1024).toFixed(0)+' KB':''}</span></div>
        <div className="rowActions">
          <button type="button" className="ghost" onClick={()=>void openProof(p)}><ExternalLink size={14}/>Abrir</button>
          {(isAdmin||profileRole==='financeiro')&&<button type="button" className="dangerAction" onClick={()=>void deleteProof(p)}><Trash2 size={14}/>Excluir</button>}
        </div>
      </div>)}</div>}
    </div>
  }

  function financeTable(type:'receber'|'pagar',overdueOnly=false){
    const searchKey=(overdueOnly?'financeiro-vencidos-':'financeiro-')+(type==='receber'?'receber':'pagar')
    const baseRows=titulos.filter(t=>t.tipo===type).filter(t=>!overdueOnly||(t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'&&Math.max(0,Number(t.valor)-Number(t.valor_pago))>0))
    const rows=baseRows.filter(t=>searchMatches(searchKey,[t.descricao,t.entidade_nome||'',dateBr(t.vencimento),money(Number(t.valor)),money(Number(t.valor_pago)),money(Math.max(0,Number(t.valor)-Number(t.valor_pago))),t.status,t.categoria||'',t.centro_custo||'',t.forma_pagamento||'',t.parcela_numero||'']))
    const groupTitle=overdueOnly?(type==='receber'?'Vencidos a receber':'Vencidos a pagar'):(type==='receber'?'Contas a receber':'Contas a pagar')
    const empty=overdueOnly?(type==='receber'?'Nenhuma conta a receber vencida.':'Nenhuma conta a pagar vencida.'):(type==='receber'?'Nenhuma conta a receber.':'Nenhuma conta a pagar.')
    return <article className={'panel tablePanel financeGroup '+(type==='receber'?'financeReceivableGroup':'financePayableGroup')}>
      <div className="panelHead"><div><h3>{groupTitle}</h3><p>{rows.length} lançamento(s)</p></div><SearchField value={tableSearch[searchKey]||''} onChange={v=>setSearch(searchKey,v)} placeholder="Pesquisar em todas as colunas"/></div>
      <div className="tableWrap"><table>
        <thead><tr><th>Descrição</th><th>Cliente / Fornecedor</th><th>Vencimento</th><th>Valor</th><th>{type==='receber'?'Recebido':'Pago'}</th><th>Saldo</th><th>Status</th><th>Gerenciar</th></tr></thead>
        <tbody>
          {rows.length===0&&<tr className="emptyTableRow"><td colSpan={8}><EmptyState message={empty} actionLabel={canManageFinance?'+ Adicionar Lançamento':undefined} onAction={startNewTitle}/></td></tr>}
          {rows.map(t=>{
            const opened=financePanel===t.id
            const balance=Math.max(0,Number(t.valor)-Number(t.valor_pago))
            return <Fragment key={t.id}>
              <tr className={t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'?'overdueRow':''}>
                <td>{t.descricao}</td>
                <td>{t.entidade_nome||'—'}</td>
                <td><span className={t.vencimento<today()&&t.status!=='pago'&&t.status!=='cancelado'?'overdueDate':''}>{dateBr(t.vencimento)}</span></td>
                <td><strong>{money(Number(t.valor))}</strong></td>
                <td>{money(Number(t.valor_pago))}</td>
                <td><strong>{money(balance)}</strong></td>
                <td><span className={'statusBadge status-'+(t.status==='pago'?'faturado':t.status==='cancelado'?'cancelado':'pedido')}>{t.status}</span></td>
                <td>{!canManageFinance?<span className="readOnlyTag">Somente leitura</span>:<button className="rowMenuBtn" onClick={()=>openFinancePanel(t)} title="Opções" aria-label="Abrir opções" aria-expanded={opened}><MoreVertical size={18}/></button>}</td>
              </tr>
              {canManageFinance&&opened&&<tr className="manageRow"><td colSpan={8}>
                <div className="financeManagePanel">
                  <div className="actionPanel">
                    <div className="actionMeta">
                      <strong>{t.descricao}</strong>
                      <span>{t.venda_id?'Ligado à venda • parcela '+(t.parcela_numero||1):t.compra_id?'Ligado à compra • parcela '+(t.parcela_numero||1):'Lançamento manual'} • saldo {money(balance)}</span>
                    </div>
                    <div className="rowActions">
                      <button className="ghost" onClick={()=>startEditTitle(t)}><Pencil size={15}/>Editar</button>
                      <button className="warningBtn" disabled={t.status==='cancelado'} onClick={()=>void cancelTitle(t)}><Ban size={15}/>Cancelar</button>
                      {isAdmin&&<button className="dangerAction" onClick={()=>void deleteTitle(t)}><Trash2 size={15}/>Excluir</button>}
                    </div>
                  </div>
                  {t.status!=='pago'&&t.status!=='cancelado'&&balance>0&&<div className="paymentEntry">
                    <div><strong>{type==='receber'?'Registrar recebimento':'Registrar pagamento'}</strong><span>A data informada será usada no histórico{type==='receber'?' e no período da comissão':''}.</span></div>
                    <label>Data<input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label>
                    <label>Valor<input type="number" min="0.01" step="0.01" max={balance} value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label>
                    <button className="primary" onClick={()=>void registerPayment(t)}><CheckCircle2 size={15}/>{type==='receber'?'Receber':'Pagar'}</button>
                  </div>}
                </div>
              </td></tr>}
            </Fragment>
          })}
        </tbody>
      </table></div>
    </article>
  }

  function headerAction(){
    if(active==='clientes')startNewClient()
    else if(active==='fornecedores')startNewSupplier()
    else if(active==='produtos')startNewProduct()
    else if(active==='compras')startNewPurchase()
    else if(active==='vendas')startNewSale()
    else if(active==='comissoes')startNewSeller()
    else if(active==='financeiro')startNewTitle()
  }

  return <div className={`${dark?'app dark':'app'}${sidebarCollapsed?' sidebarCollapsed':''}`}>
    <aside className="sidebar">
      <button className="sidebarToggle" onClick={()=>setSidebarCollapsed(v=>!v)} title={sidebarCollapsed?'Expandir menu':'Recolher menu'} aria-label={sidebarCollapsed?'Expandir menu lateral':'Recolher menu lateral'}>{sidebarCollapsed?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button>
      <div className="brand"><div className="brandMark">SG</div><div className="brandText"><strong>Sistema de Gestão</strong><span>ERP Empresarial</span></div></div>
      <nav>{menu.map(([k,l,I])=><button key={k} title={l} className={active===k?'navItem active':'navItem'} onClick={()=>{setActive(k as ModuleKey);closeForms();setMsg('')}}><I size={18}/><span>{l}</span></button>)}</nav>
      <div className="sidebarFooter"><span>{session.user.email}</span><small>{profileRole}</small><button className="navItem" title="Sair" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/><span>Sair</span></button></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><h1>{title}</h1><p>{empresa?.nome_fantasia||'Sistema de Gestão'} • ORGJSS1</p></div>
        <div className="topActions">
          <button className="iconBtn" onClick={()=>void loadData()} title="Atualizar"><RefreshCw size={18}/></button>
          <button className="iconBtn" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
          {!isViewer&&active!=='comissoes'&&['clientes','fornecedores','compras','vendas'].includes(active)&&<button className="primary" onClick={headerAction}><Plus size={17}/>Novo</button>}
          {!isViewer&&active==='produtos'&&productSubtab==='cadastro'&&<button className="primary" onClick={headerAction}><Plus size={17}/>Novo</button>}
          {canManageFinance&&active==='financeiro'&&<button className="primary" onClick={headerAction}><Plus size={17}/>Novo</button>}
          {isAdmin&&active==='comissoes'&&<button className="primary" onClick={headerAction}><UserPlus size={17}/>Novo vendedor</button>}
        </div>
      </header>

      {msg&&<div className="panel noticePanel">{msg}</div>}

      {active==='dashboard'&&<section>
        <div className="cards dashboardCards">
          <article className="card dashboardCard dashboardCardSales"><span>Vendas no mês</span><strong>{money(monthSales)}</strong><small>{vendas.filter(v=>v.status!=='cancelado').length} registros</small></article>
          <article className="card dashboardCard dashboardCardReceivable"><span>A receber</span><strong>{money(openReceivables)}</strong><small>em aberto</small></article>
          <article className="card dashboardCard dashboardCardPayable"><span>A pagar</span><strong>{money(openPayables)}</strong><small>em aberto</small></article>
          <article className="card dashboardCard dashboardCardLowStock"><span>Estoque baixo</span><strong>{low}</strong><small>de {produtos.filter(p=>p.ativo).length} produtos ativos</small></article>
        </div>
        <div className="cards compactCards dashboardCards">
          <article className="card dashboardCard"><span>Clientes</span><strong>{clientes.filter(c=>c.ativo).length}</strong><button className="ghost" onClick={()=>{setActive('clientes');if(clientes.length===0&&!isViewer)startNewClient()}}>{clientes.length===0&&!isViewer?'+ Adicionar Cliente':'Gerenciar'}</button></article>
          <article className="card dashboardCard"><span>Fornecedores</span><strong>{fornecedores.filter(f=>f.ativo).length}</strong><button className="ghost" onClick={()=>{setActive('fornecedores');if(fornecedores.length===0&&!isViewer)startNewSupplier()}}>{fornecedores.length===0&&!isViewer?'+ Adicionar Fornecedor':'Gerenciar'}</button></article>
          <article className="card dashboardCard dashboardCardStockValue"><span>Valor em estoque</span><strong>{money(stockValue)}</strong><button className="ghost" onClick={()=>{setActive('produtos');if(produtos.length===0&&!isViewer)startNewProduct()}}>{produtos.length===0&&!isViewer?'+ Adicionar Produto':'Gerenciar'}</button></article>
        </div>
      </section>}

      {active==='clientes'&&<section className="semanticPage clientsPage">
        {showForm&&<form className="panel dataForm" onSubmit={saveClient}><input name="nome" placeholder="Nome / Razão social" required defaultValue={editingClient?.nome||''}/><input name="documento" inputMode="numeric" placeholder="CPF / CNPJ" defaultValue={maskDocument(editingClient?.documento||'')} onInput={e=>{e.currentTarget.value=maskDocument(e.currentTarget.value)}}/><input name="email" type="email" placeholder="E-mail" defaultValue={editingClient?.email||''}/><input name="telefone" inputMode="tel" placeholder="Telefone" defaultValue={maskPhone(editingClient?.telefone||'')} onInput={e=>{e.currentTarget.value=maskPhone(e.currentTarget.value)}}/><input name="limite_credito" type="number" step="0.01" placeholder="Limite de crédito" defaultValue={editingClient?.limite_credito||0}/><select name="ativo" defaultValue={editingClient?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select><div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingClient(null)}}>Cancelar</button><button className="primary">Salvar</button></div></form>}
        <EditableEntityTable readOnly={isViewer} title="Clientes" emptyActionLabel="+ Adicionar Cliente" onEmptyAction={startNewClient} headers={['Nome','Documento','E-mail','Telefone','Limite','Status','Gerenciar']} rows={clientes.map(c=>({id:c.id,cells:[c.nome,c.documento||'—',c.email||'—',c.telefone||'—',money(Number(c.limite_credito)),c.ativo?'Ativo':'Inativo'],opened:clientPanel===c.id,onToggle:()=>setClientPanel(clientPanel===c.id?null:c.id),panel:<div className="rowActions"><button className="ghost" onClick={()=>startEditClient(c)}><Pencil size={15}/>Editar</button>{isAdmin&&<button className="dangerAction" onClick={()=>void deleteClient(c)}><Trash2 size={15}/>Excluir</button>}</div>}))}/>
      </section>}

      {active==='fornecedores'&&<section className="semanticPage suppliersPage">
        {showForm&&<form className="panel dataForm" onSubmit={saveSupplier}><input name="nome" placeholder="Nome / Razão social" required defaultValue={editingSupplier?.nome||''}/><input name="documento" inputMode="numeric" placeholder="CNPJ / CPF" defaultValue={maskDocument(editingSupplier?.documento||'')} onInput={e=>{e.currentTarget.value=maskDocument(e.currentTarget.value)}}/><input name="email" type="email" placeholder="E-mail" defaultValue={editingSupplier?.email||''}/><input name="telefone" inputMode="tel" placeholder="Telefone" defaultValue={maskPhone(editingSupplier?.telefone||'')} onInput={e=>{e.currentTarget.value=maskPhone(e.currentTarget.value)}}/><select name="ativo" defaultValue={editingSupplier?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select><div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingSupplier(null)}}>Cancelar</button><button className="primary">Salvar</button></div></form>}
        <EditableEntityTable readOnly={isViewer} title="Fornecedores" emptyActionLabel="+ Adicionar Fornecedor" onEmptyAction={startNewSupplier} headers={['Nome','Documento','E-mail','Telefone','Status','Gerenciar']} rows={fornecedores.map(f=>({id:f.id,cells:[f.nome,f.documento||'—',f.email||'—',f.telefone||'—',f.ativo?'Ativo':'Inativo'],opened:supplierPanel===f.id,onToggle:()=>setSupplierPanel(supplierPanel===f.id?null:f.id),panel:<div className="rowActions"><button className="ghost" onClick={()=>startEditSupplier(f)}><Pencil size={15}/>Editar</button>{isAdmin&&<button className="dangerAction" onClick={()=>void deleteSupplier(f)}><Trash2 size={15}/>Excluir</button>}</div>}))}/>
      </section>}

      {active==='produtos'&&<section className="semanticPage productsPage">
        <div className="subTabs">
          <button className={productSubtab==='cadastro'?'subTab active':'subTab'} onClick={()=>{setProductSubtab('cadastro');setMsg('')}}><Package size={16}/>Cadastro / Estoque</button>
          <button className={productSubtab==='movimentos'?'subTab active':'subTab'} onClick={()=>{setProductSubtab('movimentos');setShowForm(false);setAdjustingProduct(null);setMsg('')}}><Boxes size={16}/>Entradas e saídas</button>
        </div>

        {productSubtab==='cadastro'&&<>
          <div className="cards compactCards semanticCards">
            <article className="card semanticCard semanticBlue"><span>Produtos ativos</span><strong>{produtos.filter(p=>p.ativo).length}</strong></article>
            <article className="card semanticCard semanticWarning"><span>Estoque baixo</span><strong>{low}</strong></article>
            <article className="card semanticCard semanticBlue"><span>Valor de custo</span><strong>{money(stockValue)}</strong></article>
          </div>

          <div className="inventoryTopActions">
            <button type="button" className="ghost excelSecondaryBtn" onClick={()=>setExcelToolsOpen(v=>!v)} aria-expanded={excelToolsOpen}>
              <FileSpreadsheet size={16}/>Excel
            </button>
          </div>

          {excelToolsOpen&&<div className="panel excelToolsPanel">
            <div className="excelPanelText">
              <div className="excelIcon"><FileSpreadsheet size={20}/></div>
              <div><strong>Importação e exportação Excel</strong><span>Use o modelo para cadastrar produtos ou ajustar o estoque pelo código do item.</span></div>
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
          </div>}

          {showForm&&<form className="panel dataForm" onSubmit={saveProduct}>
            <input name="codigo" placeholder="Código" required defaultValue={editingProduct?.codigo||''}/>
            <input name="descricao" placeholder="Descrição" required defaultValue={editingProduct?.descricao||''}/>
            <input name="unidade" defaultValue={editingProduct?.unidade||'UN'}/>
            <input name="custo" type="number" step="0.01" placeholder="Custo" defaultValue={editingProduct?.custo||0}/>
            <input name="preco_venda" type="number" step="0.01" placeholder="Preço de venda" defaultValue={editingProduct?.preco_venda||0}/>
            {!editingProduct&&<input name="estoque_atual" type="number" step="0.001" placeholder="Estoque inicial" defaultValue={0}/>}
            <input name="estoque_minimo" type="number" step="0.001" placeholder="Estoque mínimo" defaultValue={editingProduct?.estoque_minimo||0}/>
            <select name="ativo" defaultValue={editingProduct?.ativo===false?'false':'true'}><option value="true">Ativo</option><option value="false">Inativo</option></select>
            <div className="formActions"><button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingProduct(null)}}>Cancelar</button><button className="primary">Salvar</button></div>
          </form>}

          {adjustingProduct&&<form className="panel stockForm" onSubmit={adjustStock}>
            <div><strong>Ajustar estoque</strong><span>{adjustingProduct.codigo} - {adjustingProduct.descricao}</span></div>
            <label>Novo estoque<input type="number" min="0" step="0.001" value={stockNew} onChange={e=>setStockNew(e.target.value)} required/></label>
            <label>Motivo<input value={stockReason} onChange={e=>setStockReason(e.target.value)} required/></label>
            <div className="formActions"><button type="button" className="ghost" onClick={()=>setAdjustingProduct(null)}>Cancelar</button><button className="primary">Aplicar</button></div>
          </form>}

          <ProductTable produtos={produtos} onCreate={startNewProduct} openId={productPanel} onToggle={id=>setProductPanel(productPanel===id?null:id)} onEdit={startEditProduct} onAdjust={startAdjustStock} onDelete={deleteProduct} canDelete={isAdmin} readOnly={isViewer}/>
        </>}

        {productSubtab==='movimentos'&&<>
          <div className="cards compactCards semanticCards">
            <article className="card semanticCard semanticPositive"><span>Entradas registradas</span><strong>{movimentosEstoque.filter(m=>m.tipo==='entrada').length}</strong><small>{movimentosEstoque.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+Math.abs(Number(m.quantidade)),0).toLocaleString('pt-BR')} unidades</small></article>
            <article className="card semanticCard semanticNegative"><span>Saídas registradas</span><strong>{movimentosEstoque.filter(m=>m.tipo==='saida').length}</strong><small>{movimentosEstoque.filter(m=>m.tipo==='saida').reduce((s,m)=>s+Math.abs(Number(m.quantidade)),0).toLocaleString('pt-BR')} unidades</small></article>
            <article className="card semanticCard semanticWarning"><span>Ajustes</span><strong>{movimentosEstoque.filter(m=>m.tipo==='ajuste').length}</strong><small>alterações manuais/importação</small></article>
          </div>

          <article className="panel tablePanel">
            <div className="panelHead">
              <div><h3>Relatório de entradas e saídas</h3><p>{movimentosEstoque.length} movimentação(ões) carregada(s)</p></div>
              <SearchField value={tableSearch['movimentos-estoque']||''} onChange={v=>setSearch('movimentos-estoque',v)} placeholder="Pesquisar data, produto, tipo, quantidade ou referência"/>
            </div>
            <div className="tableWrap"><table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Código</th><th>Produto</th><th>Quantidade</th><th>Referência / Motivo</th></tr></thead>
              <tbody>{movimentosEstoque.filter(m=>{
                const p=produtos.find(x=>x.id===m.produto_id)
                const tipo=m.tipo==='entrada'?'Entrada':m.tipo==='saida'?'Saída':Number(m.quantidade)>=0?'Ajuste entrada':'Ajuste saída'
                return searchMatches('movimentos-estoque',[new Date(m.created_at).toLocaleString('pt-BR'),tipo,p?.codigo||'',p?.descricao||'',Number(m.quantidade).toLocaleString('pt-BR'),m.referencia||''])
              }).map(m=>{
                const p=produtos.find(x=>x.id===m.produto_id)
                const isEntry=m.tipo==='entrada'||(m.tipo==='ajuste'&&Number(m.quantidade)>=0)
                const label=m.tipo==='entrada'?'Entrada':m.tipo==='saida'?'Saída':isEntry?'Ajuste entrada':'Ajuste saída'
                return <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                  <td><span className={isEntry?'movementBadge movement-in':'movementBadge movement-out'}>{label}</span></td>
                  <td><strong>{p?.codigo||'—'}</strong></td>
                  <td>{p?.descricao||'Produto não encontrado'}</td>
                  <td><strong>{Math.abs(Number(m.quantidade)).toLocaleString('pt-BR')} {p?.unidade||''}</strong></td>
                  <td>{m.referencia||'—'}</td>
                </tr>
              })}</tbody>
            </table></div>
          </article>
        </>}
      </section>}

      {active==='compras'&&<section className="semanticPage purchasesPage">
        {showForm&&<form className="panel saleForm purchaseForm" onSubmit={savePurchase}>
          <div className="formTitle">
            <div>
              <h3>{editingPurchase?`Editar fatura de compra ${invoiceNo(editingPurchase.fatura_numero)}`:'Nova compra / conta a pagar'}</h3>
              <p>Forma de pagamento e vencimento são obrigatórios. Compras recebidas entram automaticamente no estoque.</p>
            </div>
          </div>

          <div className="saleHeader saleHeaderExpanded">
            <label>Fornecedor
              <select value={purchaseSupplier} onChange={e=>setPurchaseSupplier(e.target.value)}>
                <option value="">Sem fornecedor</option>
                {fornecedores.filter(f=>f.ativo).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </label>
            <label>Status
              <select value={purchaseStatus} onChange={e=>setPurchaseStatus(e.target.value)}>
                <option value="aberta">Aberta</option>
                <option value="recebida">Recebida</option>
              </select>
            </label>
            <label>Pagamento
              <select value={purchasePayment} onChange={e=>changePurchasePayment(e.target.value as PurchasePaymentMethod)} required>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
              </select>
            </label>
            <label>Parcelas
              <select value={purchaseInstallments} onChange={e=>resizePurchaseDates(Number(e.target.value))} disabled={purchasePayment==='pix'}>
                {Array.from({length:purchasePayment==='pix'?1:purchasePayment==='cartao'?12:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x</option>)}
              </select>
            </label>
            <label className="saleNotes">Observações
              <input value={purchaseNotes} onChange={e=>setPurchaseNotes(e.target.value)}/>
            </label>
          </div>

          <div className="paymentNotice purchasePaymentNotice">
            <strong>Fatura de compra a pagar</strong>
            <span>{paymentLabel(purchasePayment)} • {purchaseInstallments}x • vencimentos personalizados</span>
          </div>

          <div className="panel installmentDatesPanel">
            <div className="installmentDatesHead">
              <div><strong>Datas de vencimento das parcelas</strong><span>Edite cada parcela individualmente.</span></div>
            </div>
            <div className="installmentDatesGrid">
              {purchaseInstallmentDates.map((due,index)=><label key={index}>
                <span>Parcela {index+1}/{purchaseInstallments}</span>
                <input type="date" value={due} onChange={e=>changePurchaseInstallmentDate(index,e.target.value)} required/>
                <small>{money(purchaseInstallments?Math.floor((purchaseTotal/purchaseInstallments)*100)/100:0)}{index===purchaseInstallments-1?' • ajuste final':''}</small>
              </label>)}
            </div>
          </div>

          <div className="saleItemsHead">
            <h3>Itens da compra</h3>
            <button type="button" className="ghost" onClick={()=>setPurchaseItems(x=>[...x,newPurchaseItem()])}><Plus size={16}/>Adicionar item</button>
          </div>

          <div className="saleItems">
            {purchaseItems.map(i=><div className="purchaseItemRow" key={i.key}>
              <select value={i.produto_id} onChange={e=>choosePurchaseProduct(i.key,e.target.value)} required>
                <option value="">Produto</option>
                {produtos.filter(p=>p.ativo||p.id===i.produto_id).map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
              </select>
              <input type="number" min="0.001" step="0.001" value={i.quantidade} onChange={e=>updatePurchaseItem(i.key,'quantidade',Number(e.target.value))}/>
              <input type="number" min="0" step="0.01" value={i.custo_unitario} onChange={e=>updatePurchaseItem(i.key,'custo_unitario',Number(e.target.value))}/>
              <strong>{money(i.quantidade*i.custo_unitario)}</strong>
              <button type="button" className="iconBtn dangerBtn" onClick={()=>removePurchaseItem(i.key)}><Trash2 size={16}/></button>
            </div>)}
          </div>

          {saleConsumesStock&&saleStockShortages.length>0&&<div className="stockAuthorizationWarning">
            <strong>Estoque insuficiente em {saleStockShortages.length} produto(s)</strong>
            <span>{isAdmin?'Você é administrador. Ao salvar, será solicitada uma confirmação extra para autorizar estoque negativo.':'A venda não pode ser concluída por este usuário. Solicite autorização de um administrador.'}</span>
          </div>}

          <div className="saleTotals">
            <div className="grandTotal"><span>Total a pagar</span><strong>{money(purchaseTotal)}</strong></div>
          </div>

          <div className="saleActions">
            <button type="button" className="ghost" onClick={()=>{setShowForm(false);resetPurchaseForm()}}>Cancelar</button>
            <button className="primary" disabled={savingPurchase}>{savingPurchase?'Salvando...':editingPurchase?'Salvar e recalcular contas a pagar':'Salvar compra e gerar fatura'}</button>
          </div>
        </form>}

        <article className="panel tablePanel purchasesTable">
          <div className="panelHead"><h3>Compras e contas a pagar</h3><SearchField value={tableSearch.compras||''} onChange={v=>setSearch('compras',v)} placeholder="Pesquisar em todas as colunas"/></div>
          <div className="tableWrap"><table>
            <thead><tr><th>Fatura</th><th>Data</th><th>Fornecedor</th><th>Status</th><th>Pagamento</th><th>Total</th><th>Gerenciar</th></tr></thead>
            <tbody>{visiblePurchases.length===0&&<tr className="emptyTableRow"><td colSpan={7}><EmptyState message={compras.length===0?'Nenhuma compra cadastrada.':'Nenhuma compra encontrada para esta pesquisa.'} actionLabel={compras.length===0&&!isViewer?'+ Adicionar Compra':undefined} onAction={startNewPurchase}/></td></tr>}{visiblePurchases.map(c=>{
              const f=fornecedores.find(x=>x.id===c.fornecedor_id)
              const opened=purchasePanel===c.id
              return <Fragment key={c.id}>
                <tr>
                  <td><strong>#{invoiceNo(c.fatura_numero)}</strong></td>
                  <td>{new Date(c.created_at).toLocaleString('pt-BR')}</td>
                  <td>{f?.nome||'Sem fornecedor'}</td>
                  <td><span className={`statusBadge status-${c.status==='recebida'?'faturado':c.status==='cancelada'?'cancelado':'pedido'}`}>{c.status}</span></td>
                  <td>{paymentLabel(c.forma_pagamento)} {Number(c.parcelas)>1?`• ${c.parcelas}x`:''}</td>
                  <td><strong>{money(Number(c.total))}</strong></td>
                  <td><button className="rowMenuBtn" onClick={()=>setPurchasePanel(opened?null:c.id)} title="Opções" aria-label="Abrir opções da compra" aria-expanded={opened}><MoreVertical size={18}/></button></td>
                </tr>
                {opened&&<tr className="manageRow"><td colSpan={7}>
                  <div className="invoiceManagePanel">
                    <div className="actionPanel">
                      <div className="actionMeta">
                        <strong>Fatura de compra #{invoiceNo(c.fatura_numero)}</strong>
                        <span>{f?.nome||'Sem fornecedor'} • {paymentLabel(c.forma_pagamento)} • {c.parcelas}x • vencimentos individuais</span>
                      </div>
                      <div className="rowActions">
                        <button className="ghost" onClick={()=>void downloadPurchasePdf(c)}><FileDown size={15}/>PDF</button>
                        {!isViewer&&<button className="ghost" disabled={c.status==='cancelada'} onClick={()=>void startEditPurchase(c)}><Pencil size={15}/>Editar</button>}
                        {!isViewer&&<button className="warningBtn" disabled={c.status==='cancelada'} onClick={()=>void cancelPurchase(c)}><Ban size={15}/>Cancelar</button>}
                        {isAdmin&&<button className="dangerAction" onClick={()=>void deletePurchase(c)}><Trash2 size={15}/>Excluir</button>}
                      </div>
                    </div>
                    {proofPanel('compra',c.id)}
                  </div>
                </td></tr>}
              </Fragment>
            })}</tbody>
          </table></div>
        </article>
      </section>}

      {active==='vendas'&&<section className="semanticPage salesPage">
        {showForm&&<form className="panel saleForm salesForm" onSubmit={saveSale}>
          <div className="formTitle">
            <div>
              <h3>{editingSale?'Editar fatura '+invoiceNo(editingSale.fatura_numero):'Nova venda / fatura'}</h3>
              <p>Pagamento e fatura são obrigatórios. O vendedor define quem recebe a comissão quando houver recebimento.</p>
            </div>
          </div>

          <div className="saleHeader saleHeaderExpanded">
            <label>Cliente
              <select value={saleClient} onChange={e=>setSaleClient(e.target.value)}>
                <option value="">Consumidor</option>
                {clientes.filter(c=>c.ativo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label>Vendedor
              <select value={saleSeller} onChange={e=>setSaleSeller(e.target.value)}>
                <option value="">Sem vendedor / sem comissão</option>
                {vendedores.filter(v=>v.ativo||v.id===saleSeller).map(v=><option key={v.id} value={v.id}>{v.nome} — {Number(v.percentual_comissao).toLocaleString('pt-BR')}%</option>)}
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
              <select value={salePayment} onChange={e=>changePayment(e.target.value as PaymentMethod)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
              </select>
            </label>
            <label>Parcelas
              <select value={saleInstallments} onChange={e=>setSaleInstallments(Number(e.target.value))} disabled={salePayment==='pix'||salePayment==='dinheiro'}>
                {Array.from({length:salePayment==='pix'||salePayment==='dinheiro'?1:salePayment==='cartao'?12:24},(_,i)=>i+1).map(n=><option key={n}>{n}</option>)}
              </select>
            </label>
            <label>1º vencimento
              <input type="date" value={saleDueDate} onChange={e=>setSaleDueDate(e.target.value)} required/>
            </label>
            <label className="saleNotes">Observações
              <input value={saleNotes} onChange={e=>setSaleNotes(e.target.value)}/>
            </label>
          </div>

          <div className="paymentNotice">
            <strong>Fatura obrigatória</strong>
            <span>{paymentLabel(salePayment)} • {saleInstallments}x • vencimento {dateBr(saleDueDate)}{saleSeller?' • comissão: '+String(vendedores.find(v=>v.id===saleSeller)?.percentual_comissao||0)+'%':''}</span>
          </div>

          <div className="saleItemsHead">
            <h3>Itens</h3>
            <button type="button" className="ghost" onClick={()=>setSaleItems(x=>[...x,newSaleItem()])}><Plus size={16}/>Adicionar item</button>
          </div>

          <div className="saleItems">
            {saleItems.map(i=>{const stock=saleItemStockInfo(i);return <div className="saleItemRow" key={i.key}>
              <select value={i.produto_id} onChange={e=>chooseProduct(i.key,e.target.value)} required>
                <option value="">Produto</option>
                {produtos.filter(p=>p.ativo||p.id===i.produto_id).map(p=><option key={p.id} value={p.id}>{p.codigo} — {p.descricao} — estoque {Number(p.estoque_atual).toLocaleString('pt-BR')}</option>)}
              </select>
              <input type="number" min="0.001" step="0.001" value={i.quantidade} onChange={e=>updateSaleItem(i.key,'quantidade',Number(e.target.value))}/>
              <input type="number" min="0" step="0.01" value={i.valor_unitario} onChange={e=>updateSaleItem(i.key,'valor_unitario',Number(e.target.value))}/>
              <input type="number" min="0" step="0.01" value={i.desconto} onChange={e=>updateSaleItem(i.key,'desconto',Number(e.target.value))}/>
              <strong>{money(Math.max(0,i.quantidade*i.valor_unitario-i.desconto))}</strong>
              <button type="button" className="iconBtn dangerBtn" onClick={()=>removeSaleItem(i.key)}><Trash2 size={16}/></button>
              {stock&&<div className={'saleStockHint stock-'+stock.kind}><span>{stock.label}</span><small>{stock.detail}</small>{saleConsumesStock&&stock.kind!=='ok'&&<b>{isAdmin?'Exige autorização administrativa para concluir.':'Venda bloqueada: solicite autorização de um administrador.'}</b>}</div>}
            </div>})}
          </div>

          <div className="saleTotals">
            <div><span>Subtotal</span><strong>{money(saleSubtotal)}</strong></div>
            <div><span>Desconto</span><strong>{money(saleDiscount)}</strong></div>
            <div className="grandTotal"><span>Total</span><strong>{money(saleTotal)}</strong></div>
          </div>

          <div className="saleActions">
            <button type="button" className="ghost" onClick={()=>{setShowForm(false);resetSaleForm()}}>Cancelar</button>
            <button className="primary" disabled={savingSale}>{savingSale?'Salvando...':editingSale?'Salvar e reemitir':'Salvar e emitir fatura'}</button>
          </div>
        </form>}

        <article className="panel tablePanel salesTable">
          <div className="panelHead"><h3>Vendas e faturas</h3><SearchField value={tableSearch.vendas||''} onChange={v=>setSearch('vendas',v)} placeholder="Pesquisar em todas as colunas"/></div>
          <div className="tableWrap"><table>
            <thead><tr><th>Fatura</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Status</th><th>Pagamento</th><th>Status pagamento</th><th>Total</th><th>Gerenciar</th></tr></thead>
            <tbody>{visibleSales.length===0&&<tr className="emptyTableRow"><td colSpan={9}><EmptyState message={vendas.length===0?'Nenhuma venda cadastrada.':'Nenhuma venda encontrada para esta pesquisa.'} actionLabel={vendas.length===0&&!isViewer?'+ Adicionar Venda':undefined} onAction={startNewSale}/></td></tr>}{visibleSales.map(v=>{
              const client=clientes.find(x=>x.id===v.cliente_id)
              const seller=vendedores.find(x=>x.id===v.vendedor_cadastro_id)
              const opened=salePanel===v.id
              const paymentStatus=salePaymentStatus(v)
              return <Fragment key={v.id}>
                <tr>
                  <td><strong>#{invoiceNo(v.fatura_numero)}</strong></td>
                  <td>{new Date(v.created_at).toLocaleString('pt-BR')}</td>
                  <td>{client?.nome||'Consumidor'}</td>
                  <td>{seller?.nome||'—'}</td>
                  <td><span className={'statusBadge status-'+v.status}>{v.status}</span></td>
                  <td>{paymentLabel(v.forma_pagamento)} {Number(v.parcelas)>1?'• '+v.parcelas+'x':''}</td>
                  <td><span className={'statusBadge payment-'+paymentStatus.key}>{paymentStatus.label}</span></td>
                  <td><strong>{money(Number(v.total))}</strong></td>
                  <td><button className="rowMenuBtn" onClick={()=>setSalePanel(opened?null:v.id)} title="Opções" aria-label="Abrir opções da venda" aria-expanded={opened}><MoreVertical size={18}/></button></td>
                </tr>
                {opened&&<tr className="manageRow"><td colSpan={9}>
                  <div className="invoiceManagePanel">
                    <div className="actionPanel">
                      <div className="actionMeta">
                        <strong>Fatura #{invoiceNo(v.fatura_numero)}</strong>
                        <span>{seller?seller.nome+' • comissão '+Number(seller.percentual_comissao).toLocaleString('pt-BR')+'% • ':''}{paymentLabel(v.forma_pagamento)} • {v.parcelas}x • {dateBr(v.primeiro_vencimento)} • pagamento: {paymentStatus.label}</span>
                      </div>
                      <div className="rowActions">
                        <button className="ghost" onClick={()=>void downloadSalePdf(v)}><FileDown size={15}/>PDF</button>
                        {!isViewer&&<button className="ghost" disabled={v.status==='cancelado'} onClick={()=>void startEditSale(v)}><Pencil size={15}/>Editar</button>}
                        {!isViewer&&<button className="warningBtn" disabled={v.status==='cancelado'} onClick={()=>void cancelSale(v)}><Ban size={15}/>Cancelar</button>}
                        {isAdmin&&<button className="dangerAction" onClick={()=>void deleteSale(v)}><Trash2 size={15}/>Excluir</button>}
                      </div>
                    </div>
                    {proofPanel('venda',v.id)}
                  </div>
                </td></tr>}
              </Fragment>
            })}</tbody>
          </table></div>
        </article>
      </section>}

      {active==='comissoes'&&<section className="semanticPage commissionsPage">
        {showForm&&<form className="panel sellerForm" onSubmit={saveSeller}>
          <div className="formTitle">
            <div><h3>{editingSeller?'Editar vendedor':'Novo vendedor'}</h3><p>O percentual é aplicado aos recebimentos registrados a partir daquele momento.</p></div>
          </div>
          <input name="nome" placeholder="Nome do vendedor" required defaultValue={editingSeller?.nome||''}/>
          <input name="email" type="email" placeholder="E-mail" defaultValue={editingSeller?.email||''}/>
          <input name="telefone" inputMode="tel" placeholder="Telefone" defaultValue={maskPhone(editingSeller?.telefone||'')} onInput={e=>{e.currentTarget.value=maskPhone(e.currentTarget.value)}}/>
          <label>Comissão %
            <input name="percentual_comissao" type="number" min="0" max="100" step="0.01" required defaultValue={editingSeller?.percentual_comissao||0}/>
          </label>
          <select name="ativo" defaultValue={editingSeller?.ativo===false?'false':'true'}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          <div className="formActions">
            <button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingSeller(null)}}>Cancelar</button>
            <button className="primary" disabled={!isAdmin}>Salvar vendedor</button>
          </div>
        </form>}

        <div className="panel commissionFilters">
          <div><strong>Período de recebimentos</strong><span>A comissão considera somente valores efetivamente recebidos entre as datas abaixo.</span></div>
          <label>De<input type="date" value={commissionStart} onChange={e=>setCommissionStart(e.target.value)}/></label>
          <label>Até<input type="date" value={commissionEnd} onChange={e=>setCommissionEnd(e.target.value)}/></label>
          <label>Relatório de
            <select value={commissionReportSeller} onChange={e=>setCommissionReportSeller(e.target.value)}>
              <option value="todos">Todos os vendedores</option>
              {vendedores.map(v=><option key={v.id} value={v.id}>{v.nome}{v.ativo?'':' (inativo)'}</option>)}
            </select>
          </label>
          <button className="ghost" onClick={()=>void loadCommissions()}><RefreshCw size={15}/>Atualizar</button>
          <button className="primary commissionPdfBtn" onClick={()=>void downloadCommissionReport()} title="Gerar relatório de comissões em PDF"><FileDown size={15}/>Gerar PDF</button>
        </div>

        {salesWithoutSeller>0&&<div className="commissionWarning">{salesWithoutSeller} venda(s) estão sem vendedor definido e não gerarão comissão até serem vinculadas a um vendedor.</div>}

        <div className="cards compactCards semanticCards">
          <article className="card semanticCard semanticPositive"><span>Recebido no período</span><strong>{money(commissionReceived)}</strong><small>{dateBr(commissionStart)} a {dateBr(commissionEnd)}</small></article>
          <article className="card semanticCard semanticBlue"><span>Comissões apuradas</span><strong>{money(commissionTotal)}</strong><small>sobre recebimentos</small></article>
          <article className="card semanticCard semanticNeutral"><span>Vendedores ativos</span><strong>{vendedores.filter(v=>v.ativo).length}</strong><small>{salesWithoutSeller} venda(s) sem vendedor</small></article>
        </div>

        <article className="panel tablePanel commissionsTable">
          <div className="panelHead"><h3>Vendedores e comissões</h3><SearchField value={tableSearch.comissoes||''} onChange={v=>setSearch('comissoes',v)} placeholder="Pesquisar vendedores e valores"/></div>
          <div className="tableWrap"><table>
            <thead><tr><th>Vendedor</th><th>% atual</th><th>Recebido no período</th><th>Comissão apurada</th><th>Recebimentos</th><th>Vendas</th><th>Status</th><th>Gerenciar</th></tr></thead>
            <tbody>{visibleSellers.length===0&&<tr className="emptyTableRow"><td colSpan={8}><EmptyState message={vendedores.length===0?'Nenhum vendedor cadastrado.':'Nenhum vendedor encontrado para esta pesquisa.'} actionLabel={vendedores.length===0&&isAdmin?'+ Adicionar Vendedor':undefined} onAction={startNewSeller}/></td></tr>}{visibleSellers.map(v=>{
              const summary=comissoes.find(c=>c.vendedor_id===v.id)
              const opened=sellerPanel===v.id
              return <Fragment key={v.id}>
                <tr>
                  <td><strong>{v.nome}</strong><br/><small>{v.email||v.telefone||'—'}</small></td>
                  <td>{Number(v.percentual_comissao).toLocaleString('pt-BR')}%</td>
                  <td>{money(Number(summary?.total_recebido||0))}</td>
                  <td><strong>{money(Number(summary?.comissao_apurada||0))}</strong></td>
                  <td>{summary?.pagamentos||0}</td>
                  <td>{summary?.vendas||0}</td>
                  <td><span className={v.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{v.ativo?'ativo':'inativo'}</span></td>
                  <td>{isAdmin?<button className="rowMenuBtn" onClick={()=>setSellerPanel(opened?null:v.id)} title="Opções" aria-label="Abrir opções do vendedor" aria-expanded={opened}><MoreVertical size={18}/></button>:<span className="readOnlyTag">Somente leitura</span>}</td>
                </tr>
                {isAdmin&&opened&&<tr className="manageRow"><td colSpan={8}>
                  <div className="actionPanel">
                    <div className="actionMeta"><strong>{v.nome}</strong><span>Comissão atual: {Number(v.percentual_comissao).toLocaleString('pt-BR')}%</span></div>
                    <div className="rowActions">
                      <button className="ghost" onClick={()=>startEditSeller(v)}><Pencil size={15}/>Editar % / dados</button>
                      {v.ativo&&<button className="warningBtn" onClick={()=>void deactivateSeller(v)}><Ban size={15}/>Desativar</button>}
                    </div>
                  </div>
                </td></tr>}
              </Fragment>
            })}</tbody>
          </table></div>
        </article>
      </section>}

      {active==='financeiro'&&<section className="semanticPage financePage">
        <div className="subTabs financeSubTabs">
          <button className={financeSubtab==='geral'?'subTab active':'subTab'} onClick={()=>{setFinanceSubtab('geral');setFinancePanel(null)}}><WalletCards size={16}/>Visão geral</button>
          <button className={financeSubtab==='vencidos'?'subTab active overdueTab':'subTab overdueTab'} onClick={()=>{setFinanceSubtab('vencidos');setFinancePanel(null);setShowForm(false);setEditingTitle(null)}}><Ban size={16}/>Vencidos <span className="subTabCount">{overdueTitles.length}</span></button>
        </div>

        {financeSubtab==='geral'&&<>
          {showForm&&<form className="panel dataForm" onSubmit={saveTitle}>
            <select name="tipo" defaultValue={editingTitle?.tipo||'receber'}>
              <option value="receber">Conta a receber</option>
              <option value="pagar">Conta a pagar</option>
            </select>
            <input name="descricao" placeholder="Descrição" required defaultValue={editingTitle?.descricao||''}/>
            <input name="entidade_nome" placeholder="Cliente / Fornecedor" defaultValue={editingTitle?.entidade_nome||''}/>
            <input name="vencimento" type="date" required defaultValue={editingTitle?.vencimento||today()}/>
            <input name="valor" type="number" min="0" step="0.01" required defaultValue={editingTitle?.valor||0}/>
            <input name="categoria" placeholder="Categoria" defaultValue={editingTitle?.categoria||''}/>
            <input name="centro_custo" placeholder="Centro de custo" defaultValue={editingTitle?.centro_custo||''}/>
            <div className="formActions">
              <button type="button" className="ghost" onClick={()=>{setShowForm(false);setEditingTitle(null)}}>Cancelar</button>
              <button className="primary">Salvar</button>
            </div>
          </form>}

          <div className="cards compactCards semanticCards">
            <article className="card semanticCard semanticPositive"><span>Contas a receber</span><strong>{money(openReceivables)}</strong><small>saldo em aberto</small></article>
            <article className="card semanticCard semanticNegative"><span>Contas a pagar</span><strong>{money(openPayables)}</strong><small>saldo em aberto</small></article>
            <article className={'card semanticCard '+(openReceivables-openPayables>=0?'semanticBlue':'semanticNegative')}><span>Saldo projetado</span><strong>{money(openReceivables-openPayables)}</strong><small>receber - pagar</small></article>
          </div>

          <div className="financeGroups">
            {financeTable('receber')}
            {financeTable('pagar')}
          </div>
        </>}

        {financeSubtab==='vencidos'&&<>
          <div className="cards compactCards semanticCards overdueCards">
            <article className="card semanticCard semanticNegative"><span>Vencidos a receber</span><strong>{money(overdueReceivables)}</strong><small>{overdueTitles.filter(t=>t.tipo==='receber').length} título(s)</small></article>
            <article className="card semanticCard semanticNegative"><span>Vencidos a pagar</span><strong>{money(overduePayables)}</strong><small>{overdueTitles.filter(t=>t.tipo==='pagar').length} título(s)</small></article>
            <article className="card semanticCard semanticWarning"><span>Total vencido</span><strong>{money(overdueReceivables+overduePayables)}</strong><small>{overdueTitles.length} título(s) em atraso</small></article>
          </div>

          <div className="financeGroups">
            {financeTable('receber',true)}
            {financeTable('pagar',true)}
          </div>
        </>}
      </section>}

      {active==='relatorios'&&<section className="semanticPage reportsPage">
        <div className="panel reportFilters"><label>De<input type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/></label><label>Até<input type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/></label><label>Status da venda<select value={reportStatus} onChange={e=>setReportStatus(e.target.value)}><option value="todos">Todos</option><option value="orcamento">Orçamento</option><option value="pedido">Pedido</option><option value="faturado">Faturado</option><option value="cancelado">Cancelado</option></select></label></div>
        <div className="cards compactCards semanticCards"><article className="card semanticCard semanticBlue"><span>Vendas no período</span><strong>{money(reportSalesTotal)}</strong><small>{filteredSales.length} registros</small></article><article className="card semanticCard semanticNegative"><span>Compras no período</span><strong>{money(reportPurchaseTotal)}</strong><small>{filteredPurchases.length} registros</small></article><article className={'card semanticCard '+(reportSalesTotal-reportPurchaseTotal>=0?'semanticPositive':'semanticNegative')}><span>Resultado bruto</span><strong>{money(reportSalesTotal-reportPurchaseTotal)}</strong><small>vendas - compras</small></article></div>
        <div className="reportsStack"><article className="panel tablePanel"><div className="panelHead"><h3>Vendas filtradas</h3><SearchField value={tableSearch['relatorio-vendas']||''} onChange={v=>setSearch('relatorio-vendas',v)} placeholder="Pesquisar"/></div><div className="tableWrap"><table><thead><tr><th>Fatura</th><th>Data</th><th>Status</th><th>Total</th></tr></thead><tbody>{filteredSales.filter(v=>searchMatches('relatorio-vendas',[invoiceNo(v.fatura_numero),dateBr(v.created_at),v.status,money(Number(v.total))])).map(v=><tr key={v.id}><td>#{invoiceNo(v.fatura_numero)}</td><td>{dateBr(v.created_at)}</td><td>{v.status}</td><td>{money(Number(v.total))}</td></tr>)}</tbody></table></div></article><article className="panel tablePanel"><div className="panelHead"><h3>Compras filtradas</h3><SearchField value={tableSearch['relatorio-compras']||''} onChange={v=>setSearch('relatorio-compras',v)} placeholder="Pesquisar"/></div><div className="tableWrap"><table><thead><tr><th>Data</th><th>Status</th><th>Total</th></tr></thead><tbody>{filteredPurchases.filter(c=>searchMatches('relatorio-compras',[dateBr(c.created_at),c.status,money(Number(c.total))])).map(c=><tr key={c.id}><td>{dateBr(c.created_at)}</td><td>{c.status}</td><td>{money(Number(c.total))}</td></tr>)}</tbody></table></div></article></div>
      </section>}

      {active==='config'&&<section>
        {isAdmin&&<form className="panel viewerUserForm" onSubmit={createManagedUserAccount}>
          <div className="formTitle"><div><h3>Criar novo usuário</h3><p>O acesso ao ERP passa a ser controlado pelo administrador. Escolha o perfil inicial do usuário.</p></div></div>
          <label className="fieldLabel">Nome do usuário<input value={viewerName} onChange={e=>setViewerName(e.target.value)} placeholder="Digite o nome" required/></label>
          <label className="fieldLabel">E-mail<input type="email" value={viewerEmail} onChange={e=>setViewerEmail(e.target.value)} placeholder="usuario@empresa.com" required/></label>
          <label className="fieldLabel">Senha inicial<input type="password" value={viewerPassword} onChange={e=>setViewerPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" minLength={8} required/></label>
          <label className="fieldLabel">Perfil
            <select value={newUserRole} onChange={e=>setNewUserRole(e.target.value as PerfilRole)}>
              <option value="administrador">Administrador</option>
              <option value="financeiro">Financeiro</option>
              <option value="vendas">Vendas</option>
              <option value="estoque">Estoque</option>
              <option value="visualizador">Visualizador</option>
            </select>
          </label>
          <button className="primary" disabled={creatingViewer}>{creatingViewer?'Criando...':'Criar usuário'}</button>
        </form>}

        {isAdmin&&<article className="panel userManagementPanel">
          <div className="panelHead">
            <div><h3>Gerenciar usuários</h3><p>Altere nome, perfil de acesso e status. Usuários desativados deixam de acessar os dados do ERP.</p></div>
            <button type="button" className="ghost" onClick={()=>void loadManagedUsers()}><RefreshCw size={15}/>Atualizar</button>
          </div>
          <SearchField value={tableSearch.usuarios||''} onChange={v=>setSearch('usuarios',v)} placeholder="Pesquisar nome, e-mail, perfil ou status"/>
          <div className="tableWrap userManagementTable"><table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th>Ação</th></tr></thead>
            <tbody>{managedUsers.filter(u=>searchMatches('usuarios',[u.nome,u.email,u.perfil,u.ativo?'ativo':'inativo'])).map(u=>{
              const draft=userEdits[u.user_id]||{nome:u.nome,perfil:u.perfil,ativo:u.ativo}
              const changed=draft.nome!==u.nome||draft.perfil!==u.perfil||draft.ativo!==u.ativo
              return <tr key={u.user_id}>
                <td><input className="userInlineInput" value={draft.nome} onChange={e=>editManagedUser(u.user_id,'nome',e.target.value)} disabled={u.usuario_atual&&savingUserId===u.user_id}/>{u.usuario_atual&&<small className="currentUserMark">Você</small>}</td>
                <td>{u.email}</td>
                <td><select className="userInlineSelect" value={draft.perfil} onChange={e=>editManagedUser(u.user_id,'perfil',e.target.value as PerfilRole)} disabled={u.usuario_atual}>
                  <option value="administrador">Administrador</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="vendas">Vendas</option>
                  <option value="estoque">Estoque</option>
                  <option value="visualizador">Visualizador</option>
                </select></td>
                <td><select className="userInlineSelect" value={draft.ativo?'ativo':'inativo'} onChange={e=>editManagedUser(u.user_id,'ativo',e.target.value==='ativo')} disabled={u.usuario_atual}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select></td>
                <td>{u.ultimo_acesso?new Date(u.ultimo_acesso).toLocaleString('pt-BR'):'Nunca acessou'}</td>
                <td><button type="button" className="primary userSaveBtn" disabled={!changed||savingUserId===u.user_id} onClick={()=>void saveManagedUser(u)}>{savingUserId===u.user_id?'Salvando...':'Salvar'}</button></td>
              </tr>
            })}</tbody>
          </table></div>
        </article>}

        <form className="panel configForm" onSubmit={saveCompany}>
          <div className="formTitle"><div><h3>Dados da empresa</h3><p>Esses dados alimentam as faturas e a identificação do ERP.</p></div>{!isAdmin&&<span className="readOnlyTag">Somente leitura</span>}</div><fieldset className="configFieldset" disabled={!isAdmin}>
          <label className="fieldLabel">Razão social<input name="razao_social" placeholder="Razão social da empresa" defaultValue={empresa?.razao_social||''} required/></label>
          <label className="fieldLabel">Nome fantasia<input name="nome_fantasia" placeholder="Nome fantasia" defaultValue={empresa?.nome_fantasia||''} required/></label>
          <label className="fieldLabel">CNPJ<input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" defaultValue={maskCnpj(empresa?.cnpj||'')} onInput={e=>{e.currentTarget.value=maskCnpj(e.currentTarget.value)}}/></label>
          <label className="fieldLabel">E-mail<input name="email" type="email" placeholder="contato@empresa.com" defaultValue={empresa?.email||''}/></label>
          <label className="fieldLabel">Telefone<input name="telefone" inputMode="tel" placeholder="(00) 00000-0000" defaultValue={maskPhone(empresa?.telefone||'')} onInput={e=>{e.currentTarget.value=maskPhone(e.currentTarget.value)}}/></label>
          <label className="fieldLabel">Endereço<input name="endereco" placeholder="Rua, número e complemento" defaultValue={empresa?.endereco||''}/></label>
          <label className="fieldLabel">Cidade<input name="cidade" placeholder="Cidade" defaultValue={empresa?.cidade||''}/></label>
          <label className="fieldLabel">UF<input name="uf" placeholder="UF" maxLength={2} defaultValue={empresa?.uf||''}/></label>
          <label className="fieldLabel">CEP<input name="cep" inputMode="numeric" placeholder="00000-000" defaultValue={maskCep(empresa?.cep||'')} onInput={e=>{e.currentTarget.value=maskCep(e.currentTarget.value)}}/></label>
          <label className="fieldLabel">Chave PIX<input name="pix_chave" placeholder="Chave PIX" defaultValue={empresa?.pix_chave||''}/></label>
          <label className="fieldLabel">Banco<input name="banco" placeholder="Banco" defaultValue={empresa?.banco||''}/></label>
          <label className="fieldLabel">Agência<input name="agencia" placeholder="Agência" defaultValue={empresa?.agencia||''}/></label>
          <label className="fieldLabel">Conta<input name="conta" placeholder="Conta" defaultValue={empresa?.conta||''}/></label>
          <label className="fieldLabel fieldLabelWide">Condições gerais da fatura<textarea name="condicoes_gerais" placeholder="Condições gerais da fatura" defaultValue={empresa?.condicoes_gerais||''}/></label>
          <div className="formActions"><button className="primary">Salvar configurações</button></div></fieldset>
        </form>
      </section>}
    </main>
  </div>
}

function SearchField({value,onChange,placeholder='Pesquisar'}:{value:string;onChange:(value:string)=>void;placeholder?:string}){
  return <div className="tableSearch">
    <Search size={16}/>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}/>
    {value&&<button type="button" onClick={()=>onChange('')} title="Limpar pesquisa"><X size={14}/></button>}
  </div>
}

function paymentLabel(v:string){return v==='dinheiro'?'Dinheiro':v==='pix'?'PIX':v==='cartao'?'Cartão':v==='boleto'?'Boleto':v||'—'}

function EmptyState({message,actionLabel,onAction}:{message:string;actionLabel?:string;onAction?:()=>void}){
  return <div className="emptyState"><span>{message}</span>{actionLabel&&onAction&&<button type="button" className="primary emptyStateAction" onClick={onAction}><Plus size={15}/>{actionLabel.replace(/^\+\s*/,'')}</button>}</div>
}


function EditableEntityTable({title,headers,rows,readOnly=false,emptyActionLabel,onEmptyAction}:{title:string;headers:string[];rows:{id:string;cells:(string|number)[];opened:boolean;onToggle:()=>void;panel:ReactNode}[];readOnly?:boolean;emptyActionLabel?:string;onEmptyAction?:()=>void}){
  const [query,setQuery]=useState('')
  const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  const filtered=normalized?rows.filter(r=>r.cells.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalized)):rows
  return <article className="panel tablePanel"><div className="panelHead"><h3>{title}</h3><SearchField value={query} onChange={setQuery} placeholder="Pesquisar em todas as colunas"/></div><div className="tableWrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.length===0&&<tr className="emptyTableRow"><td colSpan={headers.length}><EmptyState message={rows.length===0?`Nenhum registro em ${title.toLowerCase()}.`:'Nenhum resultado encontrado.'} actionLabel={rows.length===0&&!readOnly?emptyActionLabel:undefined} onAction={onEmptyAction}/></td></tr>}{filtered.map(r=><Fragment key={r.id}><tr>{r.cells.map((cell,i)=><td key={i}>{cell}</td>)}<td>{readOnly?<span className="readOnlyTag">Somente leitura</span>:<button className="rowMenuBtn" onClick={r.onToggle} title="Opções" aria-label="Abrir opções" aria-expanded={r.opened}><MoreVertical size={18}/></button>}</td></tr>{!readOnly&&r.opened&&<tr className="manageRow"><td colSpan={headers.length}><div className="actionPanel">{r.panel}</div></td></tr>}</Fragment>)}</tbody></table></div></article>
}

function ProductTable({produtos,onCreate,openId,onToggle,onEdit,onAdjust,onDelete,canDelete,readOnly=false}:{produtos:Produto[];onCreate:()=>void;openId:string|null;onToggle:(id:string)=>void;onEdit:(p:Produto)=>void;onAdjust:(p:Produto)=>void;onDelete:(p:Produto)=>void;canDelete:boolean;readOnly?:boolean}){
  const [query,setQuery]=useState('')
  const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  const filtered=normalized?produtos.filter(p=>[p.codigo,p.descricao,p.ativo?'ativo':'inativo',p.unidade,p.estoque_atual,p.estoque_minimo,money(Number(p.custo)),money(Number(p.preco_venda))].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalized)):produtos
  return <article className="panel tablePanel"><div className="panelHead"><div><h3>Produtos / Estoque</h3><p>{filtered.length} de {produtos.length} cadastrados</p></div><SearchField value={query} onChange={setQuery} placeholder="Pesquisar em todas as colunas"/></div><div className="tableWrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Status</th><th>Un.</th><th>Estoque</th><th>Mínimo</th><th>Custo</th><th>Venda</th><th>Gerenciar</th></tr></thead><tbody>{filtered.length===0&&<tr className="emptyTableRow"><td colSpan={9}><EmptyState message={produtos.length===0?'Nenhum produto cadastrado.':'Nenhum produto encontrado para esta pesquisa.'} actionLabel={produtos.length===0&&!readOnly?'+ Adicionar Produto':undefined} onAction={onCreate}/></td></tr>}{filtered.map(p=>{const opened=openId===p.id;const low=Number(p.estoque_atual)<=Number(p.estoque_minimo);return <Fragment key={p.id}><tr><td>{p.codigo}</td><td>{p.descricao}</td><td><span className={p.ativo?'statusBadge status-faturado':'statusBadge status-cancelado'}>{p.ativo?'ativo':'inativo'}</span></td><td>{p.unidade}</td><td><strong className={low?'stockLow':''}>{Number(p.estoque_atual).toLocaleString('pt-BR')}</strong></td><td>{Number(p.estoque_minimo).toLocaleString('pt-BR')}</td><td>{money(Number(p.custo))}</td><td>{money(Number(p.preco_venda))}</td><td>{readOnly?<span className="readOnlyTag">Somente leitura</span>:<button className="rowMenuBtn" onClick={()=>onToggle(p.id)} title="Opções" aria-label="Abrir opções do produto" aria-expanded={opened}><MoreVertical size={18}/></button>}</td></tr>{!readOnly&&opened&&<tr className="manageRow"><td colSpan={9}><div className="actionPanel"><div className="actionMeta"><strong>{p.codigo} - {p.descricao}</strong><span>Estoque: {Number(p.estoque_atual).toLocaleString('pt-BR')} {p.unidade}</span></div><div className="rowActions"><button className="ghost" onClick={()=>onEdit(p)}><Pencil size={15}/>Editar</button><button className="ghost" onClick={()=>onAdjust(p)}><Boxes size={15}/>Ajustar estoque</button>{canDelete&&<button className="dangerAction" onClick={()=>void onDelete(p)}><Trash2 size={15}/>Excluir</button>}</div></div></td></tr>}</Fragment>})}</tbody></table></div></article>
}

export default App
