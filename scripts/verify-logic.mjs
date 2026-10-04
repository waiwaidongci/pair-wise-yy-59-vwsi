// 临时逻辑验证脚本：交接计划/回滚/门禁/指纹失效
import { buildBundle } from './store-bundle.mjs';

const {
  planHandover,
  restoreSnapshot,
  evaluateGate,
  fingerprintFor,
  useDisclosureStore
} = await buildBundle();

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass += 1; console.log('  PASS', label); }
  else { fail += 1; console.log('  FAIL', label); }
};

const state = useDisclosureStore.getState();

/* 1. 交接计划：周叙 -> 顾言，范围 DOC-00418 + DOC-00427 + 区域 R-02/R-04 */
const plan = planHandover(state.documents, state.reviewItems, {
  fromReviewerId: 'U-zhou',
  toReviewerId: 'U-gu',
  scope: { documentIds: ['DOC-00418', 'DOC-00427'], regionIds: ['R-02', 'R-04'] }
});
ok(plan.nextDocuments.find((d) => d.id === 'DOC-00427').ownerId === 'U-gu', '文档负责人转出 周叙→顾言');
ok(plan.nextDocuments.find((d) => d.id === 'DOC-00418').ownerId === 'U-lin', '范围外负责人关系不变（DOC-00418 负责人本是林清）');
ok(plan.nextDocuments.find((d) => d.id === 'DOC-00418').redactions.find((r) => r.id === 'R-02').assigneeId === 'U-gu', 'R-02 区域处理人转出');
ok(plan.nextDocuments.find((d) => d.id === 'DOC-00427').redactions.find((r) => r.id === 'R-04').assigneeId === 'U-gu', 'R-04 区域处理人转出');
const moved = plan.nextReviewItems.filter((i) => plan.changes.reviewItemIds.includes(i.id));
ok(moved.every((i) => i.assigneeId === 'U-gu' && i.status === 'pending'), '未完成复核按文档/区域重新分派');
ok(moved.map((i) => i.id).sort().join(',') === 'RV-101,RV-102', '仅转出人名下范围内待办被重派（RV-101/102；RV-204 本就分派给顾言）');
ok(plan.changes.documentIds.join(',') === 'DOC-00427', '实际改动文档负责人仅 DOC-00427');
const signedKept = plan.nextReviewItems.find((i) => i.id === 'RV-201');
ok(signedKept.status === 'signed' && signedKept.signedBy === 'U-zhou' && signedKept.history.length === 1, '已签结论只读保留，签字人仍是周叙');

/* 2. 快照恢复：回到原授权 */
const restored = restoreSnapshot(plan.nextDocuments, plan.nextReviewItems, plan.snapshot);
ok(restored.restoredDocs.find((d) => d.id === 'DOC-00427').ownerId === 'U-zhou', '回滚后 DOC-00427 负责人恢复为周叙');
ok(restored.restoredDocs.find((d) => d.id === 'DOC-00418').redactions.find((r) => r.id === 'R-02').assigneeId === 'U-zhou', '回滚后 R-02 处理人恢复');
ok(restored.restoredItems.find((i) => i.id === 'RV-101').assigneeId === 'U-zhou', '回滚后未完成复核分派恢复');

/* 3. 门禁：交接挂起时挡住批次 */
const handover = {
  id: 'HO-TEST-01', fromReviewerId: 'U-zhou', toReviewerId: 'U-gu',
  scope: { documentIds: ['DOC-00427'], regionIds: [] }, status: 'saving',
  createdAt: '10:00', attempts: 1, reason: 't'
};
const gateBlocked = evaluateGate(['DOC-00427'], state.documents, state.reviewItems, [handover]);
ok(gateBlocked.blocked && gateBlocked.reasons.some((r) => r.includes('授权交接未完成')), '交接完成前门禁挡住相关批次');
const gateOther = evaluateGate(['DOC-00435'], state.documents, state.reviewItems, [handover]);
ok(!gateOther.reasons.some((r) => r.includes('授权交接未完成')), '范围外批次不被该交接单拦截');
const gateDone = evaluateGate(['DOC-00427'], state.documents, state.reviewItems, [{ ...handover, status: 'completed' }]);
ok(!gateDone.reasons.some((r) => r.includes('授权交接未完成')), '交接完成后门禁不再因交接拦截');

