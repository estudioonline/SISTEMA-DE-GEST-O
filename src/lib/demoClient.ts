// Modo demonstração: substitui o Supabase por dados de exemplo em memória.
// Ativado com VITE_DEMO_MODE=true. Nada é salvo: recarregar a página restaura os dados.
/* eslint-disable @typescript-eslint/no-explicit-any */

type Row=Record<string,any>
const uid=()=>(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2))
const day=(offset:number)=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}
const ts=(offset:number)=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString()}

const DEMO_USER_ID='00000000-0000-4000-8000-000000000001'
const modules=['dashboard','vendas','clientes','fornecedores','produtos','compras','comissoes','financeiro','rh','entregas','autorizacoes','relatorios','config']

function seed():Record<string,Row[]>{
  const clientes:Row[]=[
    ['Mercado Bom Preço','12.345.678/0001-90','Brasília','DF',15000],
    ['Padaria Pão Dourado','23.456.789/0001-01','Taguatinga','DF',8000],
    ['Restaurante Sabor da Casa','34.567.890/0001-12','Águas Claras','DF',12000],
    ['Lanchonete Ponto Certo','45.678.901/0001-23','Ceilândia','DF',5000],
    ['Hotel Planalto','56.789.012/0001-34','Brasília','DF',25000],
    ['Maria Oliveira','123.456.789-00','Goiânia','GO',2000]
  ].map(([nome,documento,municipio,uf,limite])=>({id:uid(),nome,documento,email:null,telefone:'(61) 99999-0000',limite_credito:limite,ativo:true,municipio,uf,logradouro:'Rua Exemplo',numero:'100',bairro:'Centro',cep:'70000-000',consumidor_final:false}))
  const fornecedores=['Distribuidora Central','Atacadão Alimentos','Embalagens Brasil','Laticínios Serra'].map((nome,i)=>({id:uid(),nome,documento:`6${i}.111.222/0001-0${i}`,email:null,telefone:'(61) 3333-0000',ativo:true}))
  const grupo={id:uid(),nome:'Alimentos',ordem:1,ativo:true,created_at:ts(-90)}
  const grupo2={id:uid(),nome:'Embalagens',ordem:2,ativo:true,created_at:ts(-90)}
  const produtos:Row[]=[
    ['P001','Farinha de trigo 25kg','SC',89.9,129.9,42,10,grupo.id],
    ['P002','Açúcar refinado 5kg','FD',18.5,26.9,120,30,grupo.id],
    ['P003','Óleo de soja 900ml','UN',6.2,9.5,300,60,grupo.id],
    ['P004','Queijo muçarela kg','KG',32,46.9,35,15,grupo.id],
    ['P005','Presunto fatiado kg','KG',24,36.5,8,12,grupo.id],
    ['P006','Caixa para pizza 35cm','UN',1.1,1.9,900,200,grupo2.id],
    ['P007','Sacola kraft média','UN',0.45,0.8,1500,300,grupo2.id],
    ['P008','Fermento biológico 500g','UN',9.8,15.9,4,10,grupo.id]
  ].map(([codigo,descricao,unidade,custo,preco,estoque,minimo,grupo_id])=>({id:uid(),codigo,descricao,unidade,custo,custo_medio:custo,preco_venda:preco,estoque_atual:estoque,estoque_minimo:minimo,ativo:true,tipo_produto:'produto_final',rastrear_estoque:true,grupo_id,subgrupo_id:null,ncm:'19012000',created_at:ts(-80)}))
  const vendedores=[{id:uid(),nome:'Carlos Souza',email:null,telefone:null,percentual_comissao:3,ativo:true,created_at:ts(-120)},{id:uid(),nome:'Ana Lima',email:null,telefone:null,percentual_comissao:2.5,ativo:true,created_at:ts(-120)}]
  const vendas:Row[]=[],venda_itens:Row[]=[],titulos:Row[]=[]
  const statuses=['faturado','faturado','pedido','orcamento','faturado','pedido','faturado','faturado','orcamento','faturado']
  statuses.forEach((status,i)=>{
    const c=clientes[i%clientes.length],v=vendedores[i%2],id=uid()
    const itens=[produtos[i%produtos.length],produtos[(i+3)%produtos.length]].map((p,k)=>{const q=(k+1)*(i%4+2);return {id:uid(),venda_id:id,produto_id:p.id,quantidade:q,valor_unitario:p.preco_venda,desconto:0,total:+(q*p.preco_venda).toFixed(2),created_at:ts(-i*3)}})
    const total=+itens.reduce((s,x)=>s+x.total,0).toFixed(2)
    venda_itens.push(...itens)
    vendas.push({id,cliente_id:c.id,vendedor_id:null,vendedor_cadastro_id:v.id,percentual_comissao:v.percentual_comissao,status,subtotal:total,desconto:0,total,observacoes:null,rota_entrega:null,created_at:ts(-i*3),forma_pagamento:i%2?'pix':'boleto',parcelas:1,primeiro_vencimento:day(-i*3+30),vencimentos_parcelas:[day(-i*3+30)],venda_numero:1001+i,fatura_numero:status==='faturado'?501+i:null,fatura_gerada_em:status==='faturado'?ts(-i*3):null})
    if(status==='faturado')titulos.push({id:uid(),tipo:'receber',descricao:`Venda #${1001+i}`,entidade_nome:c.nome,vencimento:day(-i*3+30),valor:total,valor_pago:i%3===0?total:0,status:i%3===0?'pago':'aberto',categoria:'Vendas',centro_custo:'Comercial',venda_id:id,compra_id:null,parcela_numero:1,forma_pagamento:i%2?'pix':'boleto',created_at:ts(-i*3)})
  })
  const compras=fornecedores.slice(0,3).map((f,i)=>({id:uid(),fornecedor_id:f.id,status:i?'recebida':'pedido',total:[4200,1850,960][i],observacoes:null,created_at:ts(-i*7-2),forma_pagamento:'boleto',parcelas:1,primeiro_vencimento:day(20-i*7),vencimentos_parcelas:[day(20-i*7)],fatura_numero:null,fatura_gerada_em:null,nome_fornecedor:f.nome}))
  compras.forEach((c,i)=>titulos.push({id:uid(),tipo:'pagar',descricao:`Compra ${fornecedores[i].nome}`,entidade_nome:fornecedores[i].nome,vencimento:c.primeiro_vencimento,valor:c.total,valor_pago:0,status:'aberto',categoria:'Compras',centro_custo:'Operação',venda_id:null,compra_id:c.id,parcela_numero:1,forma_pagamento:'boleto',created_at:c.created_at}))
  ;[['Aluguel',3500,5],['Energia elétrica',780,-3],['Internet',199,12]].forEach(([d,v,o])=>titulos.push({id:uid(),tipo:'pagar',descricao:d,entidade_nome:null,vencimento:day(o as number),valor:v,valor_pago:0,status:'aberto',categoria:'Despesas fixas',centro_custo:'Administrativo',venda_id:null,compra_id:null,parcela_numero:1,forma_pagamento:'pix',created_at:ts(-10)}))
  return {
    profiles:[{id:DEMO_USER_ID,nome:'Usuário Demonstração',email:'demo@sistema.com',perfil:'administrador',ativo:true,avatar_path:null}],
    empresa_config:[{id:1,razao_social:'Empresa Demonstração LTDA',nome_fantasia:'Empresa Demo',cnpj:'00.000.000/0001-00',email:'contato@empresa.demo',telefone:'(61) 3000-0000',endereco:'Setor Comercial Sul',cidade:'Brasília',uf:'DF',cep:'70000-000',pix_chave:null,banco:null,agencia:null,conta:null,condicoes_gerais:null,desconto_max_vendedor:10,margem_minima_percentual:0,validade_orcamento_dias:7,bloquear_cliente_inadimplente:false,exigir_aprovacao_limite_credito:false,reservar_estoque_pedido:false,sessao_inatividade_minutos:1440,campos_obrigatorios:{}}],
    clientes,fornecedores,produtos,vendedores,vendas,venda_itens,compras,titulos_financeiros:titulos,
    grupos_produtos:[grupo,grupo2],subgrupos_produtos:[],
    funcionarios:[{id:uid(),nome:'João Pereira',cargo:'Vendedor',ativo:true,created_at:ts(-200)},{id:uid(),nome:'Fernanda Costa',cargo:'Financeiro',ativo:true,created_at:ts(-150)}]
  }
}

