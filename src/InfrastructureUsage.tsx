import { useCallback, useEffect, useState } from 'react'
import { Activity, Database, ExternalLink, GitBranch, GitCommit, Github, HardDrive, RefreshCw, Users, Gauge, Globe2, Zap, Radio, Layers3, ShieldCheck, LockKeyhole, ShieldAlert, BrainCircuit, DollarSign, FileText } from 'lucide-react'
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

type SecurityMetrics = {
  public_tables_without_rls: number
  public_security_definer_functions: number
  anon_executable_public_functions: number
  anon_accessible_public_tables: number
  score: number
  checked_at: string
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

type WorkflowRun = { id:number; name:string; status:string; conclusion:string|null; html_url:string; created_at:string; head_branch:string; head_sha:string }
type AuditLog = { id:number; tabela:string; acao:'INSERT'|'UPDATE'|'DELETE'; usuario_id:string|null; ocorrido_em:string }

type AiUsageLog = {
  id:string
  origem:'financeiro'|'compras'
  modelo:string
  arquivo_nome:string|null
  mime_type:string|null
  input_tokens:number
  cached_input_tokens:number
  output_tokens:number
  custo_estimado_usd:number
  created_at:string
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
const GITHUB_PAGES_SITE_BYTES = 1024 ** 3
const SUPABASE_FREE_DB_BYTES = 500 * 1024 ** 2
const SUPABASE_FREE_STORAGE_BYTES = 1024 ** 3
const percent = (used:number, limit:number) => Math.max(0, Math.min(100, limit > 0 ? used / limit * 100 : 0))


export function InfrastructureUsage() {
  const [infra, setInfra] = useState<InfraMetrics | null>(null)
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [participation, setParticipation] = useState<Participation | null>(null)
  const [commits, setCommits] = useState<CommitItem[]>([])
  const [security, setSecurity] = useState<SecurityMetrics | null>(null)
  const [aiUsage, setAiUsage] = useState<AiUsageLog[]>([])
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditUnavailable, setAuditUnavailable] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const [infraResult, securityResult, aiUsageResult, repoResponse, participationResponse, commitsResponse, workflowsResponse, auditResult] = await Promise.all([
        supabase.rpc('monitoramento_infraestrutura_erp'),
        supabase.rpc('monitoramento_seguranca_erp'),
        supabase.from('ai_usage_logs').select('*').order('created_at',{ascending:false}).limit(500),
        fetch(api, { headers: { Accept: 'application/vnd.github+json' } }),
        fetch(api + '/stats/participation', { headers: { Accept: 'application/vnd.github+json' } }),
        fetch(api + '/commits?per_page=6', { headers: { Accept: 'application/vnd.github+json' } }),
        fetch(api + '/actions/runs?per_page=8', { headers: { Accept: 'application/vnd.github+json' } }),
        supabase.from('auditoria_log').select('id,tabela,acao,usuario_id,ocorrido_em').order('ocorrido_em',{ascending:false}).limit(20),
      ])
      if (infraResult.error) throw infraResult.error
      if (!repoResponse.ok) throw new Error('GitHub indisponível (' + repoResponse.status + ').')
      const repoJson = await repoResponse.json() as RepoInfo
      setInfra(infraResult.data as InfraMetrics)
      setSecurity(securityResult.error ? null : securityResult.data as SecurityMetrics)
      setAiUsage(aiUsageResult.error ? [] : (aiUsageResult.data||[]) as AiUsageLog[])
      setRepoInfo(repoJson)

      if (participationResponse.ok) setParticipation(await participationResponse.json() as Participation)
      else setParticipation(null)

      if (commitsResponse.ok) setCommits(await commitsResponse.json() as CommitItem[])
      else setCommits([])

      if (workflowsResponse.ok) {
        const workflowJson = await workflowsResponse.json() as { workflow_runs?: WorkflowRun[] }
        setWorkflowRuns(workflowJson.workflow_runs || [])
      } else setWorkflowRuns([])
      setAuditUnavailable(Boolean(auditResult.error))
      setAuditLogs(auditResult.error ? [] : (auditResult.data || []) as AuditLog[])
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
  const monthKey = new Date().toISOString().slice(0,7)
  const aiThisMonth = aiUsage.filter(row=>row.created_at.slice(0,7)===monthKey)
  const aiTotalCost = aiUsage.reduce((sum,row)=>sum+Number(row.custo_estimado_usd||0),0)
  const aiMonthCost = aiThisMonth.reduce((sum,row)=>sum+Number(row.custo_estimado_usd||0),0)
  const aiInputTokens = aiUsage.reduce((sum,row)=>sum+Number(row.input_tokens||0),0)
  const aiOutputTokens = aiUsage.reduce((sum,row)=>sum+Number(row.output_tokens||0),0)
  const aiFinanceCount = aiUsage.filter(row=>row.origem==='financeiro').length
  const aiPurchaseCount = aiUsage.filter(row=>row.origem==='compras').length
  const usd = (value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:6}).format(value||0)

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
          <div className="infraMetric"><GitCommit size={18}/><span>Commits · 4 semanas</span><strong>{participation ? commits4Weeks : '—'}</strong><small>Alterações registradas no código nas últimas 4 semanas.</small></div>
          <div className="infraMetric"><Activity size={18}/><span>Commits · 52 semanas</span><strong>{participation ? commitsYear : '—'}</strong><small>Histórico de atividade acumulada no último ano.</small></div>
          <div className="infraMetric"><GitBranch size={18}/><span>Branch principal</span><strong>{repoInfo?.default_branch || '—'}</strong><small>Branch usada como base para o código publicado do SG.</small></div>
          <div className="infraMetric"><HardDrive size={18}/><span>Tamanho do repositório</span><strong>{repoInfo ? bytes(Number(repoInfo.size) * 1024) : '—'}</strong><small>GitHub Pages recomenda repositório-fonte de até 1 GB.</small></div>
        </div>
        <div className="infraLimitPanel">
          <div className="infraLimitHead"><strong>Limites do GitHub Pages</strong><span>Repositório público</span></div>
          <div className="infraLimitRows">
            <div><span><HardDrive size={15}/>Site publicado</span><strong>1 GB</strong><small>tamanho máximo do site publicado</small></div>
            <div><span><Globe2 size={15}/>Banda mensal</span><strong>100 GB</strong><small>limite flexível de tráfego do Pages</small></div>
            <div><span><Activity size={15}/>Deploy</span><strong>10 min</strong><small>tempo máximo por implantação</small></div>
            <div><span><Zap size={15}/>Actions padrão</span><strong>Grátis</strong><small>runners padrão em repositório público</small></div>
          </div>
          {repoInfo&&<div className="infraUsageBar">
            <span><b>Repositório atual</b><em>{bytes(Number(repoInfo.size)*1024)} de 1 GB recomendado</em></span>
            <i><u style={{width:percent(Number(repoInfo.size)*1024,GITHUB_PAGES_SITE_BYTES)+'%'}}/></i>
          </div>}
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
          <div className="infraProviderTitle"><span className="infraLogo supabaseMark"><Database size={24}/></span><div><h3>Supabase</h3><p>Projeto ORGJSS1-BR · sa-east-1 / produção</p></div></div>
          <a className="ghost infraLink" href="https://supabase.com/dashboard/project/ecvuvfxfsqnulzszwqaq" target="_blank" rel="noreferrer">Abrir<ExternalLink size={15}/></a>
        </div>
        <div className="infraMetricGrid">
          <div className="infraMetric"><Database size={18}/><span>Banco de dados</span><strong>{infra ? bytes(Number(infra.database_bytes)) : '—'}</strong><small>Dados PostgreSQL usados pelo ERP.</small></div>
          <div className="infraMetric"><HardDrive size={18}/><span>Storage</span><strong>{infra ? bytes(Number(infra.storage_bytes)) : '—'}</strong><small>Arquivos salvos na nuvem: PDFs, imagens e documentos.</small></div>
          <div className="infraMetric"><Users size={18}/><span>Usuários Auth</span><strong>{infra?.auth_users ?? '—'}</strong><small>Contas cadastradas no Auth; não representa MAU mensal.</small></div>
          <div className="infraMetric"><Activity size={18}/><span>Conexões agora</span><strong>{infra?.database_connections ?? '—'}</strong><small>Conexões PostgreSQL abertas no momento da leitura.</small></div>
        </div>
        <div className="infraPlanBadge"><Gauge size={15}/><span>Plano confirmado</span><strong>Supabase Free</strong></div>
        <div className="infraLimitPanel supabaseLimits">
          <div className="infraLimitHead"><strong>Limites incluídos no plano</strong><span>Free</span></div>
          <div className="infraLimitRows">
            <div><span><Database size={15}/>Banco por projeto</span><strong>500 MB</strong><small>limite de tamanho do PostgreSQL</small></div>
            <div><span><HardDrive size={15}/>Storage</span><strong>1 GB</strong><small>arquivos armazenados na organização</small></div>
            <div><span><Globe2 size={15}/>Egress</span><strong>5 + 5 GB</strong><small>5 GB não-cache + 5 GB cache por mês</small></div>
            <div><span><Users size={15}/>MAU</span><strong>50 mil</strong><small>usuários ativos mensais</small></div>
            <div><span><Zap size={15}/>Edge Functions</span><strong>500 mil</strong><small>invocações incluídas</small></div>
            <div><span><Radio size={15}/>Realtime</span><strong>2 mi</strong><small>mensagens incluídas por mês</small></div>
            <div><span><Activity size={15}/>Realtime pico</span><strong>200</strong><small>conexões simultâneas de Realtime</small></div>
            <div><span><Layers3 size={15}/>Projetos ativos</span><strong>2</strong><small>projetos ativos no plano Free</small></div>
          </div>
          {infra&&<div className="infraUsageBars">
            <div className="infraUsageBar">
              <span><b>Banco atual</b><em>{bytes(Number(infra.database_bytes))} de 500 MB</em></span>
              <i><u style={{width:percent(Number(infra.database_bytes),SUPABASE_FREE_DB_BYTES)+'%'}}/></i>
            </div>
            <div className="infraUsageBar">
              <span><b>Storage atual</b><em>{bytes(Number(infra.storage_bytes))} de 1 GB</em></span>
              <i><u style={{width:percent(Number(infra.storage_bytes),SUPABASE_FREE_STORAGE_BYTES)+'%'}}/></i>
            </div>
          </div>}
        </div>
        <div className="infraDetails">
          <div><span>Tabelas públicas</span><strong>{infra?.public_tables ?? '—'}</strong></div>
          <div><span>Objetos no Storage</span><strong>{infra?.storage_objects ?? '—'}</strong></div>
          <div><span>PostgreSQL</span><strong>{infra?.postgres_version?.split(' ')[0] || '—'}</strong></div>
          <div><span>Atualizado</span><strong>{infra ? dateTime(infra.generated_at) : '—'}</strong></div>
        </div>
        <p className="infraNote">Os limites acima são referências do plano Free. Egress, MAU, Edge Functions e Realtime não são medidos por este painel; consulte o Usage oficial do Supabase para o consumo mensal completo.</p>
      </article>
    </div>


    <article className="panel infraMonitorPanel">
      <div className="infraProviderHead">
        <div className="infraProviderTitle"><span className="infraLogo"><Activity size={24}/></span><div><h3>Central de Monitoramento</h3><p>Execuções do GitHub Actions e trilha de auditoria do SG.</p></div></div>
        <span className="infraMonitorUpdated">Atualizado junto com o painel</span>
      </div>
      <div className="infraMonitorColumns">
        <section className="infraMonitorSection">
          <div className="infraSubhead"><strong><Github size={16}/> GitHub Actions</strong><a className="ghost infraLink" href={'https://github.com/' + repo + '/actions'} target="_blank" rel="noreferrer">Ver execuções<ExternalLink size={14}/></a></div>
          <div className="infraMonitorList">
            {workflowRuns.map(run=>{
              const ok=run.conclusion==='success'
              const failed=run.conclusion==='failure'
              const running=run.status==='in_progress'||run.status==='queued'
              return <a className="infraMonitorRow" href={run.html_url} target="_blank" rel="noreferrer" key={run.id}>
                <span className={'infraMonitorDot '+(ok?'isOk':failed?'isError':running?'isRunning':'isNeutral')}/>
                <span className="infraMonitorText"><strong>{run.name}</strong><small>{run.head_branch} · {short(run.head_sha)} · {dateTime(run.created_at)}</small></span>
                <b>{running?'Em execução':ok?'Sucesso':failed?'Falhou':run.conclusion||run.status}</b>
                <ExternalLink size={13}/>
              </a>
            })}
            {!workflowRuns.length&&<div className="infraEmpty">Nenhuma execução encontrada ou histórico indisponível.</div>}
          </div>
        </section>
        <section className="infraMonitorSection">
          <div className="infraSubhead"><strong><FileText size={16}/> Auditoria do banco</strong><span>20 eventos recentes</span></div>
          <div className="infraMonitorList">
            {auditLogs.map(row=><div className="infraMonitorRow" key={row.id}>
              <span className={'infraMonitorDot '+(row.acao==='DELETE'?'isError':row.acao==='INSERT'?'isOk':'isNeutral')}/>
              <span className="infraMonitorText"><strong>{row.tabela} · {row.acao}</strong><small>{dateTime(row.ocorrido_em)} · {row.usuario_id?'Usuário identificado':'Ação de sistema'}</small></span>
              <b>#{row.id}</b>
            </div>)}
            {auditUnavailable&&<div className="infraEmpty">Auditoria não disponível para esta conta. Verifique a permissão de leitura da tabela.</div>}
            {!auditUnavailable&&!auditLogs.length&&<div className="infraEmpty">Nenhum evento recente registrado.</div>}
          </div>
        </section>
      </div>
      <p className="infraNote">A auditoria consulta a tabela interna <code>auditoria_log</code> com limite de 20 registros. O histórico de Actions mostra até 8 execuções recentes. Isso reduz consultas amplas ao Logs Explorer; não substitui os logs técnicos detalhados das Edge Functions.</p>
    </article>

    <article className="panel infraAiPanel">
      <div className="infraProviderHead">
        <div className="infraProviderTitle"><span className="infraLogo aiMark"><BrainCircuit size={24}/></span><div><h3>OpenAI API / IA</h3><p>Leitura automática de PDFs e imagens no Financeiro e em Compras.</p></div></div>
        <div className="infraAiLinks">
          <a className="ghost infraLink" href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">Billing<ExternalLink size={15}/></a>
          <a className="ghost infraLink" href="https://platform.openai.com/usage" target="_blank" rel="noreferrer">Usage<ExternalLink size={15}/></a>
        </div>
      </div>

      <div className="infraMetricGrid infraAiMetrics">
        <div className="infraMetric"><FileText size={18}/><span>Documentos lidos</span><strong>{aiUsage.length}</strong><small>{aiFinanceCount} no Financeiro · {aiPurchaseCount} em Compras</small></div>
        <div className="infraMetric"><DollarSign size={18}/><span>Custo estimado total</span><strong>{usd(aiTotalCost)}</strong><small>Estimativa baseada nos tokens retornados pela OpenAI.</small></div>
        <div className="infraMetric"><Activity size={18}/><span>Custo no mês</span><strong>{usd(aiMonthCost)}</strong><small>{aiThisMonth.length} leitura(s) no mês atual.</small></div>
        <div className="infraMetric"><Zap size={18}/><span>Tokens processados</span><strong>{(aiInputTokens+aiOutputTokens).toLocaleString('pt-BR')}</strong><small>{aiInputTokens.toLocaleString('pt-BR')} entrada · {aiOutputTokens.toLocaleString('pt-BR')} saída</small></div>
      </div>

      <div className="infraLimitPanel">
        <div className="infraLimitHead"><strong>Modelo usado pelo SG</strong><span>GPT-6 Luna</span></div>
        <div className="infraLimitRows">
          <div><span><Activity size={15}/>Entrada</span><strong>US$ 0,10</strong><small>por 1 milhão de tokens</small></div>
          <div><span><Zap size={15}/>Entrada cacheada</span><strong>US$ 0,01</strong><small>por 1 milhão de tokens</small></div>
          <div><span><BrainCircuit size={15}/>Saída</span><strong>US$ 0,50</strong><small>por 1 milhão de tokens</small></div>
          <div><span><ShieldCheck size={15}/>Chave da API</span><strong>Protegida</strong><small>fica somente nos Secrets da Edge Function</small></div>
        </div>
      </div>

      <div className="infraSubhead"><strong>Últimas leituras por IA</strong><span>Até 8 registros recentes</span></div>
      <div className="infraAiHistory">
        {aiUsage.slice(0,8).map(row=><div className="infraAiRow" key={row.id}>
          <span className="infraAiOrigin">{row.origem==='financeiro'?'Financeiro':'Compras'}</span>
          <div><strong>{row.arquivo_nome||'Documento sem nome'}</strong><small>{dateTime(row.created_at)} · {row.modelo}</small></div>
          <div><strong>{usd(Number(row.custo_estimado_usd||0))}</strong><small>{(Number(row.input_tokens||0)+Number(row.output_tokens||0)).toLocaleString('pt-BR')} tokens</small></div>
        </div>)}
        {!aiUsage.length&&<div className="infraEmpty">Nenhuma leitura por IA registrada ainda.</div>}
      </div>
      <p className="infraNote">O custo mostrado no SG é uma estimativa local. O valor oficial de cobrança deve ser conferido em Billing/Usage da OpenAI.</p>
    </article>

    <article className="panel infraSecurityPanel">
      <div className="infraSecurityHead">
        <div><span className="infraLogo securityMark"><ShieldCheck size={23}/></span><div><h3>Segurança do SG</h3><p>Verificação ao vivo das proteções do banco e da API.</p></div></div>
        <strong className={security&&security.score===100?'securityScore good':'securityScore warning'}>{security ? security.score + '/100' : '—'}</strong>
      </div>
      <div className="infraSecurityGrid">
        <div><ShieldCheck size={17}/><span>RLS nas tabelas públicas</span><strong>{security ? (security.public_tables_without_rls===0?'Protegido':security.public_tables_without_rls+' pendência(s)') : '—'}</strong><small>{security?.public_tables_without_rls===0?'Nenhuma tabela pública sem Row Level Security.':'Revisar tabelas sem RLS.'}</small></div>
        <div><LockKeyhole size={17}/><span>RPCs privilegiadas públicas</span><strong>{security ? (security.public_security_definer_functions===0?'0 expostas':security.public_security_definer_functions+' expostas') : '—'}</strong><small>Implementações privilegiadas ficam no schema privado.</small></div>
        <div><ShieldCheck size={17}/><span>Acesso anônimo a RPCs</span><strong>{security ? (security.anon_executable_public_functions===0?'Bloqueado':security.anon_executable_public_functions+' liberadas') : '—'}</strong><small>O SG exige autenticação para executar funções do ERP.</small></div>
        <div><ShieldCheck size={17}/><span>Acesso anônimo a dados</span><strong>{security ? (security.anon_accessible_public_tables===0?'Bloqueado':security.anon_accessible_public_tables+' tabelas') : '—'}</strong><small>Tabelas do ERP não ficam disponíveis para visitantes sem login.</small></div>
        <div className="securityPlanNotice"><ShieldAlert size={17}/><span>Senhas vazadas</span><strong>Indisponível no Free</strong><small>O Supabase oferece bloqueio via HaveIBeenPwned apenas no Pro+. No SG, redefinições administrativas exigem 12+ caracteres, maiúscula, minúscula, número e símbolo.</small></div>
      </div>
      <p className="infraNote">Última verificação interna: {security ? dateTime(security.checked_at) : '—'}.</p>
    </article>
  </section>
}
