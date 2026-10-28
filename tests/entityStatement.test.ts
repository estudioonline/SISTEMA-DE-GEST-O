import test from 'node:test'
import assert from 'node:assert/strict'
import {buildStatement} from '../src/lib/entityStatement.ts'
import type {StatementWire} from '../src/lib/entityStatement.ts'
const row=(extra:Partial<StatementWire>={}):StatementWire=>({id:'1',tipo:'receber',descricao:'Fatura',vencimento:'2026-10-27',valor:'100.10',valor_pago:'20.05',status:'parcial',parcela_numero:1,vendas:{cliente_id:'a',fatura_numero:7,status:'faturado'},...extra})
test('past due, today and future are separated using remaining balance in cents',()=>{
 const s=buildStatement([row(),row({id:'2',vencimento:'2026-10-28'}),row({id:'3',vencimento:'2026-11-01',valor:'0.30',valor_pago:'0.10'})],'cliente','a','2026-10-28')
 assert.equal(s.overdue.length,1);assert.equal(s.upcoming.length,2)
 assert.equal(s.overdueCents,8005);assert.equal(s.upcomingCents,8025);assert.equal(s.totalCents,16030)
})
test('paid, canceled and unrelated invoices never enter the statement',()=>{
 const s=buildStatement([row({status:'pago'}),row({status:'cancelado'}),row({valor_pago:100.10}),row({vendas:{cliente_id:'b',fatura_numero:8,status:'faturado'}}),row({vendas:{cliente_id:'a',fatura_numero:9,status:'orcamento'}})],'cliente','a','2026-10-28')
 assert.equal(s.totalCents,0);assert.equal(s.overdue.length,0)
})
test('supplier statements select purchases by supplier id, including one-to-one relation arrays',()=>{
 const s=buildStatement([row({tipo:'pagar',vendas:undefined,compras:[{fornecedor_id:'f',fatura_numero:5,status:'pedido_recebido'}]}),row({tipo:'pagar',vendas:undefined,compras:{fornecedor_id:'outro',fatura_numero:6,status:'pedido_aprovado'}})],'fornecedor','f','2026-10-28')
 assert.equal(s.totalCents,8005);assert.equal(s.overdue[0].invoice,5)
})
