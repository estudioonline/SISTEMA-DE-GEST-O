import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  AlertCircle, BellRing, CalendarClock, ChevronRight, Cloud, Download, ExternalLink, FileImage, FileSpreadsheet,
  FileText, FolderOpen, FolderPlus, HardDrive, MoreVertical, Pencil, RefreshCw, Search, ShoppingCart, ReceiptText, Trash2, Upload
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
  folder_id: string | null
  data_vencimento: string | null
  alerta_dias: number
}
type DocumentFolder = {
  id: string
  nome: string
  parent_id: string | null
  created_at: string
}
type DocumentFilter = 'todos' | 'vendas' | 'compras' | 'pdf' | 'imagens' | 'outros'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
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

export function DocumentsLibrary({ canEdit = false }: { canEdit?: boolean }) {
  const [documents, setDocuments] = useState<CloudDocument[]>([])
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null)
  const [folderDialog, setFolderDialog] = useState<{mode:'create'|'rename'|'move';folderId?:string}|null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderParentId, setFolderParentId] = useState<string>('root')
  const [savingFolder, setSavingFolder] = useState(false)
  const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DocumentFilter>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [expiryDialog, setExpiryDialog] = useState<CloudDocument | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryDays, setExpiryDays] = useState('5')
  const [savingExpiry, setSavingExpiry] = useState(false)

  async function loadDocuments() {
    setLoading(true)
    setError('')
    try {
      const [result, folderResult] = await Promise.all([
        readAllRows<CloudDocument>((from, to) =>
          supabase.from('comprovantes_pagamento').select('*')
            .order('created_at', { ascending: false }).order('id').range(from, to)
        ),
        readAllRows<DocumentFolder>((from, to) =>
          supabase.from('documentos_pastas').select('id,nome,parent_id,created_at')
            .order('nome', { ascending: true }).order('id').range(from, to)
        )
      ])
      if (result.error || folderResult.error) {
        setError('Não foi possível carregar os documentos e pastas. Confirme seu acesso ao Financeiro e tente novamente.')
        return
      }
      setDocuments((result.data || []) as CloudDocument[])
      setFolders((folderResult.data || []) as DocumentFolder[])
    } catch {
      setError('Ocorreu um erro ao consultar os documentos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadDocuments() }, [])

  const currentFolder = currentFolderId ? folders.find(folder => folder.id === currentFolderId) || null : null
  const childFolders = useMemo(() => folders.filter(folder => folder.parent_id === currentFolderId), [folders, currentFolderId])
  const breadcrumb = useMemo(() => {
    const path: DocumentFolder[] = []
    let cursor = currentFolder
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id)
      path.unshift(cursor)
      cursor = cursor.parent_id ? folders.find(folder => folder.id === cursor?.parent_id) || null : null
    }
    return path
  }, [folders, currentFolder])

  const filtered = useMemo(() => {
    const term = normalize(search)
    return documents.filter(file => {
      if (file.folder_id !== currentFolderId) return false
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
  }, [documents, search, filter, currentFolderId])

  function openCreateFolder() {
    if (!canEdit) return
    setFolderName('')
    setFolderParentId(currentFolderId || 'root')
    setFolderDialog({ mode:'create' })
  }

  function openRenameFolder(folder: DocumentFolder) {
    if (!canEdit) return
    setFolderName(folder.nome)
    setFolderParentId(folder.parent_id || 'root')
    setFolderDialog({ mode:'rename', folderId:folder.id })
    setFolderMenuId(null)
  }

  function openMoveFolder(folder: DocumentFolder) {
    if (!canEdit) return
    setFolderName(folder.nome)
    setFolderParentId(folder.parent_id || 'root')
    setFolderDialog({ mode:'move', folderId:folder.id })
    setFolderMenuId(null)
  }

  async function submitFolderDialog() {
    if (!folderDialog || savingFolder || !canEdit) return
    setSavingFolder(true)
    setError('')
    try {
      if (folderDialog.mode === 'create') {
        const { error: rpcError } = await supabase.rpc('documentos_criar_pasta', {
          p_nome: folderName.trim(),
          p_parent_id: folderParentId === 'root' ? null : folderParentId
        })
        if (rpcError) throw rpcError
      } else if (folderDialog.mode === 'rename' && folderDialog.folderId) {
        const { error: rpcError } = await supabase.rpc('documentos_renomear_pasta', {
          p_id: folderDialog.folderId,
          p_nome: folderName.trim()
        })
        if (rpcError) throw rpcError
      } else if (folderDialog.mode === 'move' && folderDialog.folderId) {
        const { error: rpcError } = await supabase.rpc('documentos_mover_pasta', {
          p_id: folderDialog.folderId,
          p_parent_id: folderParentId === 'root' ? null : folderParentId
        })
        if (rpcError) throw rpcError
      }
      setFolderDialog(null)
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a pasta.')
    } finally {
      setSavingFolder(false)
    }
  }

  async function deleteFolder(folder: DocumentFolder) {
    if (!canEdit) return
    if (!window.confirm(`Excluir a pasta "${folder.nome}"? Ela precisa estar vazia.`)) return
    setError('')
    const { error: rpcError } = await supabase.rpc('documentos_excluir_pasta', { p_id: folder.id })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    if (currentFolderId === folder.id) setCurrentFolderId(folder.parent_id)
    setFolderMenuId(null)
    await loadDocuments()
  }

  async function moveDocument(file: CloudDocument, folderId: string | null) {
    if (!canEdit || movingDocumentId) return
    setMovingDocumentId(file.id)
    setError('')
    const { error: rpcError } = await supabase.rpc('documentos_mover_arquivo', {
      p_documento_id: file.id,
      p_folder_id: folderId
    })
    setMovingDocumentId(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await loadDocuments()
  }

  const allowedFolderTargets = (folderId?: string) => {
    if (!folderId) return folders
    const blocked = new Set<string>([folderId])
    let changed = true
    while (changed) {
      changed = false
      for (const folder of folders) {
        if (folder.parent_id && blocked.has(folder.parent_id) && !blocked.has(folder.id)) {
          blocked.add(folder.id)
          changed = true
        }
      }
    }
    return folders.filter(folder => !blocked.has(folder.id))
  }

  async function uploadLibraryDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canEdit || uploading) return

    const allowed = new Set([
      'application/pdf',
      'image/jpeg','image/png','image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ])
    if (!allowed.has(file.type)) {
      setError('Formato não permitido. Use PDF, JPG, PNG, WEBP, Excel, CSV, Word ou TXT.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo deve ter no máximo 10 MB.')
      return
    }

    setUploading(true)
    setError('')
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g,'') || 'bin'
    const location = currentFolderId || 'sem-pasta'
    const path = `biblioteca/${location}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    try {
      const upload = await supabase.storage.from('comprovantes-pagamento').upload(path, file, {
        contentType: file.type,
        upsert: false
      })
      if (upload.error) throw new Error('Falha ao enviar arquivo: ' + upload.error.message)

      const meta = await supabase.from('comprovantes_pagamento').insert({
        venda_id: null,
        compra_id: null,
        folder_id: currentFolderId,
        storage_path: path,
        nome_arquivo: file.name,
        mime_type: file.type,
        tamanho: file.size
      })
      if (meta.error) {
        await supabase.storage.from('comprovantes-pagamento').remove([path])
        throw new Error('Falha ao registrar arquivo: ' + meta.error.message)
      }

      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o arquivo.')
    } finally {
      setUploading(false)
    }
  }

  const expiryInfo = (file: CloudDocument) => {
    if (!file.data_vencimento) return { kind:'none' as const, label:'Sem vencimento', days:null as number|null }
    const today = new Date()
    today.setHours(12,0,0,0)
    const due = new Date(file.data_vencimento + 'T12:00:00')
    const days = Math.ceil((due.getTime() - today.getTime()) / 86400000)
    if (days < 0) return { kind:'expired' as const, label:`Vencido em ${new Intl.DateTimeFormat('pt-BR').format(due)}`, days }
    if (days === 0) return { kind:'today' as const, label:'Vence hoje', days }
    if (days <= Number(file.alerta_dias ?? 5)) return { kind:'warning' as const, label:`Vence em ${days} dia${days===1?'':'s'} · ${new Intl.DateTimeFormat('pt-BR').format(due)}`, days }
    return { kind:'ok' as const, label:`Vence em ${new Intl.DateTimeFormat('pt-BR').format(due)}`, days }
  }

  const expiringDocuments = documents.filter(file => {
    const info = expiryInfo(file)
    return info.kind === 'expired' || info.kind === 'today' || info.kind === 'warning'
  })

  function openExpiryDialog(file: CloudDocument) {
    if (!canEdit) return
    setExpiryDialog(file)
    setExpiryDate(file.data_vencimento || '')
    setExpiryDays(String(file.alerta_dias ?? 5))
  }

  async function saveExpiry() {
    if (!expiryDialog || !canEdit || savingExpiry) return
    const days = Math.max(0, Math.min(365, Number(expiryDays || 5)))
    setSavingExpiry(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('documentos_definir_vencimento', {
      p_documento_id: expiryDialog.id,
      p_data_vencimento: expiryDate || null,
      p_alerta_dias: days
    })
    setSavingExpiry(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setExpiryDialog(null)
    await loadDocuments()
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
      const { data, error: storageError } = await supabase.storage
        .from('comprovantes-pagamento').createSignedUrl(file.storage_path, 300)
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
    {expiringDocuments.length>0&&<div className="documentsExpiryAlert" role="status">
      <BellRing size={18}/>
      <div><strong>{expiringDocuments.length} documento(s) com vencimento próximo ou vencido</strong>
      <span>{expiringDocuments.slice(0,3).map(file=>`${file.nome_arquivo} — ${expiryInfo(file).label}`).join(' · ')}{expiringDocuments.length>3?' · …':''}</span></div>
    </div>}

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
      <div className="documentsFolderBar">
        <nav className="documentsBreadcrumb" aria-label="Caminho das pastas">
          <button type="button" className={!currentFolderId?'active':''} onClick={()=>setCurrentFolderId(null)}><FolderOpen size={15}/>Documentos</button>
          {breadcrumb.map(folder=><span key={folder.id}><ChevronRight size={14}/><button type="button" className={folder.id===currentFolderId?'active':''} onClick={()=>setCurrentFolderId(folder.id)}>{folder.nome}</button></span>)}
        </nav>
        {canEdit&&<div className="documentsFolderActions">
          <label className="ghost documentsUploadButton" aria-disabled={uploading}>
            <Upload size={16}/><span>{uploading?'Carregando...':'Carregar arquivo'}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.doc,.docx,.txt" disabled={uploading} onChange={event=>void uploadLibraryDocument(event)}/>
          </label>
          <button type="button" className="primary documentsNewFolder" onClick={openCreateFolder}><FolderPlus size={16}/>Nova pasta</button>
        </div>}
      </div>

      {childFolders.length>0&&<div className="documentsFolderGrid">
        {childFolders.map(folder=><article key={folder.id} className="documentsFolderCard" onDoubleClick={()=>setCurrentFolderId(folder.id)}>
          <button type="button" className="documentsFolderOpen" onClick={()=>setCurrentFolderId(folder.id)}>
            <span className="documentsFolderIcon"><FolderOpen size={21}/></span>
            <span><strong>{folder.nome}</strong><small>{folders.filter(row=>row.parent_id===folder.id).length} subpasta(s) · {documents.filter(file=>file.folder_id===folder.id).length} arquivo(s)</small></span>
          </button>
          {canEdit&&<div className="documentsFolderMenuWrap">
            <button type="button" className="documentsFolderMenuBtn" onClick={()=>setFolderMenuId(folderMenuId===folder.id?null:folder.id)} aria-label={`Ações da pasta ${folder.nome}`}><MoreVertical size={17}/></button>
            {folderMenuId===folder.id&&<div className="documentsFolderMenu">
              <button type="button" onClick={()=>openRenameFolder(folder)}><Pencil size={14}/>Renomear</button>
              <button type="button" onClick={()=>openMoveFolder(folder)}><FolderOpen size={14}/>Mover</button>
              <button type="button" className="danger" onClick={()=>void deleteFolder(folder)}><Trash2 size={14}/>Excluir</button>
            </div>}
          </div>}
        </article>)}
      </div>}

      <div className="documentsListHeading">
        <div><h2>{currentFolder?.nome||'Arquivos sem pasta'}</h2><p>{loading ? 'Consultando armazenamento…' : `${filtered.length.toLocaleString('pt-BR')} arquivo(s) nesta pasta`}</p></div>
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
        <thead><tr><th>Documento</th><th>Origem</th><th>Data e tamanho</th><th>Vencimento</th><th><span className="documentsActionHeading">Ações</span></th></tr></thead>
        <tbody>{filtered.map(file => {
          const FileIcon = isImage(file) ? FileImage : isSpreadsheet(file) ? FileSpreadsheet : FileText
          const originLabel = file.venda_id ? 'Venda' : file.compra_id ? 'Compra' : 'Arquivo'
          const originId = file.venda_id || file.compra_id || file.id
          return <tr key={file.id}>
            <td><div className="documentsFileCell"><span className={`documentsFileIcon ${isPdf(file) ? 'isPdf' : isImage(file) ? 'isImage' : ''}`}><FileIcon size={20}/></span><span className="documentsFileDetails"><strong title={file.nome_arquivo}>{file.nome_arquivo || 'Documento sem nome'}</strong><small>{fileKind(file)}{file.mime_type ? ` · ${file.mime_type}` : ''}</small></span></div></td>
            <td><span className={`documentsOrigin ${file.venda_id ? 'sale' : file.compra_id ? 'purchase' : ''}`}>{originLabel}</span><small className="documentsOriginId" title={originId}>{originId ? `ID ${originId.slice(0, 8)}` : '—'}</small></td>
            <td><span className="documentsDate">{formatDate(file.created_at)}</span><small className="documentsSize">{formatSize(file.tamanho)}</small></td>
            <td><button type="button" className={`documentsExpiryBadge expiry-${expiryInfo(file).kind}`} onClick={()=>canEdit&&openExpiryDialog(file)} title={canEdit?'Editar vencimento':'Vencimento do documento'}><CalendarClock size={13}/><span>{expiryInfo(file).label}</span></button></td>
            <td><div className="documentsRowActions">
              <button type="button" className="documentsOpenAction" onClick={() => void openDocument(file)} disabled={openingId === file.id || downloadingId === file.id} aria-label={`Abrir ${file.nome_arquivo}`} title="Abrir documento">{openingId === file.id ? <RefreshCw size={15} className="documentsSpin"/> : <ExternalLink size={15}/>}<span>Abrir</span></button>
              <button type="button" className="documentsDownloadAction" onClick={() => void downloadDocument(file)} disabled={openingId === file.id || downloadingId === file.id} aria-label={`Baixar ${file.nome_arquivo}`} title="Baixar documento">{downloadingId === file.id ? <RefreshCw size={15} className="documentsSpin"/> : <Download size={15}/>}</button>
              {canEdit&&<select className="documentsMoveSelect" aria-label={`Mover ${file.nome_arquivo}`} value={file.folder_id||'root'} disabled={movingDocumentId===file.id} onChange={event=>void moveDocument(file,event.target.value==='root'?null:event.target.value)}>
                <option value="root">Sem pasta</option>
                {folders.map(folder=><option key={folder.id} value={folder.id}>{folder.nome}</option>)}
              </select>}
            </div></td>
          </tr>
        })}</tbody>
      </table></div>}
    </div>
    {expiryDialog&&<div className="documentsFolderDialogOverlay" role="dialog" aria-modal="true" aria-label="Vencimento do documento">
      <div className="documentsFolderDialog">
        <div><strong>Vencimento do documento</strong><span>{expiryDialog.nome_arquivo}</span></div>
        <label>Data de vencimento<input type="date" value={expiryDate} onChange={event=>setExpiryDate(event.target.value)}/></label>
        <label>Avisar com antecedência<input type="number" min="0" max="365" value={expiryDays} onChange={event=>setExpiryDays(event.target.value)}/><small className="documentsDialogHint">Padrão: 5 dias antes. Use 0 para avisar somente no dia.</small></label>
        <div className="documentsFolderDialogActions">
          {expiryDate&&<button type="button" className="ghost" disabled={savingExpiry} onClick={()=>{setExpiryDate('');setExpiryDays('5')}}>Remover vencimento</button>}
          <button type="button" className="ghost" disabled={savingExpiry} onClick={()=>setExpiryDialog(null)}>Cancelar</button>
          <button type="button" className="primary" disabled={savingExpiry} onClick={()=>void saveExpiry()}>{savingExpiry?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>}

    {folderDialog&&<div className="documentsFolderDialogOverlay" role="dialog" aria-modal="true" aria-label="Editar pasta">
      <div className="documentsFolderDialog">
        <div>
          <strong>{folderDialog.mode==='create'?'Nova pasta':folderDialog.mode==='rename'?'Renomear pasta':'Mover pasta'}</strong>
          <span>{folderDialog.mode==='create'?'A pasta será criada no local atual.':folderDialog.mode==='rename'?'Altere o nome da pasta selecionada.':'Escolha a nova pasta superior.'}</span>
        </div>
        {folderDialog.mode!=='move'&&<label>Nome da pasta<input autoFocus value={folderName} maxLength={120} onChange={event=>setFolderName(event.target.value)} placeholder="Ex.: Financeiro, Contratos, 2026..."/></label>}
        {folderDialog.mode==='move'&&<label>Destino<select value={folderParentId} onChange={event=>setFolderParentId(event.target.value)}>
          <option value="root">Documentos (raiz)</option>
          {allowedFolderTargets(folderDialog.folderId).map(folder=><option key={folder.id} value={folder.id}>{folder.nome}</option>)}
        </select></label>}
        <div className="documentsFolderDialogActions">
          <button type="button" className="ghost" disabled={savingFolder} onClick={()=>setFolderDialog(null)}>Cancelar</button>
          <button type="button" className="primary" disabled={savingFolder||(folderDialog.mode!=='move'&&!folderName.trim())} onClick={()=>void submitFolderDialog()}>{savingFolder?'Salvando...':'Salvar'}</button>
        </div>
      </div>
    </div>}

    <p className="documentsSecurityNote"><Cloud size={15}/> Os arquivos são acessados com links temporários e respeitam as permissões do Financeiro.</p>
  </section>
}
