import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from '@stackline/xlsx'
import {parseProductsExcel} from '../src/lib/productsExcel.ts'

const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function workbookFile(rows:unknown[][],name='Produtos'):File{
  const wb=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name)
  const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'}) as ArrayBuffer
  return new File([new Uint8Array(bytes)],'produtos.xlsx',{type:mime})
}

test('product import accepts Portuguese headers, aliases and Brazilian currency values',async()=>{
  const file=workbookFile([
    ['SKU','Produto','Grupo','Sub Grupo','Un.','Preço de Custo','Preço Venda','Estoque','Mínimo','Status'],
    ['ABC-01','Lona reforçada','Lonas','Premium','m²','R$ 1.234,56','R$ 1.599,90','12,5','2','ATIVO'],
    ['ABC-02','Lona básica','','','UN',10,20,4,1,'NÃO'],
    ['', '', '', '', '', '', '', '', '', '']
  ])
  const rows=await parseProductsExcel(file)
  assert.equal(rows.length,2)
  assert.deepEqual(rows[0],{
    codigo:'ABC-01',descricao:'Lona reforçada',grupo:'Lonas',subgrupo:'Premium',unidade:'M²',
    custo:1234.56,preco_venda:1599.9,estoque_atual:12.5,estoque_minimo:2,ativo:'true'
  })
  assert.equal(rows[1].ativo,'false')
})

test('product import refuses missing code or description and duplicate codes ignoring case',async()=>{
  await assert.rejects(parseProductsExcel(workbookFile([
    ['Código','Descrição'],['','Produto']
  ])),/Código e Descrição são obrigatórios/)
  await assert.rejects(parseProductsExcel(workbookFile([
    ['Código','Descrição'],['ABC','Produto A'],['abc','Produto B']
  ])),/códigos duplicados/)
})

test('product import refuses empty sheets, oversized files and more than 5,000 rows',async()=>{
  await assert.rejects(parseProductsExcel(workbookFile([['Código','Descrição'],['','']])),/Nenhuma linha/)
  const tooLarge=new File([new Uint8Array(8*1024*1024+1)],'grande.xlsx',{type:mime})
  await assert.rejects(parseProductsExcel(tooLarge),/8 MB/)
  const rows:unknown[][]=[['Código','Descrição']]
  for(let i=0;i<5001;i++)rows.push(['SKU-'+i,'Produto '+i])
  await assert.rejects(parseProductsExcel(workbookFile(rows)),/5.000 linhas/)
})

test('product import normalizes negative stock and prices to zero',async()=>{
  const rows=await parseProductsExcel(workbookFile([
    ['Código','Descrição','Custo','Preço de Venda','Estoque Atual','Estoque Mínimo'],
    ['NEG-01','Item teste',-10,-20,-3,-1]
  ]))
  assert.equal(rows[0].custo,0)
  assert.equal(rows[0].preco_venda,0)
  assert.equal(rows[0].estoque_atual,0)
  assert.equal(rows[0].estoque_minimo,0)
})
