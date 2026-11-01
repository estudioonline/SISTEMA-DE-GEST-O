import { useCallback, useEffect, useState } from 'react'
import { Activity, Database, ExternalLink, GitBranch, GitCommit, Github, HardDrive, RefreshCw, Users } from 'lucide-react'
import { supabase } from './lib/supabase'

type InfraMetrics = {
  generated_at: string
  database_bytes: number
  database_connections: number
  public_tables: number
  auth_users: number
  storage_objects: number
  storage_bytes: number
  postgres_version: string
}

type RepoInfo = {
  size: number
  default_branch: string
  open_issues_count: number
  pushed_at: string
}

type Participation = { all: number[]; owner: number[] }
type CommitItem = {
  sha: string
  html_url: string
  commit: { message: string; author: { name: string; date: string } | null }
}

const repo = 'estudioonline/SISTEMA-DE-GEST-O'
const api = 'https://api.github.com/repos/' + repo
const bytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1024 ** index) + ' ' + units[index]
}
const dateTime = (value: string) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const short = (sha: string) => sha.slice(0, 7)

export function InfrastructureUsage() {
  const [infra, setInfra] = useState<InfraMetrics | null>(null)
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [participation, setParticipation] = useState<Participation | null>(null)
  const [commits, setCommits] = useState<CommitItem[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const [infraResult, repoResponse, participationResponse, commitsResponse] = await Promise.all([
        supabase.rpc('monitoramento_infraestrutura_erp'),
        fetch(api, { headers: { Accept: 'application/vnd.github+json' } }),
        fetch(api + '/stats/participation', { headers: { Accept: 'application/vnd.github+json' } }),
        fetch(api + '/commits?per_page=6', { headers: { Accept: 'application/vnd.github+json' } }),
      ])
      if (infraResult.error) throw infraResult.error
      if (!repoResponse.ok) throw new Error('GitHub indisponível (' + repoResponse.status + ').')
      const repoJson = await repoResponse.json() as RepoInfo
      setInfra(infraResult.data as InfraMetrics)
      setRepoInfo(repoJson)

      if (participationResponse.ok) setParticipation(await participationResponse.json() as Participation)
      else setParticipation(null)

      if (commitsResponse.ok) setCommits(await commitsResponse.json() as CommitItem[])
      else setCommits([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o monitoramento.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const weekly = participation?.all || []
  const commits4Weeks = weekly.slice(-4).reduce((sum, value) => sum + Number(value || 0), 0)
  const commitsYear = weekly.reduce((sum, value) => sum + Number(value || 0), 0)

  return <section className="infraPage">
    <div className="infraHero panel">
      <div>
        <span className="infraEyebrow"><Activity size={16}/> Monitoramento do SG</span>
        <h2>GitHub & Supabase</h2>
        <p>Visão operacional do código e da infraestrutura que sustentam o Sistema de Gestão.</p>
      </div>
      <button type="button" className="ghost" onClick={() => void load()} disabled={busy}>
        <RefreshCw size={17} className={busy ? 'infraSpin' : ''}/>{busy ? 'Atualizando…' : 'Atualizar'}
      </button>
    </div>

    {error && <div className="panel infraError" role="alert">{error}</div>}

    <div className="infraColumns">
      <article className="panel infraProvider">
        <div className="infraProviderHead">
          <div className="infraProviderTitle"><span className="infraLogo"><Github size={24}/></span><div><h3>GitHub</h3><p>{repo}</p></div></div>
          <a className="ghost infraLink" href={'https://github.com/' + repo} target="_blank" rel="noreferrer">Abrir<ExternalLink size={15}/></a>
        </div>
        <div className="infraMetricGrid">
          <div className="infraMetric"><GitCommit size={18}/><span>Commits · 4 semanas</span><strong>{participation ? commits4Weeks : '—'}</strong></div>
          <div className="infraMetric"><Activity size={18}/><span>Commits · 52 semanas</span><strong>{participation ? commitsYear : '—'}</strong></div>
          <div className="infraMetric"><GitBranch size={18}/><span>Branch principal</span><strong>{repoInfo?.default_branch || '—'}</strong></div>
          <div className="infraMetric"><HardDrive size={18}/><span>Tamanho do repositório</span><strong>{repoInfo ? bytes(Number(repoInfo.size) * 1024) : '—'}</strong></div>
        </div>
        <div className="infraSubhead"><strong>Atividade recente</strong><span>Último push: {repoInfo ? dateTime(repoInfo.pushed_at) : '—'}</span></div>
        <div className="infraCommitList">
          {commits.length === 0 && <div className="infraEmpty">{busy ? 'Carregando commits…' : 'Nenhum commit disponível.'}</div>}
          {commits.map(item => <a key={item.sha} href={item.html_url} target="_blank" rel="noreferrer" className="infraCommit">
            <code>{short(item.sha)}</code>
            <span><strong>{item.commit.message.split('\n')[0]}</strong><small>{item.commit.author?.name || 'Autor não informado'} · {dateTime(item.commit.author?.date || '')}</small></span>
            <ExternalLink size={14}/>
          </a>)}
        </div>
      </article>

      <article className="panel infraProvider">
        <div className="infraProviderHead">
          <div className="infraProviderTitle"><span className="infraLogo supabaseMark"><Database size={24}/></span><div><h3>Supabase</h3><p>Projeto ORGJSS1 · us-east-1 / produção</p></div></div>
        </div>
        <div className="infraMetricGrid">
          <div className="infraMetric"><Database size={18}/><span>Banco de dados</span><strong>{infra ? bytes(Number(infra.database_bytes)) : '—'}</strong></div>
          <div className="infraMetric"><HardDrive size={18}/><span>Storage</span><strong>{infra ? bytes(Number(infra.storage_bytes)) : '—'}</strong></div>
          <div className="infraMetric"><Users size={18}/><span>Usuários Auth</span><strong>{infra?.auth_users ?? '—'}</strong></div>
          <div className="infraMetric"><Activity size={18}/><span>Conexões agora</span><strong>{infra?.database_connections ?? '—'}</strong></div>
        </div>
        <div className="infraDetails">
          <div><span>Tabelas públicas</span><strong>{infra?.public_tables ?? '—'}</strong></div>
          <div><span>Objetos no Storage</span><strong>{infra?.storage_objects ?? '—'}</strong></div>
          <div><span>PostgreSQL</span><strong>{infra?.postgres_version?.split(' ')[0] || '—'}</strong></div>
          <div><span>Atualizado</span><strong>{infra ? dateTime(infra.generated_at) : '—'}</strong></div>
        </div>
        <p className="infraNote">Este painel mostra consumo operacional do SG. Limites e cobrança do plano continuam sendo controlados no painel oficial do Supabase.</p>
      </article>
    </div>
  </section>
}
