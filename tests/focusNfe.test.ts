import test from 'node:test'
import assert from 'node:assert/strict'
import {buildPayload,documentUrl,FOCUS_BASE,providerStatus,safeResult,validateConfig} from '../supabase/functions/focus-nfe/fiscal.ts'
import type {FiscalDraft,SaleSource} from '../supabase/functions/focus-nfe/fiscal.ts'

const config={
 cnpj_emitente:'12.345.678/0001-90',inscricao_estadual_emitente:'110042490114',regime_tributario_emitente:'1',
 logradouro_emitente:'Rua Teste',numero_emitente:'1',bairro_emitente:'Centro',municipio_emitente:'São Paulo',
 codigo_municipio_emitente:'3550308',uf_emitente:'SP',cep_emitente:'01001000'
}

const fixture=():{source:SaleSource;draft:FiscalDraft}=>({
 source:{
  venda:{status:'pedido',total:19.89,parcelas:1,forma_pagamento:'pix'},
  cliente:{
   documento:'12345678901',logradouro:'Rua Destino',numero:'10',bairro:'Centro',municipio:'São Paulo',
   codigo_municipio:'3550308',uf:'SP',cep:'01001000',indicador_ie:'9',consumidor_final:true,presenca_comprador:1
  },
  empresa:{razao_social:'Empresa Teste'},source_hash:'hash',
  itens:[{id:'i',produto_id:'p',quantidade:2,valor_unitario:10.005,desconto:0.12,total:19.89,produto:{
   codigo:'001',descricao:'Produto',unidade:'UN',ncm:'76101000',cfop_interno:'5102',cfop_interestadual:'6102',
   origem:0,cst_icms:'102',cst_pis:'07',cst_cofins:'07',complemento_tributario:{}
  }}]
 },
 draft:{}
})

test('fiscal payload uses saved commercial amounts and exact cents from customer/product registrations',()=>{
 const {source,draft}=fixture(),before=JSON.stringify(source)
 const p=buildPayload(source,config,draft,new Date('2026-10-28T15:00:00Z')),items=p.itens as Record<string,unknown>[]
 assert.equal(p.valor_total,19.89);assert.equal(p.valor_produtos,20.01);assert.equal(p.valor_desconto,0.12)
 assert.equal(items[0].quantidade_comercial,2);assert.equal(items[0].codigo_produto,'001')
 assert.equal(p.cpf_destinatario,'12345678901');assert.equal(p.uf_destinatario,'SP')
 assert.equal(items[0].codigo_ncm,'76101000');assert.equal(items[0].cfop,'5102')
 assert.equal(JSON.stringify(source),before)
})

test('missing customer/product fiscal registration and invalid commercial totals block emission',()=>{
 const {source,draft}=fixture()
 source.itens[0].produto.ncm=''
 assert.throws(()=>buildPayload(source,config,draft),/NCM/)
 source.itens[0].produto.ncm='76101000';source.venda.total=20
 assert.throws(()=>buildPayload(source,config,draft),/total da venda diverge/)
 source.venda.total=19.89;source.cliente!.cep=''
 assert.throws(()=>buildPayload(source,config,draft),/CEP/)
 source.cliente!.cep='01001000';source.venda.status='orcamento'
 assert.throws(()=>buildPayload(source,config,draft),/Confirme o pedido/)
})

test('CFOP, tax regime, and product fiscal overrides cannot change commercial data',()=>{
 const {source,draft}=fixture()
 source.cliente!.uf='RJ';source.itens[0].produto.cfop_interestadual='5102'
 assert.throws(()=>buildPayload(source,config,draft),/CFOP interestadual/)
 source.itens[0].produto.cfop_interestadual='6102';assert.equal(buildPayload(source,config,draft).local_destino,2)
 source.itens[0].produto.cst_icms='00';assert.throws(()=>buildPayload(source,config,draft),/regime/)
 source.itens[0].produto.cst_icms='102';source.itens[0].produto.complemento_tributario={valor_bruto:0}
 assert.throws(()=>buildPayload(source,config,draft),/não permitido/)
 source.itens[0].produto.complemento_tributario={ipi_valor:10}
 assert.throws(()=>buildPayload(source,config,draft),/alteram o total/)
})

test('secrets and arbitrary provider fields never enter the public result',()=>{
 assert.deepEqual(safeResult({status:'autorizado',numero:'1',token:'secret',requisicao:{sensitive:true}}),{status:'autorizado',numero:'1'})
 assert.equal(providerStatus({status:'processando_autorizacao'},202),'processando_autorizacao')
 assert.equal(providerStatus({},503),'incerto');assert.equal(providerStatus({},422),'rejeitado')
 assert.equal(validateConfig(config).cnpj_emitente,'12345678000190')
})

test('document proxy permits only homologation files and never sends credentials elsewhere',()=>{
 assert.equal(documentUrl('/arquivos/nfe/teste.pdf'),FOCUS_BASE+'/arquivos/nfe/teste.pdf')
 for(const path of ['https://example.org/arquivos/a.pdf','https://api.focusnfe.com.br/arquivos/a.pdf','//evil.test/arquivos/a','/v2/empresas','/arquivos/../v2/empresas'])assert.throws(()=>documentUrl(path))
})
