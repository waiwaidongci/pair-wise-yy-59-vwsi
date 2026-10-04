import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ============================== 领域模型 ============================== */

export type Reviewer = {
  id: string;
  name: string;
  team: string;
  role: '审核员' | '复核员' | '组长';
  /** false 表示已离岗，不能再承接或提交授权范围内的操作 */
  available: boolean;
};

export type Redaction = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
  privilege: string;
  status: 'draft' | 'confirmed';
  /** 区域去密责任人（授权主体之一），交接时可按区域转出 */
  assigneeId: string;
};

export type DisclosureRecord = {
  id: string;
  title: string;
  bundle: string;
  pages: number;
  classification: '内部' | '机密' | '严格机密';
  /** 文档负责人（授权主体之一），交接时按文档转出 */
  ownerId: string;
  updatedAt: string;
  status: '去密中' | '待质检' | '可发布';
  issue: string;
  size: string;
  redactions: Redaction[];
};

export type ReviewVerdict = 'pass' | 'reject';
export type ReviewKind = '区域复核' | '原页比对' | '发布页比对' | '元数据';

export type ReviewHistoryEntry = {
  verdict: ReviewVerdict;
  signedBy: string;
  signedByName: string;
  signedAt: string;
  /** 签字时密级/区域状态指纹；与当前不一致即失效 */
  fingerprint: string;
  invalidated: boolean;
  note?: string;
};

export type ReviewItem = {
  id: string;
  documentId: string;
  /** 有值为区域级复核，无值为文档级复核 */
  redactionId?: string;
  kind: ReviewKind;
  label: string;
  /** 未完成项的当前承接人；交接只改这一项，签字结论不动 */
  assigneeId: string;
  status: 'pending' | 'signed';
  verdict?: ReviewVerdict;
  signedBy?: string;
  signedAt?: string;
  fingerprint?: string;
  note?: string;
  /** 已签结论只读留档；密级/区域变更后原结论沉入此处 */
  history: ReviewHistoryEntry[];
};

export type HandoverScope = {
  documentIds: string[];
  regionIds: string[];
};

export type AuthzSnapshot = {
  ownerById: Record<string, string>;
  regionAssigneeById: Record<string, string>;
  reviewItems: ReviewItem[];
};

export type HandoverStatus = 'draft' | 'saving' | 'failed' | 'completed';

export type HandoverRecord = {
  id: string;
  reason: string;
  fromReviewerId: string;
  toReviewerId: string;
  scope: HandoverScope;
  status: HandoverStatus;
  createdAt: string;
  completedAt?: string;
  attempts: number;
  lastError?: string;
  /** 执行前抓取的原授权快照，保存失败时据此整体回滚 */
  snapshot?: AuthzSnapshot;
  /** 本次实际改动的授权主体，供审计 */
  changes?: { documentIds: string[]; regionIds: string[]; reviewItemIds: string[] };
};

export type Notice = {
  id: string;
  tone: 'error' | 'success' | 'info';
  text: string;
};

/* ============================== 种子数据 ============================== */

export const reviewers: Reviewer[] = [
  { id: 'U-lin', name: '林清', team: '审核组', role: '审核员', available: true },
  { id: 'U-zhou', name: '周叙', team: '复核组', role: '复核员', available: false },
  { id: 'U-gu', name: '顾言', team: '复核组', role: '复核员', available: true },
  { id: 'U-shen', name: '沈砚', team: '审核组', role: '组长', available: true }
];

const reviewerName = (id: string) => reviewers.find((item) => item.id === id)?.name ?? id;

