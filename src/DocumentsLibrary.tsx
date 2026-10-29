import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  AlertCircle, Archive, CheckCircle2, Cloud, Download, ExternalLink, FileImage,
  FileSpreadsheet, FileText, FolderOpen, HardDrive, RefreshCw, Search, ShoppingCart,
  ReceiptText, Upload, X
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { readAllRows } from './lib/readAllRows'

type DocumentCategory = 'fiscal' | 'financeiro' | 'contratos' | 'clientes' | 'fornecedores' | 'rh' | 'vendas' | 'compras' | 'geral'
type DocumentFilter = 'todos' | 'pdf' | 'imagens' | 'planilhas' | 'xml' | 'office' | 'zip-txt'
type OriginFilter = 'todos' | 'biblioteca' | 'vendas' | 'compras'
type DocumentSource = 'biblioteca' | 'comprovante'
type RawDocument = {
  id: string
  storage_path: string
  nome_arquivo: string
  mime_type: string | null
  tamanho: number | null
  created_at: string
  categoria?: DocumentCategory | null
  venda_id?: string | null
  compra_id?: string | null
  uploaded_by?: string | null
}
type CloudDocument = RawDocument & {
  source: DocumentSource
  bucket: 'documentos-empresa' | 'comprovantes-pagamento'
  category: DocumentCategory
  venda_id: string | null
  compra_id: string | null
}
type Props = { canEdit: boolean }

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const categories: { key: DocumentCategory; label: string; description: string }[] = [
  { key: 'fiscal', label: 'Fiscal', description: 'XML e documentos fiscais' },
  { key: 'financeiro', label: 'Financeiro', description: 'Contas, recibos e comprovantes' },
  { key: 'contratos', label: 'Contratos', description: 'Contratos e documentos assinados' },
  { key: 'clientes', label: 'Clientes', description: 'Cadastros e documentos de clientes' },
  { key: 'fornecedores', label: 'Fornecedores', description: 'Cadastros e documentos de fornecedores' },
  { key: 'rh', label: 'RH', description: 'Documentos internos de pessoal' },
  { key: 'vendas', label: 'Vendas', description: 'Documentos comerciais de vendas' },
  { key: 'compras', label: 'Compras', description: 'Pedidos e documentação de compras' },
  { key: 'geral', label: 'Geral', description: 'Arquivos diversos da empresa' },
]
const acceptedExtensions = new Set(['pdf','doc','docx','xls','xlsx','csv','xml','jpg','jpeg','png','webp','txt','zip'])
const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  xml: 'application/xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  txt: 'text/plain',
  zip: 'application/zip',
}
const acceptTypes = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.xml,.jpg,.jpeg,.png,.webp,.txt,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/xml,text/xml,image/jpeg,image/png,image/webp,text/plain,application/zip'
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
const extensionOf = (file: CloudDocument) => (file.nome_arquivo?.split('.').pop() || '').toLowerCase()
const isPdf = (file: CloudDocument) => file.mime_type?.toLowerCase().includes('pdf') || extensionOf(file) === 'pdf'
const isImage = (file: CloudDocument) => file.mime_type?.toLowerCase().startsWith('image/') || ['jpg','jpeg','png','webp'].includes(extensionOf(file))
const isSpreadsheet = (file: CloudDocument) => ['xls','xlsx','csv'].includes(extensionOf(file)) || Boolean(file.mime_type?.includes('spreadsheet') || file.mime_type?.includes('excel') || file.mime_type === 'text/csv')
const isXml = (file: CloudDocument) => extensionOf(file) === 'xml' || Boolean(file.mime_type?.includes('xml'))
const isOffice = (file: CloudDocument) => ['doc','docx'].includes(extensionOf(file))
const isArchiveOrText = (file: CloudDocument) => ['zip','txt'].includes(extensionOf(file))
const formatSize = (bytes: number | null) => {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return 'Tamanho não informado'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
}
const formatDate = (value: string) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
const fileKind = (file: CloudDocument) => isPdf(file) ? 'PDF' : isImage(file) ? 'Imagem' : isSpreadsheet(file) ? 'Planilha' : isXml(file) ? 'XML fiscal' : isOffice(file) ? 'Documento Office' : isArchiveOrText(file) ? (extensionOf(file).toUpperCase() || 'Arquivo') : (extensionOf(file).toUpperCase() || 'Arquivo')
const categoryLabel = (category: string) => categories.find(item => item.key === category)?.label || category
const safeFileName = (name: string) => {
  const value = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 180)
  return value || 'documento'
}
const totalSize = (documents: CloudDocument[]) => documents.reduce((sum, file) => sum + Math.max(0, Number(file.tamanho) || 0), 0)

