import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  signedBy?: string; // 已签结论的签结论人（交接后只读保留）
};

export type DisclosureRecord = {
  id: string;
  title: string;
  bundle: string;
  pages: number;
  classification: '内部' | '机密' | '严格机密';
  owner: string; // 复核员 id
  updatedAt: string;
  status: '去密中' | '待质检' | '可发布';
  issue: string;
  size: string;
  redactions: Redaction[];
  reviewInvalid: boolean; // 密级或区域变更后复核失效，需重算
  invalidReason?: string;
};

export type Reviewer = {
  id: string;
  name: string;
  team: string;
};

export type HandoverStatus = 'pending' | 'completed' | 'failed';

export type Handover = {
  id: string; // 交接号：一次交接一个号，失败重试沿用同号
  fromReviewerId: string; // 转出人
  toReviewerId: string; // 接手人
  documentIds: string[]; // 交接范围：文档
  regionIds: string[]; // 交接范围：区域（空数组表示整份文档）
  status: HandoverStatus;
  createdAt: string;
  completedAt?: string;
  failReason?: string;
  simulateFailure?: boolean; // 演练用：本次保存模拟失败以验证回滚
};

export const defaultReviewers: Reviewer[] = [
  { id: 'lin-qing', name: '林清', team: '审核组' },
  { id: 'zhou-xu', name: '周叙', team: '审核组' },
  { id: 'gu-yan', name: '顾言', team: '专家组' }
];

const defaultAuthorizations: Record<string, string[]> = {
  'lin-qing': ['DOC-00418'],
  'zhou-xu': ['DOC-00427'],
  'gu-yan': ['DOC-00435']
};

const defaultDocuments: DisclosureRecord[] = [
  {
    id: 'DOC-00418',
    title: '设备采购补充协议（第三版）',
    bundle: '北岭项目 · 第一批披露',
    pages: 3,
    classification: '严格机密',
    owner: 'lin-qing',
    updatedAt: '09:48',
    status: '去密中',
    issue: '合同主体与商业条款',
    size: '8.4 MB',
    reviewInvalid: false,
    redactions: [
      { id: 'R-01', page: 1, x: 0.12, y: 0.16, width: 0.30, height: 0.04, reason: '商业秘密', privilege: '合同保密', status: 'confirmed', signedBy: 'lin-qing' },
      { id: 'R-02', page: 1, x: 0.50, y: 0.43, width: 0.34, height: 0.06, reason: '个人手机号', privilege: '个人信息', status: 'draft' },
      { id: 'R-03', page: 2, x: 0.11, y: 0.25, width: 0.68, height: 0.05, reason: '第三方报价', privilege: '商业敏感', status: 'confirmed', signedBy: 'lin-qing' }
    ]
  },
  {
    id: 'DOC-00427',
    title: '现场会议纪要 2026-08-19',
    bundle: '北岭项目 · 第一批披露',
    pages: 3,
    classification: '机密',
    owner: 'zhou-xu',
    updatedAt: '09:31',
    status: '待质检',
    issue: '事故预防与整改安排',
    size: '3.1 MB',
    reviewInvalid: false,
    redactions: [
      { id: 'R-04', page: 1, x: 0.08, y: 0.69, width: 0.74, height: 0.05, reason: '内部调查意见', privilege: '工作成果', status: 'confirmed', signedBy: 'zhou-xu' }
    ]
  },
  {
    id: 'DOC-00435',
    title: '设备运行数据摘录',
    bundle: '北岭项目 · 第二批披露',
    pages: 3,
    classification: '内部',
    owner: 'gu-yan',
    updatedAt: '08:56',
    status: '可发布',
    issue: '运行记录',
    size: '12.7 MB',
    reviewInvalid: false,
    redactions: [
      { id: 'R-05', page: 2, x: 0.44, y: 0.56, width: 0.26, height: 0.04, reason: '人员姓名', privilege: '个人信息', status: 'confirmed', signedBy: 'zhou-xu' }
    ]
  }
];

