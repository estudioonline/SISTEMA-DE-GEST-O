insert into public.clientes (nome, documento, email, telefone, limite_credito) values
('Construtora Horizonte','12.345.678/0001-10','compras@horizonte.com.br','(61) 3333-1200',50000),
('Mercado Central','23.456.789/0001-20','financeiro@mercadocentral.com.br','(61) 3333-2400',25000);

insert into public.fornecedores (nome, documento, email, telefone) values
('Alumínio Brasil','34.567.890/0001-30','vendas@aluminiobrasil.com.br','(11) 4002-8922'),
('Lonas Nacional','45.678.901/0001-40','comercial@lonasnacional.com.br','(11) 3003-1001');

insert into public.produtos (codigo,descricao,categoria,unidade,custo,preco_venda,estoque_atual,estoque_minimo) values
('PRD-001','Perfil Alumínio Branco 6m','Perfis','UN',125,189.90,86,20),
('PRD-002','Lona PVC 650g Azul','Lonas','M²',31,49.50,142,50),
('PRD-003','Kit Braço Articulado','Acessórios','UN',215,320,18,10),
('PRD-004','Motor Tubular 60Nm','Motores','UN',650,890,7,5);