const defaultDocuments: DisclosureRecord[] = [
  {
    id: 'DOC-00418',
    title: '设备采购补充协议（第三版）',
    bundle: '北岭项目 · 第一批披露',
    pages: 3,
    classification: '严格机密',
    ownerId: 'U-lin',
    updatedAt: '09:48',
    status: '去密中',
    issue: '合同主体与商业条款',
    size: '8.4 MB',
    redactions: [
      { id: 'R-01', page: 1, x: 0.12, y: 0.16, width: 0.30, height: 0.04, reason: '商业秘密', privilege: '合同保密', status: 'confirmed', assigneeId: 'U-lin' },
      { id: 'R-02', page: 1, x: 0.50, y: 0.43, width: 0.34, height: 0.06, reason: '个人手机号', privilege: '个人信息', status: 'draft', assigneeId: 'U-zhou' },
      { id: 'R-03', page: 2, x: 0.11, y: 0.25, width: 0.68, height: 0.05, reason: '第三方报价', privilege: '商业敏感', status: 'confirmed', assigneeId: 'U-lin' }
    ]
  },
  {
    id: 'DOC-00427',
    title: '现场会议纪要 2026-08-19',
    bundle: '北岭项目 · 第一批披露',
    pages: 3,
    classification: '机密',
    ownerId: 'U-zhou',
    updatedAt: '09:31',
    status: '待质检',
    issue: '事故预防与整改安排',
    size: '3.1 MB',
    redactions: [
      { id: 'R-04', page: 1, x: 0.08, y: 0.69, width: 0.74, height: 0.05, reason: '内部调查意见', privilege: '工作成果', status: 'confirmed', assigneeId: 'U-zhou' }
    ]
  },
  {
    id: 'DOC-00435',
    title: '设备运行数据摘录',
    bundle: '北岭项目 · 第二批披露',
    pages: 3,
    classification: '内部',
    ownerId: 'U-gu',
    updatedAt: '08:56',
    status: '可发布',
    issue: '运行记录',
    size: '12.7 MB',
    redactions: [
      { id: 'R-05', page: 2, x: 0.44, y: 0.56, width: 0.26, height: 0.04, reason: '人员姓名', privilege: '个人信息', status: 'confirmed', assigneeId: 'U-gu' }
    ]
  }
];

/* ============================== 指纹与失效 ============================== */

const roundedGeo = (region: Redaction) =>
  [region.x, region.y, region.width, region.height].map((value) => Math.round(value * 1000)).join(',');

const regionSig = (region: Redaction) =>
  `${region.id}:${region.status}:${roundedGeo(region)}:${region.reason}:${region.privilege}`;

/** 复核结论赖以成立的密级/区域状态指纹；任一变化都会让结论失效 */
export const fingerprintFor = (doc: DisclosureRecord, item: Pick<ReviewItem, 'kind' | 'redactionId'>): string => {
  const cls = `C=${doc.classification}`;
  if (item.kind === '元数据') return cls;
  if (item.redactionId) {
    const region = doc.redactions.find((entry) => entry.id === item.redactionId);
    return region ? `${cls}|${regionSig(region)}` : `${cls}|MISSING`;
  }
  return `${cls}|R=${doc.redactions.map(regionSig).join('/')}`;
};

