import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Cloud, Download, ExternalLink, FileImage, FileSpreadsheet,
  FileText, FolderOpen, HardDrive, RefreshCw, Search, ShoppingCart, ReceiptText
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { readAllRows } from './lib/readAllRows'

type CloudDocument = {
  id: string
  venda_id: string | null
  compra_id: string | null
  storage_path: string
  nome_arquivo: string
  mime_type: string | null
  tamanho: number | null
  created_at: string
}
type DocumentFilter = 'todos' | 'vendas' | 'compras' | 'pdf' | 'imagens' | 'outros'

const normalize = (value: string) => value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
const extensionOf = (file: CloudDocument) => (file.nome_arquivo.split('.').pop() || '').toLowerCase()
const isPdf = (file: CloudDocument) => file.mime_type?.toLowerCase().includes('pdf') || extensionOf(file) === 'pdf'
const isImage = (file: CloudDocument) => file.mime_type?.toLowerCase().startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(extensionOf(file))
const isSpreadsheet = (file: CloudDocument) => ['xls','xlsx','csv','ods'].includes(extensionOf(file)) || Boolean(file.mime_type?.includes('spreadsheet') || file.mime_type?.includes('excel'))
const formatSize = (bytes: number | null) => {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return 'Tamanho não informado'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}
const formatDate = (value: string) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
const fileKind = (file: CloudDocument) => isPdf(file) ? 'PDF' : isImage(file) ? 'Imagem' : isSpreadsheet(file) ? 'Planilha' : (extensionOf(file).toUpperCase() || 'Arquivo')
const totalSize = (documents: CloudDocument[]) => documents.reduce((sum, file) => sum + Math.max(0, Number(file.tamanho) || 0), 0)

