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

## Status
Estrutura inicial criada. A conexão com o projeto Supabase será ativada assim que o novo projeto for provisionado.