const buildSeedItems = (docs: DisclosureRecord[]): ReviewItem[] => {
  const signed = (
    item: Omit<ReviewItem, 'status' | 'verdict' | 'signedBy' | 'signedAt' | 'fingerprint' | 'history'>,
    doc: DisclosureRecord,
    by: string,
    at: string,
    verdict: ReviewVerdict = 'pass'
  ): ReviewItem => {
    const fingerprint = fingerprintFor(doc, item);
    return {
      ...item,
      status: 'signed',
      verdict,
      signedBy: by,
      signedAt: at,
      fingerprint,
      history: [{ verdict, signedBy: by, signedByName: reviewerName(by), signedAt: at, fingerprint, invalidated: false }]
    };
  };
  const pending = (item: Omit<ReviewItem, 'status' | 'history'>): ReviewItem => ({ ...item, status: 'pending', history: [] });
  const [d418, d427, d435] = docs;
  return [
    // DOC-00418：离岗复核员名下挂着未完成的文档级与区域级复核
    pending({ id: 'RV-101', documentId: d418.id, kind: '原页比对', label: '原页 / 发布页逐页比对', assigneeId: 'U-zhou' }),
    pending({ id: 'RV-102', documentId: d418.id, redactionId: 'R-02', kind: '区域复核', label: '个人手机号遮蔽区复核', assigneeId: 'U-zhou' }),
    signed({ id: 'RV-103', documentId: d418.id, redactionId: 'R-01', kind: '区域复核', label: '商业秘密遮蔽区复核', assigneeId: 'U-lin' }, d418, 'U-lin', '09:46'),
    // DOC-00427：负责人与已签结论都是周叙——结论只读保留，未完成项待转出
    signed({ id: 'RV-201', documentId: d427.id, kind: '原页比对', label: '原页 / 发布页逐页比对', assigneeId: 'U-zhou' }, d427, 'U-zhou', '09:12'),
    signed({ id: 'RV-202', documentId: d427.id, kind: '发布页比对', label: '发布页文本层与图像残片检查', assigneeId: 'U-zhou' }, d427, 'U-zhou', '09:14'),
    signed({ id: 'RV-203', documentId: d427.id, redactionId: 'R-04', kind: '区域复核', label: '内部调查意见遮蔽区复核', assigneeId: 'U-zhou' }, d427, 'U-zhou', '09:10'),
    pending({ id: 'RV-204', documentId: d427.id, kind: '元数据', label: '文档元数据清理复核', assigneeId: 'U-gu' }),
    // DOC-00435：全部完成
    signed({ id: 'RV-301', documentId: d435.id, kind: '原页比对', label: '原页 / 发布页逐页比对', assigneeId: 'U-gu' }, d435, 'U-gu', '08:40'),
    signed({ id: 'RV-302', documentId: d435.id, kind: '发布页比对', label: '发布页文本层与图像残片检查', assigneeId: 'U-gu' }, d435, 'U-gu', '08:42'),
    signed({ id: 'RV-303', documentId: d435.id, redactionId: 'R-05', kind: '区域复核', label: '人员姓名遮蔽区复核', assigneeId: 'U-gu' }, d435, 'U-gu', '08:38'),
    signed({ id: 'RV-304', documentId: d435.id, kind: '元数据', label: '文档元数据清理复核', assigneeId: 'U-gu' }, d435, 'U-gu', '08:44')
  ];
};

/* ============================== 授权交接（纯函数） ============================== */

export type HandoverPlan = {
  snapshot: AuthzSnapshot;
  nextDocuments: DisclosureRecord[];
  nextReviewItems: ReviewItem[];
  changes: { documentIds: string[]; regionIds: string[]; reviewItemIds: string[] };
};

/** 按 文档 + 区域 范围计算授权迁移，并同时抓取原授权快照 */
export function planHandover(
  documents: DisclosureRecord[],
  reviewItems: ReviewItem[],
  handover: Pick<HandoverRecord, 'fromReviewerId' | 'toReviewerId' | 'scope'>
): HandoverPlan {
  const { fromReviewerId: from, toReviewerId: to, scope } = handover;

  const snapshot: AuthzSnapshot = {
    ownerById: Object.fromEntries(documents.map((doc) => [doc.id, doc.ownerId])),
    regionAssigneeById: Object.fromEntries(
      documents.flatMap((doc) => doc.redactions.map((region) => [region.id, region.assigneeId]))
    ),
    reviewItems: reviewItems.map((item) => structuredClone(item))
  };

  const changes = { documentIds: [] as string[], regionIds: [] as string[], reviewItemIds: [] as string[] };

  const nextDocuments = documents.map((doc) => {
    const ownerMoves = scope.documentIds.includes(doc.id) && doc.ownerId === from;
    if (ownerMoves) changes.documentIds.push(doc.id);
    const redactions = doc.redactions.map((region) => {
      const regionMoves = scope.regionIds.includes(region.id) && region.assigneeId === from;
      if (regionMoves) changes.regionIds.push(region.id);
      return regionMoves ? { ...region, assigneeId: to } : region;
    });
    return ownerMoves || redactions.some((region, index) => region !== doc.redactions[index])
      ? { ...doc, ownerId: ownerMoves ? to : doc.ownerId, redactions }
      : doc;
  });

  // 未完成项：文档范围覆盖该文档下全部待办，区域范围只覆盖该区域待办；已签结论一律不动
  const nextReviewItems = reviewItems.map((item) => {
    const inDocScope = scope.documentIds.includes(item.documentId);
    const inRegionScope = Boolean(item.redactionId && scope.regionIds.includes(item.redactionId));
    if (item.status === 'pending' && item.assigneeId === from && (inDocScope || inRegionScope)) {
      changes.reviewItemIds.push(item.id);
      return { ...item, assigneeId: to };
    }
    return item;
  });

  return { snapshot, nextDocuments, nextReviewItems, changes };
}

