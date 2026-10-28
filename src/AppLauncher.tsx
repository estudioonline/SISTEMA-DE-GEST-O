import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Search, ShieldCheck, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { permissionModules } from './lib/permissions'
import type { PermissionModule } from './lib/permissions'

export type AppMenu = ReadonlyArray<readonly [PermissionModule, string, LucideIcon]>

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
const descriptions: Partial<Record<PermissionModule, string>> = {
  financeiro: 'Contas, pagamentos, gastos e vales de funcionários',
}

export function AppLauncher({ menu, company, ready, canEdit, onOpen }: {
  menu: AppMenu
  company: string
  ready: boolean
  canEdit: (module: PermissionModule) => boolean
  onOpen: (module: PermissionModule) => void
}) {
  const [query, setQuery] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const apps = menu.filter(([key, label]) => normalize(`${label} ${descriptions[key] || permissionModules.find(m => m.key === key)?.description || ''}`).includes(normalize(query)))

  return <section className="appLauncher" aria-labelledby="apps-heading">
    <div className="launcherIntro">
      <span className="launcherEyebrow">SEU ESPAÇO DE TRABALHO</span>
      <h1 id="apps-heading" ref={heading} tabIndex={-1}>Tudo começa por aqui.</h1>
      <p>Escolha um aplicativo para gerenciar {company === 'Sistema de Gestão' ? 'sua empresa' : company}.</p>
    </div>
    <div className="launcherToolbar">
      <div><h2>Aplicativos</h2><span aria-live="polite">{ready ? `${apps.length} ${apps.length === 1 ? 'disponível' : 'disponíveis'} para você` : 'Carregando seus acessos…'}</span></div>
      <div className="launcherSearch">
        <Search size={19} aria-hidden="true"/>
        <input aria-label="Buscar aplicativo" type="search" placeholder="Buscar aplicativo…" value={query} onChange={event => setQuery(event.target.value)} disabled={!ready}/>
        {query && <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}><X size={16}/></button>}
      </div>
    </div>
    {!ready ? <div className="launcherEmpty" role="status">Preparando seus aplicativos…</div> :
      apps.length ? <nav className="launcherGrid" aria-label="Aplicativos disponíveis">
        {apps.map(([key, label, Icon]) => {
          const meta = permissionModules.find(module => module.key === key)
          return <button type="button" key={key} className={`launcherApp appColor-${key}`} onClick={() => onOpen(key)} aria-label={`Abrir ${label}`}>
            <span className="launcherAppTop"><span className="launcherIcon"><Icon size={28} strokeWidth={1.7} aria-hidden="true"/></span><ArrowUpRight className="launcherArrow" size={18} aria-hidden="true"/></span>
            <strong>{label}</strong>
            <span className="launcherDescription">{descriptions[key] || meta?.description}</span>
            <span className="launcherAccess">{meta?.editable && !canEdit(key) ? 'Somente leitura' : 'Abrir aplicativo'}<span aria-hidden="true">→</span></span>
          </button>
        })}
      </nav> : <div className="launcherEmpty" role="status"><strong>{menu.length ? 'Nenhum aplicativo encontrado' : 'Nenhum aplicativo liberado'}</strong><p>{menu.length ? 'Tente buscar pelo nome ou pela função do aplicativo.' : 'Solicite ao administrador a liberação dos seus acessos.'}</p>{query && <button type="button" className="ghost" onClick={() => setQuery('')}>Limpar busca</button>}</div>}
    <p className="launcherFootnote"><ShieldCheck size={16} aria-hidden="true"/> Seus aplicativos seguem as permissões da sua conta.</p>
  </section>
}
