# Sistema de Gestão

ERP web moderno em português do Brasil, com identidade própria, inspirado funcionalmente em sistemas de gestão empresarial.

## Módulos planejados
- Dashboard
- Clientes
- Fornecedores
- Produtos
- Estoque
- Compras
- Orçamentos
- Vendas
- Caixa
- Contas a Pagar
- Contas a Receber
- Relatórios
- Usuários e Permissões

## Arquitetura
- Frontend: React + Vite + TypeScript
- Backend/Banco: Supabase (PostgreSQL + Auth + RLS)
- Versionamento: GitHub
- Segurança: RLS em todas as tabelas expostas, chave publishable no frontend e nenhuma chave secreta no repositório

## Operação e melhorias do ERP — 28/10/2026

O frontend usa o projeto ORGJSS1. O projeto ORGJSS não foi alterado.

### Configurações e segurança
- Tela de regras de desconto, margem, validade de orçamento, inatividade e campos obrigatórios.
- Validação no banco de preços mínimos, totais, crédito, inadimplência e permissões.
- Novos cadastros de autenticação nascem como visualizadores inativos; o administrador libera o perfil. Usuários existentes foram preservados.
- Decisões e histórico de pagamentos só podem ser escritos pelas funções controladas.

### Vendas, compras, estoque e financeiro
- Orçamentos não criam cobrança nem baixam estoque em novas operações.
- Repetir o faturamento preserva os títulos existentes e os pagamentos.
- Edição de venda devolve o estoque anterior antes de aplicar os novos itens, evitando baixa transitória duplicada.
- Compra aprovada gera parcelas; receber a compra dá entrada uma vez; cancelar compra sem pagamento estorna a entrada.
- Documentos pagos não podem ser cancelados/excluídos nem ter seus itens trocados. Títulos vinculados preservam a origem e o histórico de pagamentos.

### Autorizações
- Vendedores enviam rascunhos de novas vendas ou edições pela opção **Solicitar autorização**.
- Administradores revisam itens, valores, pagamento, cliente, vendedor e rota; aprovam ou rejeitam com justificativa.
- Aprovação executa a operação no banco com validação atual das regras e registro de autoria; uma mesma solicitação só pode ser decidida uma vez.
- Edições usam uma assinatura da venda e dos itens para recusar solicitações desatualizadas.
- A autorização administrativa pode liberar desconto, margem, crédito e estoque negativo; preço mínimo por produto continua obrigatório.

### Verificação e preservação
`pnpm install --frozen-lockfile`, `pnpm test` e `pnpm run build` usam Node 24 e pnpm 11.25.0. Pull requests executam testes e build; a branch main publica no Pages.

Os testes SQL em `tests/erp-transactions.sql` e `tests/erp-roles-purchases.sql` criam cenários temporários e revertem todas as alterações de negócio. Sequências de numeração podem avançar, gerando lacunas sem reaproveitar números. Os testes de permissões também executam com o papel `authenticated`.

As sete migrações desta entrega foram aplicadas incrementalmente, sem limpeza, seed, reset ou reprocessamento dos registros atuais. Contagens e assinaturas dos campos originais das 19 tabelas públicas coincidiram antes/depois. Isso verifica preservação dos registros; não substitui um backup restaurável de banco e arquivos.

### Continuação das melhorias — 28/10/2026
- Venda, itens, rota e validade passam a ser gravados em uma única transação. Uma chave de requisição impede duplicação ao repetir um envio concluído e recusa a mesma chave com outros dados.
- Estornos integrais de pagamentos ficam em registros separados, preservando o original. O saldo do título é recalculado; a comissão recebe uma compensação negativa na data do estorno. Documentos com saldo pago ainda são bloqueados para cancelamento. Após estorno integral, o cancelamento preserva o histórico financeiro.
- Configurações agora incluem administração de categorias, centros de custo, fechamento e reabertura de comissões com justificativa. Categorias e centros são inativados em vez de apagados pela interface. Os resumos de fechamento são restritos a administrador e financeiro.
- A central de autorizações tem paginação e filtro no servidor. As consultas usadas em totais e exportações percorrem todas as páginas, sem os antigos cortes de 300/500 registros. Falha em uma página não produz um total parcial.
- PDF e Excel carregam sob demanda. O JavaScript inicial foi reduzido de cerca de 1,44 MB para 530 KB antes de compressão, dividido em blocos de aplicação, React e Supabase para cache.
- O administrador confirmou a política: **baixar estoque ao confirmar o pedido**. Essa regra foi mantida, sem converter os pedidos existentes.
- O histórico remoto foi recuperado integralmente; os antigos arquivos não registrados foram arquivados em `supabase/history/legacy`. O manifesto e o verificador de histórico entram no CI. O checkpoint e o bootstrap para projeto vazio estão documentados em `supabase/checkpoints/README.md`.
- A reconstrução do checkpoint foi testada em schemas isolados, incluindo criação de venda, pagamento e estorno. Os testes SQL e a estrutura temporária são revertidos ao final.

### Dependências externas remanescentes
- A organização Supabase está no plano gratuito. A proteção nativa contra senhas vazadas requer Pro ou superior: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Não houve contratação ou troca de plano.
- A conferência visual das telas internas depende de uma sessão autenticada do usuário. Testes do banco, permissões, TypeScript, testes automatizados e build são executados independentemente dessa sessão.
- O checkpoint reconstrói a estrutura da aplicação; usuários, configurações de Auth e arquivos do Storage exigem backup próprio. O bootstrap recusa bancos que já contenham vendas e deve ser usado exclusivamente em projeto vazio.

### Abertura de cards e relatórios por cadastro
- Duplo clique nas linhas abre o card de venda, compra, título financeiro, produto, cliente, fornecedor, vendedor ou usuário. Nas linhas de relatórios e movimentos de estoque, o atalho leva ao card de origem. Enter e Espaço também abrem a linha selecionada; botões e campos preservam suas ações.
- Os cards de clientes e fornecedores oferecem **PDF de faturas em aberto** para administrador e financeiro. O financeiro pode consultar esses cadastros sem ganhar permissão de edição.
- O relatório consulta todas as parcelas vinculadas ao ID do cadastro e separa vencidas de a vencer, incluindo hoje neste último grupo. Mostra valor original, pago, saldo e subtotais; exclui faturas pagas, canceladas, orçamentos e cotações. Pagamentos parciais reduzem o saldo apresentado.
- O PDF carrega sob demanda, repete cabeçalho e identificação em cada página e informa a data da posição. Não há alterações no banco ou nas faturas ao emitir o relatório.