function mapLibraryDocument(raw: RawDocument): CloudDocument {
  const category = raw.categoria || 'geral'
  return { ...raw, category, source: 'biblioteca', bucket: 'documentos-empresa', venda_id: raw.venda_id || null, compra_id: raw.compra_id || null }
}
function mapProofDocument(raw: RawDocument): CloudDocument {
  const category: DocumentCategory = raw.venda_id ? 'vendas' : 'compras'
  return { ...raw, category, source: 'comprovante', bucket: 'comprovantes-pagamento', venda_id: raw.venda_id || null, compra_id: raw.compra_id || null }
}

export function DocumentsLibrary({ canEdit }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<CloudDocument[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'todos' | DocumentCategory>('todos')
  const [originFilter, setOriginFilter] = useState<OriginFilter>('todos')
  const [typeFilter, setTypeFilter] = useState<DocumentFilter>('todos')
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('geral')
  const [loading, setLoading] = useState(true)
  const [libraryReady, setLibraryReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  async function loadDocuments(silent = false) {
    if (!silent) setLoading(true)
    setError('')
    setNotice('')
    try {
      const [libraryResult, proofResult] = await Promise.all([
        readAllRows<RawDocument>((from, to) =>
          supabase.from('documentos_empresa').select('*')
            .order('created_at', { ascending: false }).order('id').range(from, to)
        ),
        readAllRows<RawDocument>((from, to) =>
          supabase.from('comprovantes_pagamento').select('*')
            .order('created_at', { ascending: false }).order('id').range(from, to)
        ),
      ])
      const libraryAvailable = !libraryResult.error
      setLibraryReady(libraryAvailable)
      if (libraryResult.error) {
        setNotice('A estrutura de pastas da biblioteca ainda não foi ativada no banco de dados. Os comprovantes já existentes continuam disponíveis; o envio geral será liberado após aplicar a migração do módulo.')
      }
      if (proofResult.error && libraryResult.error) {
        setError('Não foi possível consultar os arquivos da nuvem. Verifique seu acesso ao Financeiro e tente novamente.')
        setDocuments([])
        return
      }
      if (proofResult.error) setNotice('Os documentos gerais estão disponíveis, mas não foi possível listar os comprovantes vinculados a vendas e compras.')
      setDocuments([
        ...((libraryResult.data || []) as RawDocument[]).map(mapLibraryDocument),
        ...((proofResult.data || []) as RawDocument[]).map(mapProofDocument),
      ].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
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
      const origin = file.venda_id ? 'venda' : file.compra_id ? 'compra' : 'biblioteca'
      const searchable = normalize([file.nome_arquivo, file.mime_type || '', file.storage_path, file.category, origin, file.venda_id || '', file.compra_id || ''].join(' '))
      const matchesSearch = !term || searchable.includes(term)
      const matchesCategory = categoryFilter === 'todos' || file.category === categoryFilter
      const matchesOrigin = originFilter === 'todos' ||
        (originFilter === 'biblioteca' && file.source === 'biblioteca') ||
        (originFilter === 'vendas' && Boolean(file.venda_id)) ||
        (originFilter === 'compras' && Boolean(file.compra_id))
      const matchesType =
        typeFilter === 'todos' ||
        (typeFilter === 'pdf' && isPdf(file)) ||
        (typeFilter === 'imagens' && isImage(file)) ||
        (typeFilter === 'planilhas' && isSpreadsheet(file)) ||
        (typeFilter === 'xml' && isXml(file)) ||
        (typeFilter === 'office' && isOffice(file)) ||
        (typeFilter === 'zip-txt' && isArchiveOrText(file))
      return matchesSearch && matchesCategory && matchesOrigin && matchesType
    })
  }, [documents, search, categoryFilter, originFilter, typeFilter])

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    if (!canEdit) {
      setError('Sua conta possui acesso somente para visualização. Peça ao administrador a permissão de edição do Financeiro.')
      return
    }
    if (!libraryReady) {
      setError('A biblioteca de documentos ainda não está ativada no banco de dados. Aplique primeiro a migração do módulo.')
      return
    }
    const invalid: string[] = []
    for (const file of files) {
      const extension = (file.name.split('.').pop() || '').toLowerCase()
      if (!acceptedExtensions.has(extension)) invalid.push(`${file.name}: formato não permitido`)
      else if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) invalid.push(`${file.name}: o limite é 25 MB por arquivo`)
    }
    if (invalid.length) {
      setError(`Revise os arquivos selecionados. ${invalid.slice(0,4).join('; ')}${invalid.length > 4 ? `; e mais ${invalid.length - 4} arquivo(s)` : ''}.`)
      return
    }

    setUploading(true)
    setError('')
    setNotice('')
    let uploaded = 0
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        setError('Sua sessão expirou. Entre novamente para enviar documentos.')
        return
      }
      const now = new Date()
      const year = String(now.getFullYear())
      const month = String(now.getMonth() + 1).padStart(2, '0')
      for (const [index, file] of files.entries()) {
        setUploadProgress(`Enviando ${index + 1} de ${files.length}: ${file.name}`)
        const extension = (file.name.split('.').pop() || '').toLowerCase()
        const mimeType = mimeByExtension[extension] || 'application/octet-stream'
        const path = `${uploadCategory}/${year}/${month}/${crypto.randomUUID()}.${extension}`
        const upload = await supabase.storage.from('documentos-empresa').upload(path, file, {
          contentType: mimeType,
          upsert: false,
        })
        if (upload.error) {
          setError(`Falha ao enviar "${file.name}": ${upload.error.message}`)
          break
        }
        const metadata = await supabase.from('documentos_empresa').insert({
          nome_arquivo: file.name,
          categoria: uploadCategory,
          storage_path: path,
          mime_type: mimeType,
          tamanho: file.size,
          uploaded_by: userData.user.id,
        })
        if (metadata.error) {
          await supabase.storage.from('documentos-empresa').remove([path])
          setError(`O arquivo "${file.name}" foi enviado, mas não pôde ser registrado. ${metadata.error.message}`)
          break
        }
        uploaded += 1
      }
      if (uploaded) {
        setNotice(uploaded === files.length
          ? `${uploaded} arquivo(s) enviado(s) e organizado(s) na pasta ${categoryLabel(uploadCategory)}.`
          : `${uploaded} arquivo(s) enviado(s). Os demais não foram concluídos; confira o aviso.`)
        await loadDocuments(true)
      }
    } catch {
      setError('Não foi possível concluir o envio. Confira a conexão e tente novamente.')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  async function openDocument(file: CloudDocument) {
    const tab = window.open('about:blank', '_blank')
    if (!tab) {
      setError('O navegador bloqueou a nova janela. Permita pop-ups para abrir o documento.')
      return
    }
    tab.opener = null
    setOpeningId(file.id)
    setError('')
    try {
      const { data, error: storageError } = await supabase.storage.from(file.bucket).createSignedUrl(file.storage_path, 300)
      if (storageError || !data?.signedUrl) {
        tab.close()
        setError('Não foi possível abrir este arquivo. Verifique se ele ainda existe na nuvem.')
        return
      }
      tab.location.href = data.signedUrl
    } catch {
      tab.close()
      setError('Não foi possível abrir este arquivo. Tente novamente.')
    } finally {
      setOpeningId(null)
    }
  }

  async function downloadDocument(file: CloudDocument) {
    setDownloadingId(file.id)
    setError('')
    try {
      const { data, error: storageError } = await supabase.storage.from(file.bucket).download(file.storage_path)
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

  const libraryDocuments = documents.filter(file => file.source === 'biblioteca')
  const salesCount = documents.filter(file => Boolean(file.venda_id)).length
  const purchasesCount = documents.filter(file => Boolean(file.compra_id)).length
  const totalBytes = totalSize(documents)

  return <section className="documentsLibrary" aria-label="Biblioteca de documentos na nuvem">
    <div className="documentsCloudBanner">
      <div className="documentsCloudMark"><Cloud size={22}/></div>
      <div className="documentsCloudCopy">
        <strong>Biblioteca de documentos da empresa</strong>
        <span>Envie, organize, pesquise e baixe arquivos em pastas por categoria.</span>
      </div>
      {canEdit && <><input ref={fileInput} className="documentsFileInput" type="file" accept={acceptTypes} multiple onChange={event => void uploadFiles(event)} disabled={uploading || !libraryReady} aria-label="Selecionar arquivos para enviar"/><button type="button" className="primary documentsUploadButton" onClick={() => fileInput.current?.click()} disabled={uploading || !libraryReady}><Upload size={16}/><span>{uploading ? 'Enviando arquivos…' : 'Enviar documentos'}</span></button></>}
      <button type="button" className="ghost documentsRefresh" onClick={() => void loadDocuments()} disabled={loading || uploading} aria-label="Atualizar lista de documentos">
        <RefreshCw size={16} className={loading ? 'documentsSpin' : ''}/><span>{loading ? 'Atualizando' : 'Atualizar'}</span>
      </button>
    </div>

    {!libraryReady && !loading && <div className="documentsWarning" role="status"><AlertCircle size={17}/><span>O banco ainda precisa receber a migração da biblioteca para liberar pastas e novos envios. Os comprovantes já existentes podem continuar aparecendo abaixo.</span></div>}
    {error && <div className="documentsError" role="alert"><AlertCircle size={17}/><span>{error}</span><button type="button" className="documentsDismiss" onClick={() => setError('')} aria-label="Fechar aviso"><X size={15}/></button></div>}
    {notice && <div className="documentsSuccess" role="status"><CheckCircle2 size={17}/><span>{notice}</span></div>}

    {canEdit && libraryReady && <div className="documentsUploadOptions">
      <div className="documentsUploadIntro"><strong>Salvar na pasta</strong><span>Todos os arquivos selecionados serão organizados nesta categoria.</span></div>
      <label className="documentsCategoryChoice"><FolderOpen size={17}/><span>Categoria</span><select value={uploadCategory} onChange={event => setUploadCategory(event.target.value as DocumentCategory)} disabled={uploading}>{categories.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}</select></label>
      <span className="documentsUploadLimit">PDF, DOC/DOCX, XLS/XLSX, CSV, XML, JPG/PNG/WEBP, TXT e ZIP · Máx. 25 MB por arquivo</span>
      {uploading && <span className="documentsUploadProgress" role="status"><RefreshCw size={14} className="documentsSpin"/>{uploadProgress}</span>}
    </div>}

    <div className="documentsStats">
      <article className="documentsStat"><span className="documentsStatIcon documentsStatBlue"><FolderOpen size={19}/></span><div><small>Total de arquivos</small><strong>{documents.length.toLocaleString('pt-BR')}</strong></div></article>
      <article className="documentsStat"><span className="documentsStatIcon documentsStatGreen"><ReceiptText size={19}/></span><div><small>Vinculados a vendas</small><strong>{salesCount.toLocaleString('pt-BR')}</strong></div></article>
      <article className="documentsStat"><span className="documentsStatIcon documentsStatPurple"><ShoppingCart size={19}/></span><div><small>Vinculados a compras</small><strong>{purchasesCount.toLocaleString('pt-BR')}</strong></div></article>
      <article className="documentsStat"><span className="documentsStatIcon documentsStatAmber"><HardDrive size={19}/></span><div><small>Espaço listado</small><strong>{formatSize(totalBytes)}</strong></div></article>
    </div>

    <div className="documentsFolderHeading"><div><h2>Pastas da empresa</h2><p>Escolha uma categoria para filtrar os arquivos.</p></div><div className="documentsFolderChips"><button type="button" className={categoryFilter === 'todos' ? 'active' : ''} onClick={() => setCategoryFilter('todos')}><FolderOpen size={14}/>Todas</button>{categories.map(category => <button key={category.key} type="button" className={categoryFilter === category.key ? 'active' : ''} onClick={() => setCategoryFilter(category.key)} title={category.description}><FolderOpen size={14}/>{category.label}{categoryFilter === category.key && <span>{documents.filter(file => file.category === category.key).length}</span>}</button>)}</div></div>

    <div className="documentsListPanel">
      <div className="documentsListHeading">
        <div><h2>Arquivos na nuvem</h2><p>{loading ? 'Consultando armazenamento…' : `${filtered.length.toLocaleString('pt-BR')} de ${documents.length.toLocaleString('pt-BR')} arquivo(s)`}{!loading && libraryDocuments.length > 0 ? ` · ${libraryDocuments.length} na biblioteca` : ''}</p></div>
        <div className="documentsFilters">
          <label className="documentsSearch"><Search size={17}/><input aria-label="Pesquisar documentos" type="search" placeholder="Buscar nome, pasta, venda ou compra…" value={search} onChange={event => setSearch(event.target.value)}/></label>
          <label className="documentsFilterSelect"><span>Origem</span><select aria-label="Filtrar origem dos documentos" value={originFilter} onChange={event => setOriginFilter(event.target.value as OriginFilter)}><option value="todos">Tudo</option><option value="biblioteca">Biblioteca</option><option value="vendas">Vendas</option><option value="compras">Compras</option></select></label>
          <label className="documentsFilterSelect"><span>Tipo</span><select aria-label="Filtrar tipo de arquivo" value={typeFilter} onChange={event => setTypeFilter(event.target.value as DocumentFilter)}><option value="todos">Todos</option><option value="pdf">PDF</option><option value="office">DOC/DOCX</option><option value="planilhas">Planilhas/CSV</option><option value="xml">XML</option><option value="imagens">Imagens</option><option value="zip-txt">ZIP/TXT</option></select></label>
        </div>
      </div>

      {loading && documents.length === 0 ? <div className="documentsEmpty"><RefreshCw size={23} className="documentsSpin"/><strong>Carregando documentos</strong><span>Buscando os arquivos registrados na nuvem do ERP.</span></div>
      : documents.length === 0 && !error ? <div className="documentsEmpty"><FolderOpen size={30}/><strong>Nenhum documento cadastrado ainda</strong><span>Envie o primeiro arquivo para começar a montar a biblioteca da empresa.</span></div>
      : filtered.length === 0 && !error ? <div className="documentsEmpty"><Search size={27}/><strong>Nenhum resultado encontrado</strong><span>Altere a pesquisa, a origem ou a categoria para ver outros arquivos.</span><button type="button" className="ghost" onClick={() => { setSearch(''); setCategoryFilter('todos'); setOriginFilter('todos'); setTypeFilter('todos') }}>Limpar filtros</button></div>
      : <div className="documentsTableWrap"><table className="documentsTable">
        <thead><tr><th>Documento</th><th>Pasta / Origem</th><th>Data e tamanho</th><th><span className="documentsActionHeading">Ações</span></th></tr></thead>
        <tbody>{filtered.map(file => {
          const FileIcon = isImage(file) ? FileImage : isSpreadsheet(file) ? FileSpreadsheet : isArchiveOrText(file) ? Archive : FileText
          const originLabel = file.venda_id ? 'Venda' : file.compra_id ? 'Compra' : 'Biblioteca'
          const originId = file.venda_id || file.compra_id
          return <tr key={`${file.source}:${file.id}`}>
            <td><div className="documentsFileCell"><span className={`documentsFileIcon ${isPdf(file) ? 'isPdf' : isImage(file) ? 'isImage' : ''}`}><FileIcon size={20}/></span><span className="documentsFileDetails"><strong title={file.nome_arquivo}>{file.nome_arquivo || 'Documento sem nome'}</strong><small>{fileKind(file)}{file.mime_type ? ` · ${file.mime_type}` : ''}</small></span></div></td>
            <td><span className={`documentsOrigin ${file.venda_id ? 'sale' : file.compra_id ? 'purchase' : ''}`}>{file.source === 'biblioteca' ? categoryLabel(file.category) : originLabel}</span><small className="documentsOriginId" title={originId || file.storage_path}>{originId ? `ID ${originId.slice(0, 8)}` : file.storage_path.split('/').slice(0,3).join('/')}</small></td>
            <td><span className="documentsDate">{formatDate(file.created_at)}</span><small className="documentsSize">{formatSize(file.tamanho)}</small></td>
            <td><div className="documentsRowActions">
              <button type="button" className="documentsOpenAction" onClick={() => void openDocument(file)} disabled={openingId === file.id || downloadingId === file.id} aria-label={`Abrir ${file.nome_arquivo}`} title="Abrir documento">{openingId === file.id ? <RefreshCw size={15} className="documentsSpin"/> : <ExternalLink size={15}/>}<span>Abrir</span></button>
              <button type="button" className="documentsDownloadAction" onClick={() => void downloadDocument(file)} disabled={openingId === file.id || downloadingId === file.id} aria-label={`Baixar ${file.nome_arquivo}`} title="Baixar documento">{downloadingId === file.id ? <RefreshCw size={15} className="documentsSpin"/> : <Download size={15}/>}</button>
            </div></td>
          </tr>
        })}</tbody>
      </table></div>}
    </div>
    <p className="documentsSecurityNote"><Cloud size={15}/> O bucket é privado; abertura e download usam as permissões do Financeiro e links temporários.</p>
  </section>
}