const defaultHandovers: Handover[] = [
  {
    id: 'HO-2026-0001',
    fromReviewerId: 'lin-qing',
    toReviewerId: 'zhou-xu',
    documentIds: ['DOC-00418'],
    regionIds: [],
    status: 'pending',
    createdAt: '2026-10-04 09:12'
  },
  {
    id: 'HO-2026-0002',
    fromReviewerId: 'zhou-xu',
    toReviewerId: 'gu-yan',
    documentIds: ['DOC-00435'],
    regionIds: [],
    status: 'completed',
    createdAt: '2026-09-30 17:20',
    completedAt: '2026-09-30 17:40'
  }
];

const blankChecks = (): Record<string, boolean> => ({
  'forbidden-terms': false,
  'page-number': false,
  'image-boundary': false,
  'metadata': false
});

const now = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 文档是否存在未完成（待完成/保存失败）的交接 —— 发布门禁据此挡住批次 */
export const isGated = (handovers: Handover[], docId: string): Handover | undefined =>
  handovers.find((h) => h.status !== 'completed' && h.documentIds.includes(docId));

export const isAuthorized = (authorizations: Record<string, string[]>, docId: string, reviewerId: string): boolean =>
  (authorizations[reviewerId] ?? []).includes(docId);

export const reviewerName = (reviewers: Reviewer[], id?: string): string =>
  reviewers.find((r) => r.id === id)?.name ?? '—';

type State = {
  documents: DisclosureRecord[];
  reviewers: Reviewer[];
  authorizations: Record<string, string[]>;
  handovers: Handover[];
  currentOperatorId: string;
  activeDocumentId: string;
  activePage: number;
  activeRedactionId: string | null;
  redactionMode: boolean;
  reviewChecks: Record<string, boolean>;
  metadataCleaned: boolean;
  rejection: string | null;
  selectDocument: (id: string) => void;
  setPage: (page: number) => void;
  toggleRedactionMode: () => void;
  addRedaction: (redaction: Omit<Redaction, 'id' | 'status'>) => void;
  confirmRedaction: (id: string) => void;
  selectRedaction: (id: string) => void;
  updateClassification: (classification: DisclosureRecord['classification']) => void;
  submitForQuality: () => void;
  toggleReviewCheck: (id: string) => void;
  toggleMetadata: () => void;
  markReady: () => void;
  generateReleasePackage: (docIds: string[]) => void;
  createHandover: (input: Pick<Handover, 'fromReviewerId' | 'toReviewerId' | 'documentIds' | 'regionIds' | 'simulateFailure'>) => string;
  saveHandover: (id: string) => void;
  dismissRejection: () => void;
};

