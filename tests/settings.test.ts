import assert from 'node:assert/strict'
import test from 'node:test'
import { readSettings, quoteExpiration } from '../src/lib/erpSettings.ts'

test('settings preserve unrelated required fields and unchecked switches',()=>{
 const f=new FormData()
 for(const [k,v] of Object.entries({desconto_max_vendedor:'12.5',margem_minima_percentual:'10',validade_orcamento_dias:'7',sessao_inatividade_minutos:'30',venda_cliente:'on'}))f.set(k,v)
 const value=readSettings(f,{legacy:true})
 assert.equal(value.desconto_max_vendedor,12.5)
 assert.equal(value.bloquear_cliente_inadimplente,false)
 assert.deepEqual(value.campos_obrigatorios,{legacy:true,venda_cliente:true,venda_vendedor:false,compra_fornecedor:false})
 f.set('sessao_inatividade_minutos','4')
 assert.throws(()=>readSettings(f))
 f.set('sessao_inatividade_minutos','30')
 f.set('desconto_max_vendedor','')
 assert.throws(()=>readSettings(f))
})
test('quote expiration crosses month, year and leap-day boundaries',()=>{
 assert.equal(quoteExpiration('2026-12-28',7),'2027-01-04')
 assert.equal(quoteExpiration('2028-02-28',1),'2028-02-29')
})