const db=seed()
const table=(name:string)=>(db[name]??=[])

const ok=(data:any)=>({data,error:null,count:Array.isArray(data)?data.length:null,status:200,statusText:'OK'})
const demoError=(msg='Indisponível no modo demonstração.')=>({data:null,error:{message:msg,code:'demo'},count:null,status:400,statusText:'demo'})

function cmp(a:any,b:any){if(a==null&&b==null)return 0;if(a==null)return 1;if(b==null)return -1;return a<b?-1:a>b?1:0}

class Query{
  private filters:((r:Row)=>boolean)[]=[]
  private orders:{col:string;asc:boolean}[]=[]
  private rangeFrom=0;private rangeTo=Infinity
  private mode:'select'|'insert'|'update'|'delete'|'upsert'='select'
  private payload:any=null
  private singleMode:''|'single'|'maybe'=''
  private returning=false
  constructor(private name:string){}
  select(){if(this.mode!=='select')this.returning=true;return this}
  insert(v:any){this.mode='insert';this.payload=v;return this}
  upsert(v:any){this.mode='upsert';this.payload=v;return this}
  update(v:any){this.mode='update';this.payload=v;return this}
  delete(){this.mode='delete';return this}
  eq(c:string,v:any){this.filters.push(r=>r[c]==v);return this}
  neq(c:string,v:any){this.filters.push(r=>r[c]!=v);return this}
  gt(c:string,v:any){this.filters.push(r=>r[c]>v);return this}
  gte(c:string,v:any){this.filters.push(r=>r[c]>=v);return this}
  lt(c:string,v:any){this.filters.push(r=>r[c]<v);return this}
  lte(c:string,v:any){this.filters.push(r=>r[c]<=v);return this}
  in(c:string,v:any[]){this.filters.push(r=>v.includes(r[c]));return this}
  is(c:string,v:any){this.filters.push(r=>(r[c]??null)===v);return this}
  like(c:string,p:string){return this.ilike(c,p)}
  ilike(c:string,p:string){const re=new RegExp('^'+String(p).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/%/g,'.*')+'$','i');this.filters.push(r=>re.test(String(r[c]??'')));return this}
  contains(){return this}
  not(){return this}
  or(){return this}
  filter(){return this}
  match(o:Row){Object.entries(o).forEach(([k,v])=>this.eq(k,v));return this}
  textSearch(){return this}
  order(col:string,opt?:{ascending?:boolean}){this.orders.push({col,asc:opt?.ascending!==false});return this}
  range(a:number,b:number){this.rangeFrom=a;this.rangeTo=b;return this}
  limit(n:number){this.rangeTo=this.rangeFrom+n-1;return this}
  abortSignal(){return this}
  returns(){return this}
  maybeSingle(){this.singleMode='maybe';return this}
  singleRow(){this.singleMode='single';return this}
  private run(){
    const rows=table(this.name)
    const match=(r:Row)=>this.filters.every(f=>f(r))
    let out:Row[]
    if(this.mode==='insert'||this.mode==='upsert'){
      const list=(Array.isArray(this.payload)?this.payload:[this.payload]).map((r:Row)=>({id:uid(),created_at:new Date().toISOString(),...r}))
      for(const r of list){const i=rows.findIndex(x=>x.id===r.id);if(i>=0)rows[i]={...rows[i],...r};else rows.push(r)}
      out=list
      if(!this.returning&&!this.singleMode)return ok(null)
    }else if(this.mode==='update'){
      out=rows.filter(match);out.forEach(r=>Object.assign(r,this.payload))
      if(!this.returning&&!this.singleMode)return ok(null)
    }else if(this.mode==='delete'){
      out=rows.filter(match);db[this.name]=rows.filter(r=>!match(r))
      if(!this.returning)return ok(null)
    }else{
      out=rows.filter(match)
      for(const o of [...this.orders].reverse())out=[...out].sort((a,b)=>o.asc?cmp(a[o.col],b[o.col]):cmp(b[o.col],a[o.col]))
      out=out.slice(this.rangeFrom,this.rangeTo===Infinity?undefined:this.rangeTo+1)
    }
    out=out.map(r=>({...r}))
    if(this.singleMode==='maybe')return ok(out[0]??null)
    if(this.singleMode==='single')return out[0]?ok(out[0]):demoError('Registro não encontrado.')
    return ok(out)
  }
  then(res:(v:any)=>any,rej?:(e:any)=>any){return Promise.resolve().then(()=>this.run()).then(res,rej)}
}
// expõe .single() como no supabase-js
;(Query.prototype as any).single=function(this:any){return this.singleRow()}

