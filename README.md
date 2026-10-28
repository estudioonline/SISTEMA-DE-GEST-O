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

### Pendências explícitas
- Habilitar proteção contra senhas vazadas no Supabase Auth (aviso remanescente do assessor de segurança).
- Fluxo de estorno de pagamentos e comissões com lançamentos compensatórios; enquanto isso, cancelamentos de documentos pagos são bloqueados.
- Alteração da política de estoque de pedidos abertos requer migração própria; mantém-se a baixa de estoque atual ao confirmar pedido.
- Reconciliar o histórico anterior do banco com os antigos arquivos `001`/`002` antes de usar `db push` ou recriar o banco do zero. Os arquivos desta entrega correspondem às versões remotas; `schema-before-functions.sql` é apenas uma referência das funções anteriores, não uma migração-base completa.
- Categorias financeiras/centros de custo existentes e fechamentos de comissão ainda não têm uma tela de administração completa.
- Paginação integral de relatórios e histórico de autorizações (a central mostra os 200 registros mais recentes), além de divisão do pacote frontend para melhorar o carregamento.
- O salvamento direto da venda ainda grava rota/validade em uma segunda chamada; se essa gravação falhar, a venda salva é mantida e a tela solicita correção, evitando um novo cadastro por reenvio. A aprovação pela central grava tudo na mesma transação.