export const useDisclosureStore = create<State>()(
  persist(
    (set, get) => ({
      documents: defaultDocuments,
      reviewers: defaultReviewers,
      authorizations: defaultAuthorizations,
      handovers: defaultHandovers,
      currentOperatorId: 'lin-qing',
      activeDocumentId: defaultDocuments[0].id,
      activePage: 1,
      activeRedactionId: 'R-02',
      redactionMode: false,
      reviewChecks: {
        'forbidden-terms': true,
        'page-number': true,
        'image-boundary': false,
        'metadata': false
      },
      metadataCleaned: false,
      rejection: null,
      selectDocument: (id) => set({ activeDocumentId: id, activePage: 1, activeRedactionId: null, redactionMode: false }),
      setPage: (page) => set({ activePage: page }),
      toggleRedactionMode: () => set((state) => ({ redactionMode: !state.redactionMode })),
      addRedaction: (redaction) => {
        const state = get();
        const doc = state.documents.find((item) => item.id === state.activeDocumentId);
        if (!doc) return;
        if (!isAuthorized(state.authorizations, doc.id, state.currentOperatorId)) {
          set({ rejection: `越权提交已拒绝：${doc.id} 的授权复核人不是您，区域未绘制、未保存。` });
          return;
        }
        const invalid = doc.status === '可发布';
        set({
          rejection: null,
          reviewChecks: invalid ? blankChecks() : state.reviewChecks,
          metadataCleaned: invalid ? false : state.metadataCleaned,
          documents: state.documents.map((item) => item.id === doc.id
            ? {
                ...item,
                status: invalid ? '去密中' : item.status,
                reviewInvalid: invalid,
                invalidReason: invalid ? '区域变更，原复核结论失效' : item.invalidReason,
                redactions: [...item.redactions, { ...redaction, id: `R-${Date.now()}`, status: 'draft' as const }]
              }
            : item)
        });
      },
      confirmRedaction: (id) => {
        const state = get();
        const doc = state.documents.find((item) => item.redactions.some((region) => region.id === id));
        if (!doc) return;
        const region = doc.redactions.find((item) => item.id === id);
        if (region?.status === 'confirmed') {
          set({ rejection: `已签结论只读保留：${region.id} 已由 ${reviewerName(state.reviewers, region.signedBy)} 签署，不得变更或重新分派。` });
          return;
        }
        if (!isAuthorized(state.authorizations, doc.id, state.currentOperatorId)) {
          set({ rejection: `越权提交已拒绝：${doc.id} 的授权复核人不是您，确认未生效。` });
          return;
        }
        const invalid = doc.status === '可发布';
        set({
          rejection: null,
          reviewChecks: invalid ? blankChecks() : state.reviewChecks,
          metadataCleaned: invalid ? false : state.metadataCleaned,
          documents: state.documents.map((item) => item.id === doc.id
            ? {
                ...item,
                status: invalid ? '去密中' : item.status,
                reviewInvalid: invalid,
                invalidReason: invalid ? '区域变更，原复核结论失效' : item.invalidReason,
                redactions: item.redactions.map((regionItem) => regionItem.id === id
                  ? { ...regionItem, status: 'confirmed' as const, signedBy: state.currentOperatorId }
                  : regionItem)
              }
            : item)
        });
      },
      selectRedaction: (id) => set({ activeRedactionId: id }),
      updateClassification: (classification) => {
        const state = get();
        const doc = state.documents.find((item) => item.id === state.activeDocumentId);
        if (!doc) return;
        if (!isAuthorized(state.authorizations, doc.id, state.currentOperatorId)) {
          set({ rejection: `越权提交已拒绝：${doc.id} 的授权复核人不是您，密级未变更。` });
          return;
        }
        const invalid = doc.status === '可发布';
        set({
          rejection: null,
          reviewChecks: invalid ? blankChecks() : state.reviewChecks,
          metadataCleaned: invalid ? false : state.metadataCleaned,
          documents: state.documents.map((item) => item.id === doc.id
            ? { ...item, classification, status: invalid ? '去密中' : item.status, reviewInvalid: invalid, invalidReason: invalid ? '密级变更，原复核结论失效' : item.invalidReason }
            : item)
        });
      },
      submitForQuality: () => {
        const state = get();
        const doc = state.documents.find((item) => item.id === state.activeDocumentId);
        if (!doc) return;
        if (!isAuthorized(state.authorizations, doc.id, state.currentOperatorId)) {
          set({ rejection: `越权提交已拒绝：您不是 ${doc.id} 的授权复核人，提交未受理。` });
          return;
        }
        set({
          rejection: null,
          documents: state.documents.map((item) => item.id === doc.id ? { ...item, status: '待质检' } : item)
        });
      },
      toggleReviewCheck: (id) => set((state) => ({ reviewChecks: { ...state.reviewChecks, [id]: !state.reviewChecks[id] } })),
      toggleMetadata: () => set((state) => ({ metadataCleaned: !state.metadataCleaned })),
      markReady: () => {
        const state = get();
        const doc = state.documents[1];
        if (!doc) return;
        if (!isAuthorized(state.authorizations, doc.id, state.currentOperatorId)) {
          set({ rejection: `越权提交已拒绝：您不是 ${doc.id} 的授权复核人，不得标记可发布。` });
          return;
        }
        const gate = isGated(state.handovers, doc.id);
        if (gate) {
          set({ rejection: `发布门禁未放行：${doc.id} 存在未完成的授权交接 ${gate.id}，交接完成并保存前不得标记可发布。` });
          return;
        }
        if (doc.reviewInvalid) {
          set({ rejection: `复核已失效：密级或区域变更后须重新生成复核结论，不得直接发布。` });
          return;
        }
        set({
          rejection: null,
          documents: state.documents.map((item) => item.id === doc.id ? { ...item, status: '可发布', reviewInvalid: false, invalidReason: undefined } : item)
        });
      },
      generateReleasePackage: (docIds) => {
        const state = get();
        const gatedId = docIds.find((id) => isGated(state.handovers, id));
        if (gatedId) {
          const gate = isGated(state.handovers, gatedId)!;
          set({ rejection: `发布门禁未放行：${gatedId} 存在未完成的授权交接 ${gate.id}，相应批次在交接完成前不得发布。` });
          return;
        }
        const unauthorizedId = docIds.find((id) => !isAuthorized(state.authorizations, id, state.currentOperatorId));
        if (unauthorizedId) {
          set({ rejection: `越权提交已拒绝：您不是 ${unauthorizedId} 的授权复核人，发布包未生成。` });
          return;
        }
        set({ rejection: null });
      },
      createHandover: (input) => {
        const state = get();
        const seq = state.handovers.length + 1;
        const id = `HO-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;
        const handover: Handover = {
          id,
          fromReviewerId: input.fromReviewerId,
          toReviewerId: input.toReviewerId,
          documentIds: input.documentIds,
          regionIds: input.regionIds,
          status: 'pending',
          createdAt: now(),
          simulateFailure: input.simulateFailure
        };
        set({ handovers: [...state.handovers, handover] });
        return id;
      },
      saveHandover: (id) => {
        const state = get();
        const handover = state.handovers.find((item) => item.id === id);
        if (!handover || handover.status === 'completed') return;
        // 保存前快照：负责人与授权必须同时回滚，避免“负责人已换而权限未换”
        const ownerSnapshot: Record<string, string> = {};
        state.documents.forEach((doc) => {
          if (handover.documentIds.includes(doc.id)) ownerSnapshot[doc.id] = doc.owner;
        });
        const authSnapshot = JSON.parse(JSON.stringify(state.authorizations)) as Record<string, string[]>;
        // 执行交接：文档负责人换为接手人，授权同步转出
        let documents = state.documents.map((doc) => {
          if (!handover.documentIds.includes(doc.id)) return doc;
          return { ...doc, owner: handover.toReviewerId, updatedAt: now() };
        });
        let authorizations: Record<string, string[]> = {
          ...state.authorizations,
          [handover.fromReviewerId]: (state.authorizations[handover.fromReviewerId] ?? []).filter((docId) => !handover.documentIds.includes(docId)),
          [handover.toReviewerId]: Array.from(new Set([...(state.authorizations[handover.toReviewerId] ?? []), ...handover.documentIds]))
        };
        if (handover.simulateFailure) {
          // 保存失败：从原授权恢复，交接号保留，可同号重试
          documents = documents.map((doc) => (ownerSnapshot[doc.id] ? { ...doc, owner: ownerSnapshot[doc.id] } : doc));
          authorizations = authSnapshot;
          set({
            documents,
            authorizations,
            rejection: `交接 ${id} 保存失败：授权服务未确认，已从原授权恢复（负责人与权限均未变更），请用同一交接号重试。`,
            handovers: state.handovers.map((item) => item.id === id
              ? { ...item, status: 'failed' as const, failReason: '保存失败：授权服务未确认，已从原授权恢复', simulateFailure: false }
              : item)
          });
          return;
        }
        set({
          documents,
          authorizations,
          rejection: null,
          handovers: state.handovers.map((item) => item.id === id
            ? { ...item, status: 'completed' as const, completedAt: now(), failReason: undefined, simulateFailure: false }
            : item)
        });
      },
      dismissRejection: () => set({ rejection: null })
    }),
    {
      name: 'yy59-disclosure-draft',
      partialize: (state) => {
        const { rejection: _rejection, ...rest } = state;
        void _rejection;
        return rest;
      },
      merge: (persisted, current) => {
        const persistedState = (persisted ?? {}) as Partial<State>;
        const documents = (persistedState.documents ?? current.documents).map((doc) => ({
          ...doc,
          reviewInvalid: doc.reviewInvalid ?? false,
          redactions: doc.redactions.map((region) => ({
            ...region,
            signedBy: region.signedBy ?? (region.status === 'confirmed' ? 'lin-qing' : undefined)
          }))
        }));
        return {
          ...current,
          ...persistedState,
          documents,
          reviewers: persistedState.reviewers ?? current.reviewers,
          authorizations: persistedState.authorizations ?? current.authorizations,
          handovers: persistedState.handovers ?? current.handovers
        };
      }
    }
  )
);
