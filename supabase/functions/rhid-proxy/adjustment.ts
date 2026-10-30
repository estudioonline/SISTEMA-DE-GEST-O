// Wire contract captured from RHID's own maintenance screen. No credentials here.
export type RecordValue = Record<string, any>;
export type Punch = { idPerson: number; idAfd: number; idAfdChange: number; dateTimeStr: string; pis?: number };
export class AdjustmentError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 409) {
    super(message); this.code = code; this.status = status;
  }
}
export function fail(code: string, message: string, status = 409): never {
  throw new AdjustmentError(code, message, status);
}
export function compactDate(date: string): string {
  const parsed = new Date(date + 'T12:00:00Z');
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    fail('INVALID_DATE', 'Data inválida.', 400);
  return date.replaceAll('-', '');
}
export function timestamp(value: unknown): string | null {
  const s = String(value ?? '');
  if (/^20\d{10}$/.test(s)) return s;
  const m = s.match(/^(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/);
  // RHID supplies wall-clock attendance times; do not convert them through UTC.
  return m ? m.slice(1, 6).join('') : null;
}
export function records(value: unknown, out: RecordValue[] = [], depth = 0): RecordValue[] {
  if (depth > 16) fail('UNKNOWN_RHID_RESPONSE', 'Estrutura da resposta RHID não reconhecida.');
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try { return records(JSON.parse(value), out, depth + 1); } catch (e) { if (e instanceof AdjustmentError) throw e; }
  }
  if (Array.isArray(value)) { for (const item of value) records(item, out, depth + 1); }
  else if (value && typeof value === 'object') {
    out.push(value as RecordValue);
    for (const child of Object.values(value)) records(child, out, depth + 1);
  }
  return out;
}
export function assertUpstream(body: unknown) {
  for (const o of records(body)) {
    if (o.success === false || o.ok === false || o.error || o.errors && (!Array.isArray(o.errors) || o.errors.length))
      fail('RHID_REJECTED', 'O RHID retornou uma falha. A gravação não foi confirmada.', 502);
  }
}
export function desiredTimes(row: RecordValue): string[] {
  compactDate(row.data);
  const slots = ['entrada_1', 'saida_1', 'entrada_2', 'saida_2'].map(k => row[k]);
  const times: string[] = [];
  for (const value of slots) {
    if (value == null || value === '') continue;
    if (!/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(String(value)))
      fail('INVALID_TIME', 'Use horários válidos com precisão de minutos.', 400);
    times.push(String(value).slice(0, 5));
  }
  if (times.some((t, i) => i > 0 && t <= times[i - 1]))
    fail('INVALID_ORDER', 'As marcações devem estar em ordem, sem duplicação ou virada de dia.', 400);
  return times;
}
const inactive = (o: RecordValue) => o.excluded === true || o.excluded === 1 || o.excluded === '1' || o._typeAfdChange === 'X';
export function readPunches(body: unknown, person: number, date: string): Punch[] {
  assertUpstream(body);
  const day = compactDate(date), objects = records(body);
  // Only treat explicit raw attendance collections as authoritative. A totals-only
  // or unexpected response must never be interpreted as an empty working day.
  const recognized = (Array.isArray(body) && body.length === 0) || objects.some(o =>
    ['afds', 'afd', 'afdChanges', 'punches', 'listAfd', 'listAfdChange'].some(k => Array.isArray(o[k])) ||
    (timestamp(o.dateTimeStr ?? o.dateTime ?? o.datetime) != null && (Number(o.idAfd) > 0 || Number(o.idAfdChange) > 0)));
  if (!recognized) fail('UNKNOWN_ATTENDANCE', 'A leitura RHID não trouxe a coleção de marcações esperada.');
  const result = new Map<string, Punch>();
  for (const o of objects) {
    const t = timestamp(o.dateTimeStr ?? o.dateTime ?? o.datetime);
    if (!t || !t.startsWith(day) || inactive(o)) continue;
    if (o.idPerson != null && Number(o.idPerson) !== person) continue;
    if (o.idPerson == null || !(Number(o.idAfd) > 0 || Number(o.idAfdChange) > 0))
      fail('UNKNOWN_PUNCH', 'Há uma marcação sem identificação suficiente para alteração segura.');
    const p = {idPerson: person, idAfd: Number(o.idAfd || 0), idAfdChange: Number(o.idAfdChange || 0), dateTimeStr: t};
    const key = `${p.idAfd}:${p.idAfdChange}`;
    const prev = result.get(key);
    if (prev && prev.dateTimeStr !== t) fail('AMBIGUOUS_PUNCH', 'O RHID retornou marcações conflitantes.');
    result.set(key, p);
  }
  const punches = [...result.values()].sort((a, b) => a.dateTimeStr.localeCompare(b.dateTimeStr));
  if (punches.length > 4 || new Set(punches.map(p => p.dateTimeStr)).size !== punches.length)
    fail('COMPLEX_DAY', 'Este dia exige manutenção diretamente no RHID.');
  return punches;
}
export const punchTimes = (punches: Punch[]) => punches.map(p => p.dateTimeStr.slice(8, 10) + ':' + p.dateTimeStr.slice(10, 12));
export const sameTimes = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
export function checkSnapshot(snapshot: unknown, current: Punch[]) {
  if (snapshot == null) {
    if (current.length) fail('STALE_SNAPSHOT', 'Recarregue e salve o ajuste: há marcações novas no RHID.');
    return;
  }
  const s = snapshot as RecordValue;
  if (!Array.isArray(s.punches)) fail('INVALID_SNAPSHOT', 'Recarregue e salve novamente o ajuste.');
  const times = s.punches.map((p: RecordValue) => String(p.time)).sort();
  if (!sameTimes(times, punchTimes(current))) fail('STALE_SNAPSHOT', 'O ponto mudou no RHID. Recarregue e revise o ajuste.');
}
export function makePlan(person: number, pis: number, operator: number, row: RecordValue, current: Punch[]) {
  if (![person, pis, operator].every(n => Number.isSafeInteger(n) && n > 0))
    fail('INVALID_IDENTITY', 'Pessoa, PIS ou operador RHID inválido.', 400);
  const day = compactDate(row.data), desired = desiredTimes(row);
  const reason = String(row.observacao || '').trim();
  if (!reason || reason.length > 500) fail('REASON_REQUIRED', 'Informe uma justificativa de até 500 caracteres.', 400);
  const desiredStamps = desired.map(t => day + t.replace(':', ''));
  const changes: RecordValue[] = [];
  for (const p of current) {
    if (desiredStamps.includes(p.dateTimeStr)) {
      changes.push({pis, idPerson: person, idAfd: p.idAfd, ...(p.idAfdChange ? {idAfdChange: p.idAfdChange} : {}), dateTimeStr: p.dateTimeStr, _typeAfdChange: 'D', deslocamento: 0});
    } else {
      // The captured X contract is for a manual mark. Never guess how an original
      // clock record must be disregarded, even when it also has a change id.
      if (p.idAfd > 0 || p.idAfdChange <= 0)
        fail('ORIGINAL_PUNCH_PROTECTED', 'A alteração de uma batida original do relógio exige manutenção no RHID.');
      changes.push({pis, idPerson: person, idAfdChange: p.idAfdChange, dateTimeStr: p.dateTimeStr, reason, excluded: 1, idOperatorDeleted: operator, _typeAfdChange: 'X', deslocamento: 0});
    }
  }
  for (const t of desiredStamps) if (!current.some(p => p.dateTimeStr === t)) {
    changes.push({pis, idPerson: person, idAfd: 0, dateTimeStr: t, reason, excluded: 0, idOperator: operator, _typeAfdChange: 'I', deslocamento: 0});
  }
  return {idPerson: [person], ini: day, fim: day, afdChanges: changes};
}
export function verifyAudit(body: unknown, person: number, changes: RecordValue[]) {
  assertUpstream(body);
  const entries = records(body);
  const operations = changes.filter(c => c._typeAfdChange !== 'D');
  if (!operations.length) return false;
  return operations.every(change => entries.some(o => {
    if (Number(o.idPerson) !== person || timestamp(o.dateTimeStr ?? o.dateTime) !== change.dateTimeStr) return false;
    if (change._typeAfdChange === 'X')
      return Number(o.idAfdChange) === change.idAfdChange && inactive(o);
    return Number(o.idAfdChange) > 0 && !inactive(o) && String(o.reason ?? '') === change.reason;
  }));
}

