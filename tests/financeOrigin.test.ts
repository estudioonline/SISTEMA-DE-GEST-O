import {test} from 'node:test'
import assert from 'node:assert/strict'
import {financeOriginLabel,financeOriginDocuments} from '../src/lib/financeOrigin.ts'

const sales=[{id:'s1',venda_numero:4},{id:'s2',venda_numero:9}]
const purchases=[{id:'p1',fatura_numero:31}]
const invoices=[{id:'f1',venda_id:'s1'}]
const links=[{fatura_id:'f1',venda_id:'s1'},{fatura_id:'f1',venda_id:'s2'},{fatura_id:'other',venda_id:'unrelated'}]
const origin=(title:Parameters<typeof financeOriginLabel>[0])=>financeOriginLabel(title,sales,purchases,invoices,links)

test('financial origins use document links and preserve all consolidated sales without duplicates',()=>{
  assert.equal(origin({compra_id:'p1'}),'Compra C00031')
  assert.equal(origin({venda_id:'s1'}),'Venda S00004')
  assert.equal(origin({venda_id:'s1',fatura_venda_id:'f1'}),'Vendas S00004, S00009')
  assert.equal(origin({fatura_venda_id:'f1'}),'Vendas S00004, S00009')
  assert.deepEqual(financeOriginDocuments({fatura_venda_id:'f1'},sales,purchases,invoices,links),[
    {kind:'venda',id:'s1',number:4},{kind:'venda',id:'s2',number:9}
  ])
  assert.deepEqual(financeOriginDocuments({compra_id:'p1'},sales,purchases,invoices,links),[{kind:'compra',id:'p1',number:31}])
})
test('missing documents never become fictitious codes or infer a purchase from an unlinked payment',()=>{
  assert.equal(origin({compra_id:'missing'}),'Compra · referência indisponível')
  assert.equal(origin({fatura_venda_id:'missing'}),'Venda · referência indisponível')
  assert.equal(origin({}),'Lançamento manual')
  assert.equal(origin({funcionario_id:'employee'}),'RH')
})
