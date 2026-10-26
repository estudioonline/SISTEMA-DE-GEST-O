import { useMemo, useState } from 'react'
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, ReceiptText,
  WalletCards, BarChart3, Settings, Moon, Sun, Search, Plus, Building2
} from 'lucide-react'

type ModuleKey =
  | 'dashboard' | 'clientes' | 'fornecedores' | 'produtos' | 'estoque'
  | 'compras' | 'vendas' | 'financeiro' | 'relatorios' | 'config'

const menu: Array<{key: ModuleKey; label: string; icon: any}> = [
  { key:'dashboard', label:'Dashboard', icon: LayoutDashboard },
  { key:'clientes', label:'Clientes', icon: Users },
  { key:'fornecedores', label:'Fornecedores', icon: Building2 },
  { key:'produtos', label:'Produtos', icon: Package },
  { key:'estoque', label:'Estoque', icon: Boxes },
  { key:'compras', label:'Compras', icon: ShoppingCart },
  { key:'vendas', label:'Vendas', icon: ReceiptText },
  { key:'financeiro', label:'Financeiro', icon: WalletCards },
  { key:'relatorios', label:'Relatórios', icon: BarChart3 },
  { key:'config', label:'Configurações', icon: Settings },
]

const cards = [
  ['Vendas no mês','R$ 184.320,00','+12,8%'],
  ['A receber','R$ 67.850,00','34 títulos'],
  ['A pagar','R$ 42.190,00','21 títulos'],
  ['Saldo disponível','R$ 93.440,00','Caixa + bancos'],
]

const products = [
  ['PRD-001','Perfil Alumínio Branco 6m','UN','86','R$ 189,90'],
  ['PRD-002','Lona PVC 650g Azul','M²','142','R$ 49,50'],
  ['PRD-003','Kit Braço Articulado','UN','18','R$ 320,00'],
  ['PRD-004','Motor Tubular 60Nm','UN','7','R$ 890,00'],
]

function App() {
  const [active, setActive] = useState<ModuleKey>('dashboard')
  const [dark, setDark] = useState(false)
  const title = useMemo(() => menu.find(m => m.key === active)?.label ?? 'Dashboard',[active])

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">SG</div>
          <div><strong>Sistema de Gestão</strong><span>ERP Empresarial</span></div>
        </div>
        <nav>
          {menu.map(({key,label,icon:Icon}) => (
            <button key={key} className={active===key?'navItem active':'navItem'} onClick={()=>setActive(key)}>
              <Icon size={18}/><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebarFooter">
          <span>Administrador</span>
          <small>Ambiente de demonstração</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>Visão consolidada da operação</p>
          </div>
          <div className="topActions">
            <div className="search"><Search size={17}/><input placeholder="Buscar no sistema"/></div>
            <button className="iconBtn" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
            <button className="primary"><Plus size={17}/>Novo</button>
          </div>
        </header>

        {active === 'dashboard' ? (
          <section>
            <div className="cards">
              {cards.map(([label,value,note]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
            </div>
            <div className="grid2">
              <article className="panel">
                <div className="panelHead"><div><h3>Resumo financeiro</h3><p>Últimos 6 meses</p></div><span className="pill">Atualizado</span></div>
                <div className="bars">
                  {[48,62,55,76,69,88].map((h,i)=><div className="barCol" key={i}><div className="bar" style={{height:h+'%'}}/><span>{['Mai','Jun','Jul','Ago','Set','Out'][i]}</span></div>)}
                </div>
              </article>
              <article className="panel">
                <div className="panelHead"><div><h3>Alertas</h3><p>Pontos que exigem atenção</p></div></div>
                <div className="alerts">
                  <div><b>4 produtos</b><span>abaixo do estoque mínimo</span></div>
                  <div><b>6 títulos</b><span>vencem hoje</span></div>
                  <div><b>2 clientes</b><span>com limite excedido</span></div>
                </div>
              </article>
            </div>

            <article className="panel tablePanel">
              <div className="panelHead"><div><h3>Produtos em destaque</h3><p>Posição atual do estoque</p></div><button className="ghost">Ver todos</button></div>
              <div className="tableWrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Un.</th><th>Estoque</th><th>Preço</th></tr></thead>
              <tbody>{products.map(r=><tr key={r[0]}>{r.map((c,i)=><td key={i}>{c}</td>)}</tr>)}</tbody></table></div>
            </article>
          </section>
        ) : (
          <section className="modulePlaceholder">
            <div className="moduleIcon">{(() => { const Icon=menu.find(m=>m.key===active)!.icon; return <Icon size={28}/> })()}</div>
            <h2>{title}</h2>
            <p>Este módulo já está previsto na estrutura do ERP e será conectado ao banco Supabase.</p>
            <button className="primary"><Plus size={17}/>Novo registro</button>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