export function DocumentsLibrary() {
  const [documents, setDocuments] = useState<CloudDocument[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DocumentFilter>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function loadDocuments() {
    setLoading(true)
    setError('')
    try {
      const result = await readAllRows<CloudDocument>((from, to) =>
        supabase.from('comprovantes_pagamento').select('*')
          .order('created_at', { ascending: false }).order('id').range(from, to)
      )
      if (result.error) {
        setError('Não foi possível carregar os documentos da nuvem. Confirme seu acesso ao Financeiro e tente novamente.')
        return
      }
      setDocuments((result.data || []) as CloudDocument[])
    } catch {
      setError('Ocorreu um erro ao consultar os documentos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadDocuments() }, [])

  const filtered = useMemo(() => {
    const term = normalize(search)
    return documents.filter(file => {
      const origin = file.venda_id ? 'venda' : file.compra_id ? 'compra' : 'sem vínculo'
      const searchable = normalize([file.nome_arquivo, file.mime_type || '', file.storage_path, origin, file.venda_id || '', file.compra_id || ''].join(' '))
      const matchesSearch = !term || searchable.includes(term)
      const matchesFilter =
        filter === 'todos' ||
        (filter === 'vendas' && Boolean(file.venda_id)) ||
        (filter === 'compras' && Boolean(file.compra_id)) ||
        (filter === 'pdf' && isPdf(file)) ||
        (filter === 'imagens' && isImage(file)) ||
        (filter === 'outros' && !isPdf(file) && !isImage(file) && !isSpreadsheet(file))
      return matchesSearch && matchesFilter
    })
  }, [documents, search, filter])

  async function openDocument(file: CloudDocument) {
    setOpeningId(file.id)
    setError('')
    try {
      const { data, error: storageError } = await supabase.storage
        .from('comprovantes-pagamento').createSignedUrl(file.storage_path, 300)
      if (storageError || !data?.signedUrl) {
        setError('Não foi possível abrir este arquivo. Verifique se ele ainda existe na nuvem.')
        return
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Não foi possível abrir este arquivo. Tente novamente.')
    } finally {
      setOpeningId(null)
    }
  }

  async function downloadDocument(file: CloudDocument) {
    setDownloadingId(file.id)
    setError('')
    try {
      const { data, error: storageError } = await supabase.storage
        .from('comprovantes-pagamento').download(file.storage_path)
      if (storageError || !data) {
        setError('Não foi possível baixar este arquivo. Verifique se ele ainda existe na nuvem.')
        return
      }
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.nome_arquivo || 'documento'
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('Não foi possível baixar este arquivo. Tente novamente.')
    } finally {
      setDownloadingId(null)
    }
  }

  const salesCount = documents.filter(file => Boolean(file.venda_id)).length
  const purchasesCount = documents.filter(file => Boolean(file.compra_id)).length
  const totalBytes = totalSize(documents)

  return <section className="documentsLibrary" aria-label="Biblioteca de documentos na nuvem">
    <div className="documentsCloudBanner">
      <div className="documentsCloudMark"><Cloud size={22}/></div>
      <div className="documentsCloudCopy">
        <strong>Arquivos armazenados na nuvem</strong>
        <span>Comprovantes e documentos vinculados às vendas e compras do ERP.</span>
      </div>
      <button type="button" className="ghost documentsRefresh" onClick={() => void loadDocuments()} disabled={loading} aria-label="Atualizar lista de documentos">
        <RefreshCw size={16} className={loading ? 'documentsSpin' : ''}/><span>{loading ? 'Atualizando' : 'Atualizar'}</span>
      </button>
    </div>

    {error && <div className="documentsError" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}

    <div className="documentsStats">
      <article className="documentsStat">
        <span className="documentsStatIcon documentsStatBlue"><FolderOpen size={19}/></span>
        <div><small>Arquivos cadastrados</small><strong>{documents.length.toLocaleString('pt-BR')}</strong></div>
      </article>
      <article className="documentsStat">
        <span className="documentsStatIcon documentsStatGreen"><ReceiptText size={19}/></span>
        <div><small>Vinculados a vendas</small><strong>{salesCount.toLocaleString('pt-BR')}</strong></div>
      </article>
      <article className="documentsStat">
        <span className="documentsStatIcon documentsStatPurple"><ShoppingCart size={19}/></span>
        <div><small>Vinculados a compras</small><strong>{purchasesCount.toLocaleString('pt-BR')}</strong></div>
      </article>
      <article className="documentsStat">
        <span className="documentsStatIcon documentsStatAmber"><HardDrive size={19}/></span>
        <div><small>Espaço listado</small><strong>{formatSize(totalBytes)}</strong></div>
      </article>
    </div>

    <div className="documentsListPanel">
      <div className="documentsListHeading">
        <div><h2>Todos os documentos</h2><p>{loading ? 'Consultando armazenamento…' : `${filtered.length.toLocaleString('pt-BR')} de ${documents.length.toLocaleString('pt-BR')} arquivo(s)`}</p></div>
        <div className="documentsFilters">
          <label className="documentsSearch"><Search size={17}/><input aria-label="Pesquisar documentos" type="search" placeholder="Buscar por nome, venda ou compra…" value={search} onChange={event => setSearch(event.target.value)}/></label>
          <label className="documentsFilterSelect"><span>Filtrar</span><select aria-label="Filtrar documentos" value={filter} onChange={event => setFilter(event.target.value as DocumentFilter)}>
            <option value="todos">Todos os arquivos</option><option value="vendas">Vendas</option><option value="compras">Compras</option><option value="pdf">PDF</option><option value="imagens">Imagens</option><option value="outros">Outros formatos</option>
          </select></label>
        </div>
      </div>

      {loading && documents.length === 0 ? <div className="documentsEmpty"><RefreshCw size={23} className="documentsSpin"/><strong>Carregando documentos</strong><span>Buscando os arquivos registrados na nuvem do ERP.</span></div>
      : documents.length === 0 && !error ? <div className="documentsEmpty"><FolderOpen size={30}/><strong>Nenhum documento cadastrado ainda</strong><span>Os arquivos anexados às faturas de vendas e compras aparecerão aqui.</span></div>
      : filtered.length === 0 && !error ? <div className="documentsEmpty"><Search size={27}/><strong>Nenhum resultado encontrado</strong><span>Altere a pesquisa ou o filtro para ver outros arquivos.</span><button type="button" className="ghost" onClick={() => { setSearch(''); setFilter('todos') }}>Limpar filtros</button></div>
      : <div className="documentsTableWrap"><table className="documentsTable">
        <thead><tr><th>Documento</th><th>Origem</th><th>Data e tamanho</th><th><span className="documentsActionHeading">Ações</span></th></tr></thead>
        <tbody>{filtered.map(file => {
          const FileIcon = isImage(file) ? FileImage : isSpreadsheet(file) ? FileSpreadsheet : FileText
          const originLabel = file.venda_id ? 'Venda' : file.compra_id ? 'Compra' : 'Arquivo'
          const originId = file.venda_id || file.compra_id || file.id
          return <tr key={file.id}>
            <td><div className="documentsFileCell"><span className={`documentsFileIcon ${isPdf(file) ? 'isPdf' : isImage(file) ? 'isImage' : ''}`}><FileIcon size={20}/></span><span className="documentsFileDetails"><strong title={file.nome_arquivo}>{file.nome_arquivo || 'Documento sem nome'}</strong><small>{fileKind(file)}{file.mime_type ? ` · ${file.mime_type}` : ''}</small></span></div></td>
            <td><span className={`documentsOrigin ${file.venda_id ? 'sale' : file.compra_id ? 'purchase' : ''}`}>{originLabel}</span><small className="documentsOriginId" title={originId}>{originId ? `ID ${originId.slice(0, 8)}` : '—'}</small></td>
            <td><span className="documentsDate">{formatDate(file.created_at)}</span><small className="documentsSize">{formatSize(file.tamanho)}</small></td>
            <td><div className="documentsRowActions">
              <button type="button" className="documentsOpenAction" onClick={() => void openDocument(file)} disabled={openingId === file.id || downloadingId === file.id} aria-label={`Abrir ${file.nome_arquivo}`} title="Abrir documento">{openingId === file.id ? <RefreshCw size={15} className="documentsSpin"/> : <ExternalLink size={15}/>}<span>Abrir</span></button>
              <button type="button" className="documentsDownloadAction" onClick={() => void downloadDocument(file)} disabled={openingId === file.id || downloadingId === file.id} aria-label={`Baixar ${file.nome_arquivo}`} title="Baixar documento">{downloadingId === file.id ? <RefreshCw size={15} className="documentsSpin"/> : <Download size={15}/>}</button>
            </div></td>
          </tr>
        })}</tbody>
      </table></div>}
    </div>
    <p className="documentsSecurityNote"><Cloud size={15}/> Os arquivos são acessados com links temporários e respeitam as permissões do Financeiro.</p>
  </section>
}
