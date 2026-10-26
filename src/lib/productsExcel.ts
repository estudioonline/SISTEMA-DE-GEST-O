import * as XLSX from '@stackline/xlsx'

type ProductLike = {
  codigo: string
  descricao: string
  unidade: string
  custo: number
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
  ativo: boolean
}

export type ImportedProductRow = {
  codigo: string
  descricao: string
  unidade: string
  custo: number
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
  ativo: string
}

const headers=['Código','Descrição','Unidade','Custo','Preço de Venda','Estoque Atual','Estoque Mínimo','Ativo']

function downloadWorkbook(workbook:XLSX.WorkBook,filename:string){
  const output=XLSX.write(workbook,{type:'array',bookType:'xlsx'})
  const blob=new Blob([output],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url
  link.download=filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function makeInstructions(){
  return XLSX.utils.aoa_to_sheet([
    ['IMPORTAÇÃO DE PRODUTOS / ESTOQUE'],
    ['Regra','Descrição'],
    ['Código','Obrigatório e usado como chave. Se já existir, o item será atualizado.'],
    ['Descrição','Obrigatória.'],
    ['Estoque Atual','Substitui o saldo atual do sistema. A diferença fica registrada no histórico como Importação Excel.'],
    ['Ativo','Aceita SIM/NÃO, ATIVO/INATIVO, TRUE/FALSE ou 1/0.'],
    ['Colunas','Não altere os títulos das colunas da aba Produtos.'],
    ['Segurança','Antes de importar, confira custos, preços e estoque. A importação é aplicada em lote.'],
  ])
}

export function exportProductsExcel(produtos:ProductLike[]){
  const rows=produtos.map(p=>({
    'Código':p.codigo,
    'Descrição':p.descricao,
    'Unidade':p.unidade,
    'Custo':Number(p.custo),
    'Preço de Venda':Number(p.preco_venda),
    'Estoque Atual':Number(p.estoque_atual),
    'Estoque Mínimo':Number(p.estoque_minimo),
    'Ativo':p.ativo?'SIM':'NÃO',
  }))
  const ws=XLSX.utils.json_to_sheet(rows,{header:headers})
  ws['!cols']=[{wch:16},{wch:42},{wch:12},{wch:14},{wch:16},{wch:16},{wch:16},{wch:12}]
  const wb=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,ws,'Produtos')
  XLSX.utils.book_append_sheet(wb,makeInstructions(),'Instruções')
  const stamp=new Date().toISOString().slice(0,10)
  downloadWorkbook(wb,`produtos-estoque-${stamp}.xlsx`)
}

export function downloadProductsTemplate(){
  const ws=XLSX.utils.aoa_to_sheet([
    headers,
    ['PROD-001','Produto exemplo','UN',10.5,19.9,25,5,'SIM']
  ])
  ws['!cols']=[{wch:16},{wch:42},{wch:12},{wch:14},{wch:16},{wch:16},{wch:16},{wch:12}]
  const wb=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,ws,'Produtos')
  XLSX.utils.book_append_sheet(wb,makeInstructions(),'Instruções')
  downloadWorkbook(wb,'modelo-importacao-produtos-estoque.xlsx')
}

function normalizeKey(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
}

function findValue(row:Record<string,unknown>,aliases:string[]){
  const map=new Map(Object.entries(row).map(([k,v])=>[normalizeKey(k),v]))
  for(const alias of aliases){
    const value=map.get(normalizeKey(alias))
    if(value!==undefined&&value!==null&&String(value).trim()!=='')return value
  }
  return ''
}

function numberValue(value:unknown){
  if(typeof value==='number')return Number.isFinite(value)?value:0
  const text=String(value??'').trim()
  if(!text)return 0
  const cleaned=text
    .replace(/R\$/gi,'')
    .replace(/\s/g,'')
    .replace(/\.(?=\d{3}(?:\D|$))/g,'')
    .replace(',','.')
    .replace(/[^0-9.-]/g,'')
  const n=Number(cleaned)
  return Number.isFinite(n)?n:0
}

function activeValue(value:unknown){
  const v=normalizeKey(String(value??'sim'))
  return ['nao','false','0','inativo'].includes(v)?'false':'true'
}

export async function parseProductsExcel(file:File):Promise<ImportedProductRow[]>{
  if(file.size>8*1024*1024)throw new Error('O arquivo excede o limite de 8 MB.')
  const data=await file.arrayBuffer()
  const wb=XLSX.read(data,{type:'array',cellDates:false})
  const sheetName=wb.SheetNames.find(n=>normalizeKey(n)==='produtos')||wb.SheetNames[0]
  if(!sheetName)throw new Error('A planilha não possui abas.')
  const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[sheetName],{defval:''})
  const rows=raw
    .map((row,index)=>{
      const codigo=String(findValue(row,['Código','Codigo','SKU'])).trim()
      const descricao=String(findValue(row,['Descrição','Descricao','Produto','Nome'])).trim()
      if(!codigo&&!descricao)return null
      if(!codigo||!descricao)throw new Error(`Linha ${index+2}: Código e Descrição são obrigatórios.`)
      return {
        codigo,
        descricao,
        unidade:String(findValue(row,['Unidade','Un.','UN'])||'UN').trim().toUpperCase(),
        custo:Math.max(0,numberValue(findValue(row,['Custo','Preço de Custo','Preco de Custo']))),
        preco_venda:Math.max(0,numberValue(findValue(row,['Preço de Venda','Preco de Venda','Venda','Preço Venda']))),
        estoque_atual:Math.max(0,numberValue(findValue(row,['Estoque Atual','Estoque','Saldo']))),
        estoque_minimo:Math.max(0,numberValue(findValue(row,['Estoque Mínimo','Estoque Minimo','Mínimo','Minimo']))),
        ativo:activeValue(findValue(row,['Ativo','Status']))
      }
    })
    .filter((row):row is ImportedProductRow=>Boolean(row))

  if(!rows.length)throw new Error('Nenhuma linha de produto foi encontrada.')
  if(rows.length>5000)throw new Error('A importação aceita no máximo 5.000 linhas por arquivo.')

  const duplicates=new Set<string>()
  const seen=new Set<string>()
  for(const row of rows){
    const key=row.codigo.toLowerCase()
    if(seen.has(key))duplicates.add(row.codigo)
    seen.add(key)
  }
  if(duplicates.size)throw new Error('Há códigos duplicados na planilha: '+Array.from(duplicates).slice(0,8).join(', '))

  return rows
}