/** 依据原授权快照恢复（文档负责人、区域责任人、未完成复核分派） */
export function restoreSnapshot(documents: DisclosureRecord[], reviewItems: ReviewItem[], snapshot: AuthzSnapshot) {
  const restoredDocs = documents.map((doc) => ({
    ...doc,
    ownerId: snapshot.ownerById[doc.id] ?? doc.ownerId,
    redactions: doc.redactions.map((region) => ({
      ...region,
      assigneeId: snapshot.regionAssigneeById[region.id] ?? region.assigneeId
    }))
  }));
  return { restoredDocs, restoredItems: snapshot.reviewItems.map((item) => structuredClone(item)) };
}

/* ============================== 发布门禁（纯函数） ============================== */

export type GateResult = {
  blocked: boolean;
  reasons: string[];
  pendingCount: number;
  invalidatedCount: number;
  unsignedRegionCount: number;
};

export function activeHandovers(handovers: HandoverRecord[]) {
  return handovers.filter((item) => item.status === 'draft' || item.status === 'saving' || item.status === 'failed');
}

export function evaluateGate(
  docIds: string[],
  documents: DisclosureRecord[],
  reviewItems: ReviewItem[],
  handovers: HandoverRecord[]
): GateResult {
  const ids = new Set(docIds);
  const docs = documents.filter((doc) => ids.has(doc.id));
  const items = reviewItems.filter((item) => ids.has(item.documentId));
  const reasons: string[] = [];

  const blockingHandovers = activeHandovers(handovers).filter((handover) => {
    const docHit = handover.scope.documentIds.some((id) => ids.has(id));
    const regionHit = handover.scope.regionIds.some((regionId) =>
      docs.some((doc) => doc.redactions.some((region) => region.id === regionId))
    );
    return docHit || regionHit;
  });
  if (blockingHandovers.length > 0) {
    reasons.push(`授权交接未完成（${blockingHandovers.map((item) => item.id).join('、')}），相关批次冻结`);
  }

  const draftDocs = docs.filter((doc) => doc.status !== '可发布');
  if (draftDocs.length > 0) reasons.push(`${draftDocs.length} 份文档尚未走完质检流程`);

  const unsignedRegions = docs.flatMap((doc) => doc.redactions.filter((region) => region.status === 'draft'));
  if (unsignedRegions.length > 0) reasons.push(`${unsignedRegions.length} 个去密区域仍是草稿，未经确认`);

  const invalidated = items.filter((item) => item.status === 'pending' && item.history.some((entry) => entry.invalidated));
  if (invalidated.length > 0) reasons.push(`${invalidated.length} 项复核因密级或区域变更已失效，须重算`);

  const rejected = items.filter((item) => item.status === 'signed' && item.verdict === 'reject');
  if (rejected.length > 0) reasons.push(`${rejected.length} 项复核结论为驳回`);

  const pending = items.filter((item) => item.status === 'pending' && !item.history.some((entry) => entry.invalidated));
  if (pending.length > 0) reasons.push(`${pending.length} 项未完成复核（${[...new Set(pending.map((item) => reviewerName(item.assigneeId)))].join('、')} 承接）`);

  return {
    blocked: reasons.length > 0,
    reasons,
    pendingCount: items.filter((item) => item.status === 'pending').length,
    invalidatedCount: invalidated.length,
    unsignedRegionCount: unsignedRegions.length
  };
}

