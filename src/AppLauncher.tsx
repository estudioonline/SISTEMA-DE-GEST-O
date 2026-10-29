import { useEffect, useRef, useState } from 'react'
import { Search, ShieldCheck, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { permissionModules } from './lib/permissions'
import { appPermission } from './lib/hr'
import type { AppModule } from './lib/hr'

export type AppMenu = ReadonlyArray<readonly [AppModule, string, LucideIcon]>

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
const descriptions: Partial<Record<AppModule, string>> = {
  financeiro: 'Contas, pagamentos e conciliação',
  rh: 'Recursos Humanos, funcionários, salários, FGTS, décimo terceiro e vales',
}

export function AppLauncher({ menu, company, ready, canEdit, onOpen, notifications = {} }: {
  menu: AppMenu
  company: string
  ready: boolean
  canEdit: (module: AppModule) => boolean
  onOpen: (module: AppModule) => void
  notifications?: Partial<Record<AppModule, number>>
}) {
  const [query, setQuery] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const apps = menu.filter(([key, label]) => normalize(`${label} ${descriptions[key] || permissionModules.find(m => m.key === appPermission(key))?.description || ''}`).includes(normalize(query)))

  return <section className="appLauncher" aria-labelledby="apps-heading">
    <div className="launcherIntro">
      <span className="launcherEyebrow">SEU ESPAÇO DE TRABALHO</span>
      <h1 id="apps-heading" ref={heading} tabIndex={-1}>Aplicativos</h1>
      <p>Acesse os módulos de {company === 'Sistema de Gestão' ? 'sua empresa' : company}.</p>
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
          const meta = permissionModules.find(module => module.key === appPermission(key))
          const readOnly = Boolean(meta?.editable && !canEdit(key))
          return <button type="button" key={key} className={`launcherApp appColor-${key}${readOnly?' readOnly':''}`} onClick={() => onOpen(key)} aria-label={`${readOnly?'Abrir em modo somente leitura':'Abrir'} ${label}`} title={readOnly?`${label} · somente leitura`:label}>
            <span className="launcherIcon"><Icon size={30} strokeWidth={1.8} aria-hidden="true"/>{Number(notifications[key]||0)>0&&<span className="launcherNotification" aria-label={`${notifications[key]} pendente(s)`}>{Number(notifications[key])>99?'99+':notifications[key]}</span>}</span>
            <strong>{label}</strong>
            {readOnly&&<span className="launcherReadOnly">Somente leitura</span>}
          </button>
        })}
      </nav> : <div className="launcherEmpty" role="status"><strong>{menu.length ? 'Nenhum aplicativo encontrado' : 'Nenhum aplicativo liberado'}</strong><p>{menu.length ? 'Tente buscar pelo nome ou pela função do aplicativo.' : 'Solicite ao administrador a liberação dos seus acessos.'}</p>{query && <button type="button" className="ghost" onClick={() => setQuery('')}>Limpar busca</button>}</div>}
    <p className="launcherFootnote"><ShieldCheck size={16} aria-hidden="true"/> Seus aplicativos seguem as permissões da sua conta.</p>
  </section>
}
