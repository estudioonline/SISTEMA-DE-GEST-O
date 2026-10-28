# Focus NFe — homologação

Integração de NF-e de produtos exclusivamente em homologação, sem valor fiscal.
Nenhuma rota de emissão ou gestão de empresas em produção é utilizada.

## Ativação pelo administrador

1. No painel da Focus, cadastre a empresa e habilite a emissão de NF-e em homologação.
   Confira o certificado e demais requisitos exibidos pela Focus.
2. No ERP, abra **Configurações → Focus NFe · ambiente de testes**.
3. Informe o **token de homologação da empresa**, CNPJ, IE, regime e endereço fiscal.
   A razão social vem das configurações já existentes da empresa.
4. Salve e use **Testar conexão salva**. O teste confirma autenticação, sem emitir nota;
   não confirma, sozinho, o vínculo entre token, CNPJ e habilitação fiscal.
5. Abra uma venda confirmada e depois **NF-e de teste**.
6. Preencha endereço do cliente, natureza, pagamento e tributação dos itens, com orientação
   do contador. Salve o rascunho, revise e use **Emitir NF-e de teste**.
7. Use **Consultar situação na Focus** para acompanhar a autorização. XML e DANFE ficam
   disponíveis na própria venda quando a Focus autorizar.

Não envie tokens pelo chat, não os adicione ao GitHub nem ao arquivo de variáveis do frontend.
O campo do ERP envia o token ao servidor autenticado, que o guarda criptografado no Vault.
O token salvo nunca é devolvido ao navegador. Não há token de demonstração no código.

## Escopo e limites

- Somente administrador ativo, com edição de Configurações e Vendas.
- Valores, quantidades, produtos e cliente são lidos novamente do banco no servidor.
- O cliente não consegue substituir os valores comerciais pelo formulário fiscal.
- Emissão não muda venda, estoque, contas a receber ou recebimentos.
- Rascunhos e respostas são guardados em tabela separada, com leitura administrativa.
- Uma referência fixa por venda; reserva transacional evita envios simultâneos.
- Resposta incerta bloqueia novo envio até consulta. Uma ausência confirmada pela Focus
  permite repetir a mesma referência e o mesmo conteúdo original.
- Fluxo inicial: operação nacional de saída, sem frete e sem impostos que alterem
  o total comercial. Códigos fiscais não são deduzidos nem calculados automaticamente.
- Complementos por item aceitam somente campos tributários da Focus; as regras da
  SEFAZ e da Focus continuam sendo aplicadas e suas rejeições são exibidas.
- NFS-e, NFC-e, cancelamento fiscal, devoluções, webhooks e ativação em produção
  precisam de implementação própria. Cancelar a venda no ERP não cancela uma NF-e.

## Servidor

Função Supabase: `focus-nfe`. URL do provedor fixa em
`https://homologacao.focusnfe.com.br`.
O handler valida cada sessão em Auth `getUser`, perfil ativo e permissões no banco.
`verify_jwt=false` evita a dependência do verificador legado do gateway; a autorização
é feita explicitamente pelo handler. RPC interna permitida somente a `service_role`.
Nenhuma chave precisa ser adicionada manualmente às variáveis do frontend.

Migração incremental cria duas tabelas e funções novas, sem alterar dados comerciais.
O token é armazenado em Supabase Vault; downloads passam por proxy autenticado,
com domínio e caminho restritos. As consultas são manuais nesta versão.

## Verificação

Testes de mapeamento monetário, códigos fiscais, proteção de campos e URLs de documentos:
`node --test tests/*.test.ts`.
Compilação: `npm run build`.
A emissão completa depende do token e da empresa de homologação da conta Focus.

Documentação oficial:
- https://doc.focusnfe.com.br/reference/ambiente
- https://doc.focusnfe.com.br/reference/autenticacao
- https://doc.focusnfe.com.br/reference/emitir_nfe
- https://doc.focusnfe.com.br/reference/consultar_nfe
- https://doc.focusnfe.com.br/reference/empresas
