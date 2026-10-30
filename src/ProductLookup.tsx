import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import './product-lookup.css'

type LookupProduct = {
  id: string
  codigo: string
  descricao: string
  unidade: string
  preco_venda: number
  estoque_atual: number
  ativo: boolean
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const currency = (value: number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ProductLookup({ products, value, onSelect }: {
  products: LookupProduct[]
  value: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(60)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const resultsId = useId()
  const results = useMemo(() => {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
    return products.filter(product => product.ativo && terms.every(term =>
      normalize(`${product.codigo} ${product.descricao}`).includes(term)))
  }, [products, query])

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  useEffect(() => {
    if (open) search.current?.focus()
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Portal events must not reach the budget form underneath the search dialog.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown' && event.target === search.current) {
      event.preventDefault()
      dialog.current?.querySelector<HTMLButtonElement>('.productLookupResult')?.focus()
    } else if (event.key === 'Tab') {
      const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input')
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && event.target === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && event.target === last) {
        event.preventDefault()
        first.focus()
      }
    } else if (event.key === 'Enter' && event.target === search.current) {
      event.preventDefault()
      if (results.length === 1) {
        onSelect(results[0].id)
        close()
      } else {
        dialog.current?.querySelector<HTMLButtonElement>('.productLookupResult')?.focus()
      }
    }
  }

  return <>
    <button ref={trigger} type="button" className="iconBtn productLookupTrigger"
      title="Pesquisar produto" aria-label="Pesquisar produto" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => {
        setDark(Boolean(trigger.current?.closest('.dark')))
        setQuery('')
        setLimit(60)
        setOpen(true)
      }}><Search size={18}/></button>
    {open && createPortal(<div className={`productLookupOverlay${dark ? ' dark' : ''}`}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close() }}
      onKeyDown={handleKeyDown}>
      <div ref={dialog} className="productLookupDialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="productLookupHeader">
          <div><h2 id={titleId}>Pesquisar produto</h2><p>Busque pelo código ou pela descrição e selecione o produto.</p></div>
          <button type="button" className="iconBtn" aria-label="Fechar pesquisa de produtos" onClick={close}><X size={18}/></button>
        </div>
        <label className="productLookupSearch"><Search size={19}/>
          <input ref={search} value={query} onChange={event => { setQuery(event.target.value); setLimit(60) }}
            aria-label="Código ou descrição do produto" aria-controls={resultsId}
            placeholder="Digite o código ou nome do produto" autoComplete="off"/>
          {query && <button type="button" aria-label="Limpar pesquisa" onClick={() => { setQuery(''); setLimit(60); search.current?.focus() }}><X size={16}/></button>}
        </label>
        <p className="productLookupCount" role="status">{results.length.toLocaleString('pt-BR')} {results.length === 1 ? 'produto encontrado' : 'produtos encontrados'}</p>
        <div id={resultsId} className="productLookupResults">
          {results.length === 0 && <div className="productLookupEmpty">Nenhum produto encontrado. Tente outro código ou descrição.</div>}
          {results.slice(0, limit).map(product => <button type="button" key={product.id}
            className={`productLookupResult${product.id === value ? ' isSelected' : ''}`}
            onClick={() => { onSelect(product.id); close() }}>
            <span className="productLookupName"><small>{product.codigo}</small><strong>{product.descricao}</strong>{product.id === value && <em>Selecionado</em>}</span>
            <span className="productLookupStock">Estoque: {Number(product.estoque_atual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {product.unidade}</span>
            <span className="productLookupPrice">{currency(product.preco_venda)}</span>
          </button>)}
          {results.length > limit && <button type="button" className="productLookupMore" onClick={() => setLimit(count => count + 60)}>Mostrar mais produtos ({limit} de {results.length})</button>}
        </div>
      </div>
    </div>, document.body)}
  </>
}