/* ============================== Store ============================== */

const nowHM = () => {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const nextHandoverId = (existing: HandoverRecord[]) => {
  const date = new Date();
  const stamp = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const seq = existing.length + 1;
  return `HO-${stamp}-${String(seq).padStart(2, '0')}`;
};

const simulatedWrite = () =>
  new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      if (useDisclosureStore.getState().simulateSaveFailure) reject(new Error('授权服务写入超时'));
      else resolve();
    }, 750);
  });

type State = {
  documents: DisclosureRecord[];
  reviewItems: ReviewItem[];
  handovers: HandoverRecord[];
  publishedBatches: string[];
  currentUserId: string;
  activeDocumentId: string;
  activePage: number;
  activeRedactionId: string | null;
  redactionMode: boolean;
  simulateSaveFailure: boolean;
  notices: Notice[];

  setCurrentUser: (id: string) => void;
  setSimulateSaveFailure: (value: boolean) => void;
  dismissNotice: (id: string) => void;
  selectDocument: (id: string) => void;
  setPage: (page: number) => void;
  toggleRedactionMode: () => void;
  selectRedaction: (id: string | null) => void;

  addRedaction: (redaction: Omit<Redaction, 'id' | 'status' | 'assigneeId'>) => void;
  confirmRedaction: (id: string) => void;
  updateClassification: (classification: DisclosureRecord['classification']) => void;
  submitForQc: () => void;

  signReview: (itemId: string, verdict: ReviewVerdict, note?: string) => void;
  markReady: (documentId: string) => void;

  createHandover: (input: { fromReviewerId: string; toReviewerId: string; scope: HandoverScope; reason: string }) => string | null;
  executeHandover: (id: string) => Promise<void>;
  discardHandover: (id: string) => void;
  publishBatch: (bundle: string) => void;
};

