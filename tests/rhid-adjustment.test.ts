import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactDate, desiredTimes, makePlan, readPunches, checkSnapshot, verifyAudit, assertUpstream} from '../supabase/functions/rhid-proxy/adjustment.ts';
import {parseRhidAttendance} from '../src/lib/rhid.ts';

const row = {data: '2026-06-26', entrada_1: '08:01:00', saida_1: '13:00:00', entrada_2: null, saida_2: null, observacao: 'ajuste'};
// Synthetic identifiers: the test keeps the captured schema without copying PIS.
const current = [
  {idPerson: 7, idAfd: 0, idAfdChange: 12, dateTimeStr: '202606260800'},
  {idPerson: 7, idAfd: 0, idAfdChange: 11, dateTimeStr: '202606261300'},
];
test('manual replacement reproduces captured I, X and D contract for one person', () => {
  const plan = makePlan(7, 12345678901, 1, row, current);
  assert.deepEqual(plan.idPerson, [7]);
  assert.equal(plan.ini, '20260626'); assert.equal(plan.fim, plan.ini);
  const d = plan.afdChanges.find(c => c._typeAfdChange === 'D');
  const i = plan.afdChanges.find(c => c._typeAfdChange === 'I');
  const x = plan.afdChanges.find(c => c._typeAfdChange === 'X');
  assert.deepEqual(d, {pis:12345678901,idPerson:7,idAfd:0,idAfdChange:11,dateTimeStr:'202606261300',_typeAfdChange:'D',deslocamento:0});
  assert.deepEqual(i, {pis:12345678901,idPerson:7,idAfd:0,dateTimeStr:'202606260801',reason:'ajuste',excluded:0,idOperator:1,_typeAfdChange:'I',deslocamento:0});
  assert.deepEqual(x, {pis:12345678901,idPerson:7,idAfdChange:12,dateTimeStr:'202606260800',reason:'ajuste',excluded:1,idOperatorDeleted:1,_typeAfdChange:'X',deslocamento:0});
});
test('original clock marks cannot be deleted, even with a change id', () => {
  assert.throws(() => makePlan(7,12345678901,1,row,[{...current[0],idAfd:99}]), /original/);
});
test('already matching timestamps only produce D, never duplicate I', () => {
  const plan = makePlan(7,12345678901,1,{...row,entrada_1:'08:00'},current);
  assert.ok(plan.afdChanges.every(c => c._typeAfdChange === 'D'));
});
test('invalid dates, nonzero seconds, reversed times and missing reason are refused', () => {
  assert.throws(() => compactDate('2026-02-30'));
  assert.throws(() => desiredTimes({...row,entrada_1:'08:01:30'}));
  assert.throws(() => desiredTimes({...row,entrada_1:'14:00'}));
  assert.throws(() => desiredTimes({...row,entrada_1:null}));
  assert.throws(() => makePlan(7,12345678901,1,{...row,observacao:''},current));
});
test('read filters excluded marks and other people, handles both timestamp formats', () => {
  const data = {afdChanges:[...current,{...current[0],idAfdChange:13,excluded:1},
    {...current[0],idPerson:8,idAfdChange:14},
    {idPerson:7,idAfd:0,idAfdChange:15,dateTime:'2026-06-26T17:00:00'}]};
  assert.deepEqual(readPunches(data,7,row.data).map(p=>p.dateTimeStr),['202606260800','202606261300','202606261700']);
});
test('totals or unknown responses must not be mistaken for an empty day', () => {
  assert.throws(() => readPunches({total:0},7,row.data));
  assert.throws(() => readPunches([{total:8,date:'2026-06-26'}],7,row.data));
  assert.throws(() => readPunches({punches:[{dateTimeStr:'202606260800'}]},7,row.data));
  assert.deepEqual(readPunches([],7,row.data),[]);
});
test('remote changes and missing baseline refuse the write', () => {
  assert.throws(()=>checkSnapshot(null,current));
  assert.throws(()=>checkSnapshot({punches:[{time:'09:00'}]},current));
  assert.doesNotThrow(()=>checkSnapshot({punches:[{time:'08:00'},{time:'13:00'}]},current));
});
test('audit must prove each operation for the exact person, timestamp and manual id', () => {
  const plan = makePlan(7,12345678901,1,row,current);
  const audit = [
    {idPerson:7,idAfdChange:16,dateTimeStr:'202606260801',reason:'ajuste',excluded:0},
    {idPerson:7,idAfdChange:12,dateTimeStr:'202606260800',excluded:1}
  ];
  assert.equal(verifyAudit(audit,7,plan.afdChanges),true);
  assert.equal(verifyAudit(audit.slice(0,1),7,plan.afdChanges),false);
  assert.equal(verifyAudit(audit,8,plan.afdChanges),false);
  assert.equal(verifyAudit([{...audit[0],excluded:1},audit[1]],7,plan.afdChanges),false);
  assert.equal(verifyAudit(audit,7,[]),false);
});
test('HTTP-success business errors are still rejected',()=>{
  assert.throws(()=>assertUpstream({success:false}));
  assert.throws(()=>assertUpstream({error:'failure'}));
});
test('mirror parser reads compact wire timestamps and omits excluded entries',()=>{
  const parsed=parseRhidAttendance({afdChanges:[...current,{idPerson:7,idAfdChange:13,dateTimeStr:'202606260801',excluded:1}]});
  assert.equal(parsed.length,1); assert.equal(parsed[0].entrada_1,'08:00'); assert.equal(parsed[0].saida_1,'13:00');
  assert.equal(parsed[0].punches.length,2);
});



