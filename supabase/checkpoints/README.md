# Reconciliação do histórico do ERP

O diretório `supabase/migrations` contém as versões e instruções recuperadas do histórico real de ORGJSS1. Os antigos arquivos `001` e `002`, que não constavam desse histórico, foram preservados em `supabase/history/legacy` e não são reaplicados.

`migration-manifest.json` registra as assinaturas dos arquivos aplicados. Execute `node scripts/check-migration-history.mjs` para verificar o histórico local. Novas mudanças devem ser novas migrações; arquivos já aplicados não devem ser editados.

## Projeto existente

Use as migrações incrementais. Não execute o checkpoint nem o bootstrap em produção. Nenhum histórico remoto foi apagado ou marcado como revertido nesta reconciliação.

## Projeto Supabase vazio

O checkpoint contém a estrutura das tabelas, funções, restrições, índices, views, políticas, gatilhos e permissões da aplicação. Ele pressupõe os schemas e papéis gerenciados pelo Supabase. Não contém usuários, senhas, documentos, pagamentos ou arquivos existentes.

Use `psql` com a conexão de um projeto de testes vazio e execute `supabase/checkpoints/bootstrap_empty_project.sql`. O script abre uma transação, recusa um banco que já tenha a tabela de vendas, inclui o checkpoint, cria a configuração inicial e o bucket privado de comprovantes, e registra as versões representadas pelo checkpoint. Assim, as migrações antigas não precisam ser reaplicadas sobre a estrutura consolidada.

Depois do bootstrap, crie o administrador pelo fluxo normal do Supabase Auth e libere seu perfil por um operador autorizado. Não há usuário ou credencial de administrador embutidos no checkpoint.

## Verificação realizada

`tests/checkpoint-rebuild.sql` reconstrói os 21 objetos de tabela da aplicação em dois schemas isolados, verifica a quantidade de funções e executa venda, pagamento e estorno no esquema reconstruído. Uma exceção controlada reverte a estrutura e os dados de teste. Os gatilhos do Auth e as políticas do Storage são incluídos no checkpoint, mas não são anexados aos serviços reais nesse teste.

Configurações do serviço de autenticação, usuários e conteúdo do Storage exigem um plano de backup próprio. O checkpoint valida a reconstrução da estrutura da aplicação e não substitui backup restaurável do projeto.
