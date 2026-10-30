# Gravação de ajustes no RHID

O envio usa `POST https://www.rhid.com.br/v2/customerdb/afdchange.svc/insertlist2`, conforme corpo capturado pelo proprietário da conta em 30/10/2026. O operador dessa conta foi confirmado como `1`. Se a conta de integração mudar, revise o operador antes de enviar.

O backend recebe somente `adjustment_id` e busca o funcionário, horários e justificativa no ajuste salvo no SG. Acesso de leitura ao Financeiro não permite envio. A verificação JWT permanece habilitada e as consultas do SG usam a sessão do usuário e as regras existentes de acesso.

## Contrato de gravação

Exemplo com identificadores fictícios:

```json
{
  "idPerson": [7],
  "ini": "20260626",
  "fim": "20260626",
  "afdChanges": [
    {"pis": 12345678901, "idPerson": 7, "idAfd": 0, "idAfdChange": 11, "dateTimeStr": "202606261300", "_typeAfdChange": "D", "deslocamento": 0},
    {"pis": 12345678901, "idPerson": 7, "idAfd": 0, "dateTimeStr": "202606260801", "reason": "ajuste", "excluded": 0, "idOperator": 1, "_typeAfdChange": "I", "deslocamento": 0},
    {"pis": 12345678901, "idPerson": 7, "idAfdChange": 12, "dateTimeStr": "202606260800", "reason": "ajuste", "excluded": 1, "idOperatorDeleted": 1, "_typeAfdChange": "X", "deslocamento": 0}
  ]
}
```

`dateTimeStr` é hora local do ponto, no formato `AAAAMMDDHHmm`. Não passa por conversão para UTC. `I` inclui, `X` desconsidera uma marcação manual e `D` mantém. O pedido é limitado ao funcionário e dia do ajuste. PIS e IDs vêm de nova leitura do RHID. Os IDs acima não devem ser copiados para produção.

O formato de desconsideração de batidas originais do relógio não foi capturado. O adaptador recusa essa alteração; também recusa horários com segundos diferentes de zero, virada de dia, mais de quatro batidas, duplicações e respostas sem identificação suficiente. Abonos, folgas, atestados e mudanças somente de status continuam exigindo tratamento específico no RHID; este endpoint implementa alterações de batidas.

## Confirmação e repetição

1. Buscar o ajuste e validar acesso de edição.
2. Reservar o envio com comparação do estado e dos campos salvos.
3. Ler as batidas atuais e comparar com o snapshot do ajuste.
4. Montar a diferença e registrar a intenção antes do POST.
5. Enviar ao RHID uma única vez.
6. Reler a apuração e consultar `list_alteracoes_ponto`.
7. Somente quando horários e todas as operações da auditoria coincidirem, registrar o histórico e marcar `enviado`; a tela apresenta **Sincronizado**.

HTTP 200 sozinho não confirma persistência. Respostas com falha de negócio são recusadas. O recibo do SG guarda os identificadores das operações e os resultados da verificação, sem senha, token, cabeçalhos ou PIS.

Se o POST ficar incerto por timeout ou falha de comunicação, a próxima tentativa apenas reconcilia a leitura e a auditoria. Não repete o POST. Se a tentativa foi interrompida com estado `enviando`, um responsável deve conferir os registros RHID antes de liberar o ajuste; não redefina o estado para forçar uma nova gravação. Uma falha parcial ou resposta não reconhecida exige revisão no RHID. A interface impede nova edição enquanto existe gravação pendente de confirmação.

As rotas de leitura e auditoria foram preservadas da função publicada anteriormente. Os formatos de retorno são validados estritamente; se não houver os campos de correlação necessários, o SG mantém erro e não afirma sincronização. Validar esses retornos contra a conta real faz parte do teste integrado.

## Verificação

`node --test tests/rhid-adjustment.test.ts tests/rhid-send-adjustment.test.ts`

Os testes usam dados fictícios e transporte simulado. Cobrem o corpo capturado, edição manual, proteção do relógio, datas, snapshot desatualizado, ausência de auditoria, erro de negócio, timeout, concorrência e permissão de leitura. Não substituem a prova real no cadastro de teste, com releitura e auditoria RHID.

Para publicar a função, envie `index.ts`, `adjustment.ts` e `send-adjustment.ts` como uma unidade, mantendo `verify_jwt=true`. A versão anterior deve ser preservada para reversão de código. A reversão da função não desfaz alterações já gravadas no RHID.