const fakeUser={id:DEMO_USER_ID,email:'demo@sistema.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{nome:'Usuário Demonstração'},created_at:ts(-365)}
const fakeSession={access_token:'demo',refresh_token:'demo',token_type:'bearer',expires_in:999999,expires_at:Math.floor(Date.now()/1000)+999999,user:fakeUser}

function rpc(name:string,args:Row={}){
  const r=(()=>{
    switch(name){
      case 'minhas_permissoes_erp':return ok(modules.map(modulo=>({modulo,nivel:'editar'})))
      case 'listar_usuarios_erp':return ok([{user_id:DEMO_USER_ID,nome:'Usuário Demonstração',email:'demo@sistema.com',perfil:'administrador',ativo:true,avatar_path:null}])
      case 'listar_permissoes_perfis_erp':return ok([])
      case 'situacao_credito_cliente':return ok({limite:0,em_aberto:0,disponivel:999999,inadimplente:false})
      case 'comissoes_por_periodo':case 'relatorio_comissoes_vendas':case 'historico_venda':return ok([])
      case 'ajustar_estoque_produto':{const p=table('produtos').find(x=>x.id===args.p_produto_id);if(p)p.estoque_atual=Number(args.p_novo_estoque);return ok(null)}
      default:return ok(null)
    }
  })()
  const p:any=Promise.resolve(r)
  p.range=()=>p;p.order=()=>p;p.select=()=>p;p.single=()=>p;p.maybeSingle=()=>p
  return p
}

const channelStub:any={on:()=>channelStub,subscribe:()=>channelStub,unsubscribe:()=>Promise.resolve('ok')}

export function createDemoClient():any{
  return {
    from:(name:string)=>new Query(name),
    rpc,
    channel:()=>channelStub,
    removeChannel:()=>Promise.resolve('ok'),
    removeAllChannels:()=>Promise.resolve([]),
    auth:{
      getSession:async()=>({data:{session:fakeSession},error:null}),
      getUser:async()=>({data:{user:fakeUser},error:null}),
      onAuthStateChange:(cb:(e:string,s:any)=>void)=>{setTimeout(()=>cb('SIGNED_IN',fakeSession),0);return {data:{subscription:{unsubscribe(){}}}}},
      signInWithPassword:async()=>({data:{session:fakeSession,user:fakeUser},error:null}),
      signOut:async()=>({error:null}),
      resetPasswordForEmail:async()=>demoError(),
      updateUser:async()=>demoError()
    },
    storage:{from:()=>({
      upload:async()=>demoError('Envio de arquivos desativado no modo demonstração.'),
      remove:async()=>ok([]),
      createSignedUrl:async()=>demoError(),
      getPublicUrl:()=>({data:{publicUrl:''}}),
      list:async()=>ok([])
    })},
    functions:{invoke:async()=>demoError()}
  }
}
