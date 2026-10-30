import {assertUpstream, checkSnapshot, compactDate, desiredTimes, fail, makePlan, punchTimes, readPunches, records, sameTimes, verifyAudit} from './adjustment.ts';
import type {RecordValue} from './adjustment.ts';

const WRITE_URL = 'https://www.rhid.com.br/v2/customerdb/afdchange.svc/insertlist2';
const READ_URL = 'https://www.rhid.com.br/v2/api.svc/apuracao_ponto';
// Same audit route used by the deployed adjustments action.
const AUDIT_URL = 'https://www.rhid.com.br/v2/api.svc/report.svc/list_alteracoes_ponto';
const fields = ['funcionario_id', 'data', 'entrada_1', 'saida_1', 'entrada_2', 'saida_2', 'observacao', 'status'];
const fingerprint = (row: RecordValue, person: number) => JSON.stringify([person, ...fields.map(k => row[k] ?? null)]);
const checked = (result: any) => { if (result.error) fail('SG_STORAGE_ERROR', 'Não foi possível registrar a operação no SG.', 500); return result.data; };

export async function sendAdjustment(payload: RecordValue, access: {db: any; userId: string; canEdit: boolean}, login: () => Promise<string>, options: {fetcher?: typeof fetch; operatorId?: number} = {}) {
  if (!access.canEdit) fail('FORBIDDEN', 'É necessária permissão de edição no RH.', 403);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(payload.adjustment_id || '')))
    fail('INVALID_ADJUSTMENT', 'Informe o identificador do ajuste salvo no SG.', 400);
  const db = access.db;
  const row = checked(await db.from('rh_ponto_ajustes').select('*').eq('id', payload.adjustment_id).single());
  if (!row) fail('NOT_FOUND', 'Ajuste não encontrado.', 404);
  const employee = checked(await db.from('funcionarios').select('id,ativo,rhid_person_id').eq('id', row.funcionario_id).single());
  const person = Number(employee?.rhid_person_id);
  if (!employee?.ativo || !Number.isSafeInteger(person) || person <= 0) fail('INVALID_EMPLOYEE', 'Funcionário sem vínculo RHID ativo.', 400);
  const day = compactDate(row.data), desired = desiredTimes(row), version = fingerprint(row, person);
  if (row.envio_status === 'enviando') fail('IN_PROGRESS', 'Há um envio em andamento. Atualize a tela; não repita a gravação.');
  const oldReceipt = row.rhid_resposta;
  const recovering = oldReceipt?.request_sent === true && oldReceipt?.fingerprint === version;
  const attemptId = crypto.randomUUID();
  let receipt: RecordValue = recovering ? {...oldReceipt, attempt_id: attemptId} : {attempt_id: attemptId, fingerprint: version, request_sent: false};
  let claim = db.from('rh_ponto_ajustes').update({envio_status: 'enviando', envio_erro: null, rhid_resposta: receipt}).eq('id', row.id);
  claim = row.envio_status == null ? claim.is('envio_status', null) : claim.eq('envio_status', row.envio_status);
  for (const k of fields) claim = row[k] == null ? claim.is(k, null) : claim.eq(k, row[k]);
  const claimed = checked(await claim.select('id').maybeSingle());
  if (!claimed) fail('CONCURRENT_CHANGE', 'O ajuste mudou durante o envio. Recarregue a tela.');

  async function update(values: RecordValue) {
    const updated = checked(await db.from('rh_ponto_ajustes').update(values).eq('id', row.id)
      .eq('rhid_resposta->>attempt_id', attemptId).eq('envio_status', 'enviando').select('id').maybeSingle());
    if (!updated) fail('CONCURRENT_CHANGE', 'O ajuste mudou; confira o RHID antes de outra tentativa.');
  }
  async function history(action: string, details: RecordValue) {
    checked(await db.from('rh_ponto_ajustes_historico').insert({ajuste_id: row.id, funcionario_id: row.funcionario_id, data: row.data,
      acao: action, usuario_id: access.userId, resposta_rhid: details}));
  }
  try {
    await history('inicio_envio_rhid', {attempt_id: attemptId, recovering});
    const token = await login();
    const fetcher = options.fetcher || fetch;
    async function request(url: string, body?: unknown) {
      let res: Response;
      try {
        res = await fetcher(url, {method: body === undefined ? 'GET' : 'POST',
          headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json'},
          ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(20000), redirect: 'error'});
      } catch { fail('RHID_CONNECTION', 'A comunicação com o RHID falhou. A gravação pode ter ocorrido; confira pela releitura.', 502); }
      if (!res.ok) fail('RHID_HTTP_ERROR', `RHID respondeu HTTP ${res.status}. Confira a releitura antes de reenviar.`, 502);
      let parsed: unknown;
      try { parsed = await res.json(); } catch { fail('RHID_INVALID_RESPONSE', 'RHID retornou uma resposta não reconhecida.', 502); }
      assertUpstream(parsed);
      return {body: parsed, status: res.status};
    }
    const attendance = async () => (await request(`${READ_URL}?idPerson=${person}&dataIni=${row.data}&dataFinal=${row.data}`)).body;
    const audit = async () => (await request(AUDIT_URL, {approvalStatus: [], departments: [], companies: [], people: [person],
      ini: day, fim: day, insertedIni: '', insertedFim: '', classification: 'any', pendenciesOnly: false})).body;
    let current = readPunches(await attendance(), person, row.data);
    if (!recovering) {
      if (sameTimes(punchTimes(current), desired)) fail('NO_PUNCH_CHANGE', 'Não há alteração de batida a enviar. Status e abonos exigem tratamento próprio no RHID.');
      checkSnapshot(row.rhid_snapshot, current);
      const people = (await request('https://www.rhid.com.br/v2/api.svc/person')).body;
      const matches = records(people).filter(o => Number(o.idPerson ?? o.id) === person && o.pis != null);
      const identities = [...new Set(matches.map(p => Number(p.pis)))];
      if (identities.length !== 1) fail('UNKNOWN_PERSON_PIS', 'Não foi possível confirmar o PIS do funcionário no RHID.');
      // Operator 1 was confirmed by the account owner against the captured payload.
      const plan = makePlan(person, identities[0], options.operatorId ?? 1, row, current);
      const operations = plan.afdChanges.filter(c => c._typeAfdChange !== 'D').map(({pis: _pis, ...operation}) => operation);
      // Persist intent before dispatch. An uncertain result is only reconciled,
      // never automatically resent, including after a timeout or worker crash.
      receipt = {...receipt, request_sent: true, operations, desired, upstream_url: WRITE_URL};
      await update({rhid_resposta: receipt});
      await history('requisicao_rhid_preparada', {attempt_id: attemptId, operations});
      const result = await request(WRITE_URL, plan);
      receipt = {...receipt, upstream_status: result.status};
      await update({rhid_resposta: receipt});
    }
    const operations = receipt.operations;
    if (!Array.isArray(operations) || !operations.length) fail('MISSING_RECEIPT', 'Faltam dados da tentativa anterior. Confira a auditoria no RHID.');
    let confirmed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      current = readPunches(await attendance(), person, row.data);
      if (sameTimes(punchTimes(current), desired) && verifyAudit(await audit(), person, operations)) { confirmed = true; break; }
    }
    if (!confirmed) fail('RHID_NOT_VERIFIED', 'A alteração ainda não foi confirmada pela releitura e auditoria. Outra tentativa apenas verificará o resultado, sem reenviar.');
    const verifiedAt = new Date().toISOString();
    receipt = {...receipt, verified: true, verified_at: verifiedAt, attendance_verified: true, audit_verified: true};
    // Audit storage must succeed before marking the adjustment as synchronized.
    await history('enviado_rhid', {attempt_id: attemptId, attendance_verified: true, audit_verified: true, verified_at: verifiedAt});
    await update({envio_status: 'enviado', enviado_em: verifiedAt, enviado_por: access.userId, envio_erro: null, rhid_resposta: receipt});
    return {ok: true, verified: true, attendance_verified: true, audit_verified: true, recovered: recovering, attempt_id: attemptId};
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'SG_RHID_ERROR';
    // Do not return upstream bodies, request headers, credentials or unfiltered SDK errors.
    const message = error instanceof Error && 'code' in error ? error.message : 'Não foi possível concluir o envio. Consulte a situação no RHID.';
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500;
    receipt = {...receipt, verified: false, error_code: code};
    try {
      await history('erro_envio_rhid', {attempt_id: attemptId, error_code: code, request_sent: receipt.request_sent === true});
      await update({envio_status: 'erro', envio_erro: message, rhid_resposta: receipt});
    } catch { fail('SG_RECONCILIATION_REQUIRED', 'O SG não conseguiu registrar o resultado. Confira o RHID e o histórico antes de reenviar.', 500); }
    fail(code, message, status);
  }
}

