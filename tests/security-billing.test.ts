import assert from 'node:assert/strict'
import test from 'node:test'
import {parseEffectivePermissions,emptyPermissions,permissionModules,canEditPermission,defaultPermissionsForRole} from '../src/lib/permissions.ts'
import {validateBilling,titlesForSale} from '../src/lib/billing.ts'
import {sessionExpired,inactivityMinutes} from '../src/lib/sessionPolicy.ts'

test('access fails closed for missing, duplicate, malformed and partial server responses',()=>{
  assert.ok(Object.values(emptyPermissions()).every(p=>p==='nenhum'))
  for(const rows of [null,[],[{modulo:'vendas',nivel:'editar'}],[{modulo:'vendas',nivel:'admin'}]])assert.throws(()=>parseEffectivePermissions(rows))
  const rows=permissionModules.map(m=>({modulo:m.key,nivel:'nenhum'}))
  assert.deepEqual(parseEffectivePermissions(rows),emptyPermissions())
  assert.throws(()=>parseEffectivePermissions([...rows,rows[0]]))
  rows[0].nivel='editar'
  assert.equal(parseEffectivePermissions(rows).dashboard,'visualizar')
})

test('finance and sales role defaults keep editing responsibilities separate',()=>{
  assert.equal(canEditPermission(defaultPermissionsForRole('financeiro'),'vendas'),false)
  assert.equal(canEditPermission(defaultPermissionsForRole('vendas'),'financeiro'),false)
  assert.equal(canEditPermission(defaultPermissionsForRole('visualizador'),'vendas'),false)
})

const sales=[{id:'one',cliente_id:'a',status:'pedido',total:100.01},{id:'two',cliente_id:'a',status:'pedido',total:49.99},{id:'other',cliente_id:'b',status:'pedido',total:60}]
const lines=[{vencimento:'2026-11-10',valor:50},{vencimento:'2026-12-10',valor:100}]
test('consolidation accepts exactly matching installments and rejects stale or conflicting sales',()=>{
  assert.equal(validateBilling(['one','two'],sales,[],[],'boleto',lines).total,150)
  assert.throws(()=>validateBilling(['one','two'],sales,[],[],'boleto',[{...lines[0],valor:150.01}]))
  assert.throws(()=>validateBilling(['one','other'],sales,[],[],'pix',lines))
  assert.throws(()=>validateBilling(['one','one'],sales,[],[],'pix',lines))
  assert.throws(()=>validateBilling(['missing'],sales,[],[],'pix',lines))
  assert.throws(()=>validateBilling(['one','two'],[{...sales[0],status:'cancelado'},sales[1]],[],[],'boleto',lines))
  const invoices=[{id:'invoice',venda_id:'one',status:'ativa'}],links=[{fatura_id:'invoice',venda_id:'two'}]
  assert.throws(()=>validateBilling(['two'],sales,invoices,links,'pix',[{vencimento:'2026-11-10',valor:49.99}]))
})
test('cash requires a single installment; nonfinite, missing and nonpositive values fail',()=>{
  assert.throws(()=>validateBilling(['one','two'],sales,[],[],'dinheiro',lines))
  assert.equal(validateBilling(['one','two'],sales,[],[],'dinheiro',[{vencimento:'2026-11-10',valor:150}]).total,150)
  for(const valor of [NaN,Infinity,-1,0])assert.throws(()=>validateBilling(['one'],sales,[],[],'pix',[{vencimento:'2026-11-10',valor}]))
  assert.throws(()=>validateBilling(['one'],sales,[],[],'pix',[{vencimento:'',valor:100.01}]))
  assert.throws(()=>validateBilling(['one'],sales,[],[],'pix',[{vencimento:'2026-02-30',valor:100.01}]))
  assert.throws(()=>validateBilling(['one'],sales,[],[],'pix',[{vencimento:'2026-11-10',valor:100.005}]))
})
test('secondary sales share consolidated title status and payment protections without duplicate titles',()=>{
  const invoices=[{id:'i',venda_id:'one',status:'ativa'}],links=[{fatura_id:'i',venda_id:'two'}]
  const titles=[{id:'t1',venda_id:'one',fatura_venda_id:'i',valor_pago:150},{id:'t2',venda_id:'other',fatura_venda_id:null,valor_pago:0}]
  assert.deepEqual(titlesForSale('one',titles,invoices,links),[titles[0]])
  assert.deepEqual(titlesForSale('two',titles,invoices,links),[titles[0]])
  assert.deepEqual(titlesForSale('other',titles,invoices,links),[titles[1]])
  assert.equal(titlesForSale('two',titles,invoices,links).some(t=>t.valor_pago>0),true)
})
test('inactivity uses an absolute deadline across reload and suspended tabs',()=>{
  const now=Date.now()
  assert.equal(sessionExpired(now-30*60_000,now,30),true)
  assert.equal(sessionExpired(now-29*60_000,now,30),false)
  assert.equal(sessionExpired(NaN,now,30),true)
  assert.equal(inactivityMinutes(0),30)
  assert.equal(inactivityMinutes(480),480)
})