/* 4. 指纹：密级变化导致失效 */
const d427 = state.documents.find((d) => d.id === 'DOC-00427');
const item201 = state.reviewItems.find((i) => i.id === 'RV-201');
const fpBefore = fingerprintFor(d427, item201);
const d427Changed = { ...d427, classification: '严格机密' };
ok(fpBefore !== fingerprintFor(d427Changed, item201), '密级变更使文档级复核指纹失配');
const d427RegionChanged = {
  ...d427,
  redactions: d427.redactions.map((r) => (r.id === 'R-04' ? { ...r, status: 'draft' } : r))
};
ok(fingerprintFor(d427, item201) !== fingerprintFor(d427RegionChanged, item201), '区域状态变更使文档级复核指纹失配');
const item203 = state.reviewItems.find((i) => i.id === 'RV-203');
ok(fingerprintFor(d427, item203) === fingerprintFor({ ...d427, classification: d427.classification }, item203), '对照组：无变更指纹一致');

/* 5. 端到端 store：越权签字拒绝、合法签字、改密级失效 */
useDisclosureStore.setState({ currentUserId: 'U-lin' });
const beforeCount = useDisclosureStore.getState().notices.length;
useDisclosureStore.getState().signReview('RV-101', 'pass'); // RV-101 分给周叙
ok(useDisclosureStore.getState().reviewItems.find((i) => i.id === 'RV-101').status === 'pending', '越权签字被拒绝（项仍待办）');
ok(useDisclosureStore.getState().notices.some((n) => n.tone === 'error' && n.text.includes('越权')), '越权提交弹出拒绝提示');

// 离岗账号周叙即便项分派给他也不能签
useDisclosureStore.setState({ currentUserId: 'U-zhou' });
useDisclosureStore.getState().signReview('RV-101', 'pass');
ok(useDisclosureStore.getState().reviewItems.find((i) => i.id === 'RV-101').status === 'pending', '离岗账号签字被拒绝');

// 顾言签 RV-204（他承接的元数据复核）
useDisclosureStore.setState({ currentUserId: 'U-gu' });
useDisclosureStore.getState().signReview('RV-204', 'pass');
ok(useDisclosureStore.getState().reviewItems.find((i) => i.id === 'RV-204').status === 'signed', '承接人合法签字成功');

// 已签不可覆盖（只读）
useDisclosureStore.getState().signReview('RV-204', 'reject');
const rv204 = useDisclosureStore.getState().reviewItems.find((i) => i.id === 'RV-204');
ok(rv204.verdict === 'pass' && rv204.history.length === 1, '已签结论只读，不能重签覆盖');

// 密级一改，受影响复核失效重算（用林清改 DOC-00418 密级）
useDisclosureStore.setState({ currentUserId: 'U-lin' });
useDisclosureStore.getState().selectDocument('DOC-00418');
useDisclosureStore.getState().updateClassification('机密');
const rv103 = useDisclosureStore.getState().reviewItems.find((i) => i.id === 'RV-103');
ok(rv103.status === 'pending' && rv103.history[0].invalidated === true, '密级变更后已签复核失效退回重算，原结论只读留档');

// 越权改密级：顾言不是 DOC-00418 负责人
useDisclosureStore.setState({ currentUserId: 'U-gu' });
useDisclosureStore.getState().updateClassification('内部');
ok(useDisclosureStore.getState().documents.find((d) => d.id === 'DOC-00418').classification === '机密', '越权改密级被拒绝');

/* 6. 端到端：失败回滚 + 同一交接号重试 */
useDisclosureStore.setState({ simulateSaveFailure: true });
const id = useDisclosureStore.getState().createHandover({
  fromReviewerId: 'U-zhou', toReviewerId: 'U-shen', reason: '离岗',
  scope: { documentIds: ['DOC-00427'], regionIds: [] }
});
ok(typeof id === 'string' && /^HO-/.test(id), `交接单生成，交接号 ${id}`);
await useDisclosureStore.getState().executeHandover(id);
let hs = useDisclosureStore.getState();
let h = hs.handovers.find((x) => x.id === id);
ok(h.status === 'failed' && h.attempts === 1, '保存失败后状态为 failed');
ok(hs.documents.find((d) => d.id === 'DOC-00427').ownerId === 'U-zhou', '失败后负责人仍是原授权（周叙），未发生人换权未换');
ok(hs.reviewItems.filter((i) => i.documentId === 'DOC-00427' && i.status === 'pending').every((i) => true), '失败后状态一致');

// 同一交接号重试并成功
useDisclosureStore.setState({ simulateSaveFailure: false });
await useDisclosureStore.getState().executeHandover(id);
hs = useDisclosureStore.getState();
h = hs.handovers.find((x) => x.id === id);
ok(h.status === 'completed' && h.attempts === 2, `同一交接号 ${id} 重试成功（第 2 次尝试）`);
ok(hs.documents.find((d) => d.id === 'DOC-00427').ownerId === 'U-shen', '成功后负责人转给沈砚');
ok(hs.reviewItems.find((i) => i.id === 'RV-201').signedBy === 'U-zhou', '已签结论仍保留周叙签字');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