export const useDisclosureStore = create<State>()(
  persist(
    (set, get) => {
      const pushNotice = (tone: Notice['tone'], text: string) => {
        const id = `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({ notices: [...state.notices, { id, tone, text }] }));
        setTimeout(() => set((state) => ({ notices: state.notices.filter((item) => item.id !== id) })), 5200);
      };

      const currentReviewer = () => reviewers.find((item) => item.id === get().currentUserId);

      const deny = (text: string) => pushNotice('error', text);

      /** 密级或区域变更：让受影响的已签结论失效并沉入只读历史，事项回到待办重算 */
      const invalidateAffected = (documentId: string, predicate: (item: ReviewItem, doc: DisclosureRecord) => boolean) =>
        set((state) => {
          const doc = state.documents.find((entry) => entry.id === documentId);
          if (!doc) return state;
          let touched = false;
          const reviewItems = state.reviewItems.map((item) => {
            if (item.documentId !== documentId || item.status !== 'signed' || !predicate(item, doc)) return item;
            touched = true;
            const history = item.history.map((entry, index) =>
              index === item.history.length - 1 ? { ...entry, invalidated: true } : entry
            );
            return {
              ...item,
              status: 'pending' as const,
              verdict: undefined,
              signedBy: undefined,
              signedAt: undefined,
              fingerprint: undefined,
              note: undefined,
              history
            };
          });
          if (touched) {
            const affected = reviewItems.filter((item) => item.documentId === documentId && item.history.some((entry) => entry.invalidated));
            if (affected.length > 0) {
              setTimeout(() => pushNotice('info', `${doc.title} 的 ${affected.length} 项已签复核因密级/区域变更失效，已退回重算（原结论只读留档）`), 0);
            }
          }
          return { reviewItems };
        });

      return {
        documents: defaultDocuments,
        reviewItems: buildSeedItems(defaultDocuments),
        handovers: [],
        publishedBatches: [],
        currentUserId: 'U-lin',
        activeDocumentId: defaultDocuments[0].id,
        activePage: 1,
        activeRedactionId: 'R-02',
        redactionMode: false,
        simulateSaveFailure: false,
        notices: [],

        setCurrentUser: (id) => set({ currentUserId: id, redactionMode: false }),
        setSimulateSaveFailure: (value) => set({ simulateSaveFailure: value }),
        dismissNotice: (id) => set((state) => ({ notices: state.notices.filter((item) => item.id !== id) })),

        selectDocument: (id) => set({ activeDocumentId: id, activePage: 1, activeRedactionId: null, redactionMode: false }),
        setPage: (page) => set({ activePage: page }),
        toggleRedactionMode: () => set((state) => ({ redactionMode: !state.redactionMode })),
        selectRedaction: (id) => set({ activeRedactionId: id }),

        addRedaction: (redaction) => {
          const state = get();
          const doc = state.documents.find((entry) => entry.id === state.activeDocumentId);
          if (!doc) return;
          const me = currentReviewer();
          if (!me || doc.ownerId !== me.id) {
            deny(`越权提交已拒绝：绘制去密区仅限文档负责人 ${reviewerName(doc.ownerId)}，当前为 ${me?.name ?? '未登录'}`);
            return;
          }
          set((current) => ({
            documents: current.documents.map((entry) =>
              entry.id === doc.id
                ? {
                    ...entry,
                    redactions: [
                      ...entry.redactions,
                      { ...redaction, id: `R-${Date.now()}`, status: 'draft' as const, assigneeId: entry.ownerId }
                    ]
                  }
                : entry
            )
          }));
          // 新增区域改变文档区域状态，文档级原页/发布页比对结论失效
          invalidateAffected(doc.id, (item) => item.kind === '原页比对' || item.kind === '发布页比对');
        },

        confirmRedaction: (id) => {
          const state = get();
          const me = currentReviewer();
          const doc = state.documents.find((entry) => entry.redactions.some((region) => region.id === id));
          const region = doc?.redactions.find((entry) => entry.id === id);
          if (!doc || !region || !me) return;
          if (doc.ownerId !== me.id && region.assigneeId !== me.id) {
            deny(`越权提交已拒绝：确认区域仅限负责人或区域处理人 ${reviewerName(region.assigneeId)}，当前为 ${me.name}`);
            return;
          }
          set((current) => ({
            documents: current.documents.map((entry) => ({
              ...entry,
              redactions: entry.redactions.map((item) => (item.id === id ? { ...item, status: 'confirmed' as const } : item))
            }))
          }));
          invalidateAffected(doc.id, (item) =>
            item.redactionId === id || item.kind === '原页比对' || item.kind === '发布页比对'
          );
        },

        updateClassification: (classification) => {
          const state = get();
          const doc = state.documents.find((entry) => entry.id === state.activeDocumentId);
          const me = currentReviewer();
          if (!doc || !me) return;
          if (doc.ownerId !== me.id) {
            deny(`越权提交已拒绝：调整密级仅限文档负责人 ${reviewerName(doc.ownerId)}，当前为 ${me.name}`);
            return;
          }
          if (doc.classification === classification) return;
          set((current) => ({
            documents: current.documents.map((entry) => (entry.id === doc.id ? { ...entry, classification } : entry))
          }));
          // 密级一改，该文档下全部已签复核失效
          invalidateAffected(doc.id, () => true);
        },

        submitForQc: () => {
          const state = get();
          const doc = state.documents.find((entry) => entry.id === state.activeDocumentId);
          const me = currentReviewer();
          if (!doc || !me) return;
          if (doc.ownerId !== me.id) {
            deny(`越权提交已拒绝：提交质检仅限文档负责人 ${reviewerName(doc.ownerId)}，当前为 ${me.name}`);
            return;
          }
          const drafts = doc.redactions.filter((region) => region.status === 'draft');
          if (drafts.length > 0) {
            deny(`提交被拦截：仍有 ${drafts.length} 个去密区域未经确认`);
            return;
          }
          set((current) => ({
            documents: current.documents.map((entry) => (entry.id === doc.id ? { ...entry, status: '待质检' as const, updatedAt: nowHM() } : entry))
          }));
          pushNotice('success', `${doc.id} 已提交质检`);
        },

        signReview: (itemId, verdict, note) => {
          const state = get();
          const me = currentReviewer();
          const item = state.reviewItems.find((entry) => entry.id === itemId);
          if (!item || !me) return;
          if (item.status === 'signed') {
            deny('越权提交已拒绝：已签结论只读保留，不能覆盖或重签');
            return;
          }
          if (item.assigneeId !== me.id) {
            deny(`越权提交已拒绝：该项已分派给 ${reviewerName(item.assigneeId)}，当前为 ${me.name}`);
            return;
          }
          if (!me.available) {
            deny('越权提交已拒绝：当前账号已离岗，无权提交复核结论');
            return;
          }
          const doc = state.documents.find((entry) => entry.id === item.documentId);
          if (!doc) return;
          const fingerprint = fingerprintFor(doc, item);
          const signedAt = nowHM();
          set((current) => ({
            reviewItems: current.reviewItems.map((entry) =>
              entry.id === itemId
                ? {
                    ...entry,
                    status: 'signed' as const,
                    verdict,
                    signedBy: me.id,
                    signedAt,
                    fingerprint,
                    note,
                    history: [
                      ...entry.history,
                      { verdict, signedBy: me.id, signedByName: me.name, signedAt, fingerprint, invalidated: false, note }
                    ]
                  }
                : entry
            )
          }));
          pushNotice('success', `${item.label}：${verdict === 'pass' ? '复核通过' : '已驳回'}（${me.name} · ${signedAt}）`);
        },

        markReady: (documentId) => {
          const state = get();
          const me = currentReviewer();
          const doc = state.documents.find((entry) => entry.id === documentId);
          if (!doc || !me) return;
          if (me.role !== '复核员' && me.role !== '组长') {
            deny(`越权提交已拒绝：标记可发布须由复核员或组长执行，当前为 ${me.name}（${me.role}）`);
            return;
          }
          const gate = evaluateGate([documentId], state.documents, state.reviewItems, state.handovers);
          if (gate.blocked) {
            deny(`发布门禁拦截：${gate.reasons[0]}`);
            return;
          }
          set((current) => ({
            documents: current.documents.map((entry) => (entry.id === documentId ? { ...entry, status: '可发布' as const, updatedAt: nowHM() } : entry))
          }));
          pushNotice('success', `${doc.id} 已通过双人复核，标记为可发布`);
        },

        createHandover: ({ fromReviewerId, toReviewerId, scope, reason }) => {
          const state = get();
          const from = reviewers.find((item) => item.id === fromReviewerId);
          const to = reviewers.find((item) => item.id === toReviewerId);
          if (!from || !to) return null;
          if (fromReviewerId === toReviewerId) {
            deny('交接被拒绝：转出人与接手人不能相同');
            return null;
          }
          if (to.available === false) {
            deny(`交接被拒绝：接手人 ${to.name} 已离岗，不能承接授权`);
            return null;
          }
          if (scope.documentIds.length === 0 && scope.regionIds.length === 0) {
            deny('交接被拒绝：交接范围为空');
            return null;
          }
          if (activeHandovers(state.handovers).length > 0) {
            deny(`请先完成或作废进行中的交接单 ${activeHandovers(state.handovers)[0].id}`);
            return null;
          }
          const id = nextHandoverId(state.handovers);
          const record: HandoverRecord = {
            id,
            reason: reason || '复核员离岗授权交接',
            fromReviewerId,
            toReviewerId,
            scope,
            status: 'draft',
            createdAt: nowHM(),
            attempts: 0
          };
          set((current) => ({ handovers: [...current.handovers, record] }));
          pushNotice('info', `交接单 ${id} 已生成（草稿持久保存，重开页面可继续）`);
          return id;
        },

        executeHandover: async (id) => {
          const state = get();
          const handover = state.handovers.find((item) => item.id === id);
          if (!handover || handover.status === 'completed' || handover.status === 'saving') return;

          // 每次执行都从「当前授权」重算并抓取快照；失败回滚后重试，快照即原授权
          const plan = planHandover(state.documents, state.reviewItems, handover);
          set((current) => ({
            documents: plan.nextDocuments,
            reviewItems: plan.nextReviewItems,
            handovers: current.handovers.map((item) =>
              item.id === id
                ? { ...item, status: 'saving' as const, attempts: item.attempts + 1, lastError: undefined, snapshot: plan.snapshot, changes: plan.changes }
                : item
            )
          }));

          try {
            await simulatedWrite();
            set((current) => ({
              handovers: current.handovers.map((item) =>
                item.id === id ? { ...item, status: 'completed' as const, completedAt: nowHM(), snapshot: undefined } : item
              )
            }));
            pushNotice(
              'success',
              `交接 ${id} 完成：文档负责人 ${reviewerName(handover.fromReviewerId)} → ${reviewerName(handover.toReviewerId)}，转出 ${plan.changes.documentIds.length} 份文档、${plan.changes.regionIds.length} 个区域、${plan.changes.reviewItemIds.length} 项未完成复核；已签结论只读保留`
            );
          } catch (error) {
            const failed = get().handovers.find((item) => item.id === id);
            const snapshot = failed?.snapshot ?? plan.snapshot;
            const { restoredDocs, restoredItems } = restoreSnapshot(get().documents, get().reviewItems, snapshot);
            // 负责人已换而权限未换绝不允许发生：整体恢复到原授权
            set((current) => ({
              documents: restoredDocs,
              reviewItems: restoredItems,
              handovers: current.handovers.map((item) =>
                item.id === id
                  ? { ...item, status: 'failed' as const, lastError: error instanceof Error ? error.message : '写入失败' }
                  : item
              )
            }));
            deny(`交接 ${id} 保存失败：已从原授权快照完整恢复，请使用同一交接号 ${id} 重试`);
          }
        },

        discardHandover: (id) =>
          set((state) => ({
            // 仅未执行过的草稿可作废；失败单保留同一交接号，须重试到完成
            handovers: state.handovers.filter((item) =>
              !(item.id === id && item.status === 'draft' && item.attempts === 0)
            )
          })),

        publishBatch: (bundle) => {
          const state = get();
          const docIds = state.documents.filter((doc) => doc.bundle === bundle).map((doc) => doc.id);
          const gate = evaluateGate(docIds, state.documents, state.reviewItems, state.handovers);
          if (gate.blocked) {
            deny(`发布门禁拦截「${bundle}」：${gate.reasons[0]}`);
            return;
          }
          set((current) => ({ publishedBatches: [...new Set([...current.publishedBatches, bundle])] }));
          pushNotice('success', `批次「${bundle}」已生成发布包`);
        }
      };
    },
    {
      name: 'yy59-disclosure-draft-v2',
      version: 2,
      partialize: (state) => ({
        documents: state.documents,
        reviewItems: state.reviewItems,
        handovers: state.handovers,
        publishedBatches: state.publishedBatches,
        currentUserId: state.currentUserId,
        activeDocumentId: state.activeDocumentId
      })
    }
  )
);

export { reviewerName };
