import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useParams
} from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  Highlighter,
  History,
  KeyRound,
  Layers3,
  Lock,
  Menu,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  Send,
  ShieldCheck,
  Stamp,
  Tags,
  UploadCloud,
  ArrowLeftRight as HandoverIcon,
  X
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Badge, Button, Card, Dialog, Tabs } from './components/ui';
import {
  activeHandovers,
  evaluateGate,
  fingerprintFor,
  reviewers,
  reviewerName,
  useDisclosureStore,
  type DisclosureRecord,
  type HandoverRecord,
  type ReviewItem
} from './store';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const bundleQuery = async () => ({
  queue: [
    { id: 'Q-31', name: '第三批补充材料', count: 128, owner: '林清', progress: 68, due: '今日 16:00' },
    { id: 'Q-32', name: '证人材料图像件', count: 47, owner: '周叙', progress: 34, due: '明日 11:00' },
    { id: 'Q-33', name: '专家报告附件', count: 19, owner: '顾言', progress: 91, due: '09-30 18:00' }
  ]
});

const toneForClassification = (classification: DisclosureRecord['classification']) =>
  classification === '严格机密' ? 'red' : classification === '机密' ? 'amber' : 'neutral';

/* ============================== 外壳 / 顶栏 ============================== */

function Toasts() {
  const notices = useDisclosureStore((state) => state.notices);
  const dismiss = useDisclosureStore((state) => state.dismissNotice);
  return (
    <div className="toast-stack">
      {notices.map((notice) => (
        <div key={notice.id} className={`toast ${notice.tone}`} role="alert" onClick={() => dismiss(notice.id)}>
          {notice.tone === 'error' ? <Ban size={16} /> : notice.tone === 'success' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
          <span>{notice.text}</span>
          <X size={13} />
        </div>
      ))}
    </div>
  );
}

function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  const currentUserId = useDisclosureStore((state) => state.currentUserId);
  const setCurrentUser = useDisclosureStore((state) => state.setCurrentUser);
  const handoverCount = useDisclosureStore((state) => activeHandovers(state.handovers).length);
  const current = reviewers.find((item) => item.id === currentUserId) ?? reviewers[0];
  const links = [
    { to: '/', label: '文档集', icon: Layers3 },
    { to: '/review/$documentId', label: '去密审阅', icon: Highlighter },
    { to: '/quality', label: '发布质检', icon: ScanSearch },
    { to: '/batches', label: '批次与标签', icon: Tags },
    { to: '/handovers', label: '授权交接', icon: HandoverIcon, badge: handoverCount }
  ];
  return (
    <div className="app-shell">
      <Toasts />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-symbol"><Stamp size={18} /></div>
          <div><strong>披露质控台</strong><span>North Ridge / Litigation Support</span></div>
        </div>
        <div className="top-actions">
          {handoverCount > 0 && <Link to="/handovers" className="handover-pill"><HandoverIcon size={14} /> 交接进行中 {handoverCount}</Link>}
          <label className="identity-switch">
            <KeyRound size={14} />
            <select
              value={currentUserId}
              onChange={(event) => setCurrentUser(event.target.value)}
              title="切换当前登录账号（用于演示权限校验与越权拒绝）"
            >
              {reviewers.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.name} · {reviewer.role}{reviewer.available ? '' : '（已离岗）'}
                </option>
              ))}
            </select>
            {!current.available && <Badge tone="red">已离岗</Badge>}
          </label>
        </div>
        <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="菜单"><Menu /></button>
      </header>
      <div className="shell-body">
        <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
          <div className="workspace-title">
            <span>当前工作区</span>
            <strong>北岭项目 · 诉讼披露</strong>
          </div>
          <nav>
            {links.map(({ to, label, icon: Icon, badge }) => (
              <Link key={to} to={to as '/'} activeProps={{ className: 'active' }} onClick={() => setMobileNav(false)}>
                <Icon size={17} /> <span>{label}</span>
                {badge ? <em className="nav-badge">{badge}</em> : null}
              </Link>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div><ShieldCheck size={16} /><span>审计记录已开启</span></div>
            <small>授权与交接单持久保存在本机</small>
          </div>
        </aside>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  );
}

/* ============================== 文档集 ============================== */

function PendingHandoverBanner() {
  const handovers = useDisclosureStore((state) => state.handovers);
  const active = activeHandovers(handovers);
  if (active.length === 0) return null;
  return (
    <Link to="/handovers" className="handover-banner">
      <HandoverIcon size={17} />
      <div>
        <strong>授权交接未完成：{active.map((item) => item.id).join('、')}</strong>
        <span>交接完成前，相关批次发布门禁保持关闭；负责人已换而权限未换的情况会被自动回滚。</span>
      </div>
      <RefreshCw size={15} />
    </Link>
  );
}

function DocumentsPage() {
  const documents = useDisclosureStore((state) => state.documents);
  const reviewItems = useDisclosureStore((state) => state.reviewItems);
  const { data } = useQuery({ queryKey: ['document-queues'], queryFn: bundleQuery });
  const [filter, setFilter] = useState('全部');
  const visible = filter === '全部' ? documents : documents.filter((doc) => doc.status === filter);
  return (
    <div className="page">
      <header className="page-heading">
        <div><small>DISCLOSURE CONTROL / DOCUMENT SET</small><h1>披露文档集</h1><p>分批完成密级复核、敏感区域去密与发布版本比对。</p></div>
        <Button><UploadCloud size={16} /> 导入文档集</Button>
      </header>
      <PendingHandoverBanner />
      <section className="summary-strip">
        <div><span>文档总数</span><strong>194</strong><small>12.8 GB</small></div>
        <div><span>去密区域</span><strong>2,481</strong><small>较上版 +34</small></div>
        <div><span>待复核 / 失效重算</span><strong className="warning-text">{reviewItems.filter((item) => item.status === 'pending').length}</strong><small>{reviewItems.filter((item) => item.history.some((entry) => entry.invalidated) && item.status === 'pending').length} 项已失效</small></div>
        <div><span>已批准批次</span><strong>6</strong><small>本周 +2</small></div>
      </section>
      <div className="two-column">
        <Card className="document-table-card">
          <div className="card-heading">
            <div><Tabs.Root value={filter} onValueChange={setFilter}><Tabs.List className="segmented">
              {['全部', '去密中', '待质检', '可发布'].map((item) => <Tabs.Trigger key={item} value={item}>{item}</Tabs.Trigger>)}
            </Tabs.List></Tabs.Root></div>
            <span>{visible.length} 份文档</span>
          </div>
          <div className="document-table">
            {visible.map((doc) => {
              const pending = reviewItems.filter((item) => item.documentId === doc.id && item.status === 'pending');
              const pendingInvalid = pending.some((item) => item.history.some((entry) => entry.invalidated));
              return (
                <div className="document-row" key={doc.id}>
                  <div className="file-icon"><FileText size={19} /></div>
                  <div className="doc-main">
                    <strong>{doc.title}</strong>
                    <span>{doc.id} · {doc.bundle} · {doc.size}</span>
                  </div>
                  <div className="doc-field"><span>密级</span><Badge tone={toneForClassification(doc.classification)}>{doc.classification}</Badge></div>
                  <div className="doc-field"><span>负责人员</span><strong>{reviewerName(doc.ownerId)}</strong>{pending.length > 0 && <span className={pendingInvalid ? 'invalid-text' : ''}>{pending.length} 项待复核{pendingInvalid ? '（含失效重算）' : ''}</span>}</div>
                  <div className="doc-field"><span>状态</span><Badge tone={doc.status === '可发布' ? 'green' : doc.status === '待质检' ? 'amber' : 'blue'}>{doc.status}</Badge></div>
                  <div className="doc-actions">
                    <Link to="/review/$documentId" params={{ documentId: doc.id }}><Button variant="outline">审阅</Button></Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <aside className="side-stack">
          <Card className="queue-card">
            <div className="card-title"><ClipboardCheck size={17} /><strong>去密任务队列</strong></div>
            {(data?.queue ?? []).map((item) => (
              <div className="queue-item" key={item.id}>
                <div><strong>{item.name}</strong><span>{item.count} 份 · {item.owner}</span></div>
                <div className="progress"><i style={{ width: `${item.progress}%` }} /></div>
                <small>{item.progress}% · 截止 {item.due}</small>
              </div>
            ))}
          </Card>
          <Card className="audit-card">
            <div className="card-title"><History size={17} /><strong>授权说明</strong></div>
            <p>复核员离岗后，文档负责人、去密区域处理人与未完成复核通过<b>交接单</b>整体转出；已签结论以原签字只读保留。</p>
            <p>密级或区域一旦修改，对应复核指纹失配，自动失效重算；越权操作在提交点直接拒绝。</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ============================== PDF 演示 ============================== */

function useDemoPdf() {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  useEffect(() => {
    let alive = true;
    PDFDocument.create().then(async (pdf) => {
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      for (let pageNo = 1; pageNo <= 3; pageNo += 1) {
        const page = pdf.addPage([612, 792]);
        page.drawText(`NORTH RIDGE PROJECT - DISCLOSURE EXHIBIT`, { x: 54, y: 728, size: 14, font, color: rgb(0.12, 0.16, 0.2) });
        page.drawText(`Document page ${pageNo} / 3`, { x: 54, y: 704, size: 10, font, color: rgb(0.35, 0.39, 0.43) });
        page.drawLine({ start: { x: 54, y: 690 }, end: { x: 558, y: 690 }, thickness: 1, color: rgb(0.75, 0.78, 0.8) });
        const lines = [
          'Commercial terms and operational records',
          'Parties: North Ridge Equipment Co. and Haiyang Logistics',
          'Reference No. NR-2026-0819 / Confidentiality class: strictly confidential',
          '',
          'The supplier shall provide maintenance records, operating data and',
          'incident reports within ten business days after each quarterly review.',
          '',
          'Contact: [redacted personal information]',
          'Commercial consideration: [redacted third-party quotation]',
          '',
          'This copy is prepared solely for disclosure review. Every marked region',
          'must be confirmed against the original before approval and release.'
        ];
        lines.forEach((line, index) => page.drawText(line, { x: 54, y: 655 - index * 24, size: 10, font, color: rgb(0.1, 0.13, 0.16) }));
        page.drawText(`Control stamp: REVIEW-${String(pageNo).padStart(2, '0')}`, { x: 54, y: 72, size: 9, font, color: rgb(0.5, 0.53, 0.56) });
      }
      return pdf.save();
    }).then((data) => {
      if (alive) {
        const copy = new Uint8Array(data);
        setBytes(copy.buffer as ArrayBuffer);
      }
    });
    return () => { alive = false; };
  }, []);
  return bytes;
}

function PdfPage({ pageNumber, redacted = false, onDraw }: { pageNumber: number; redacted?: boolean; onDraw?: (region: { x: number; y: number; width: number; height: number }) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bytes = useDemoPdf();
  const [drawing, setDrawing] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const start = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!bytes || !canvasRef.current) return;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;
    const render = async () => {
      task = pdfjs.getDocument({ data: bytes.slice(0) });
      const pdf = await task.promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = canvasRef.current!;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      canvas.style.width = '100%';
      canvas.style.aspectRatio = `${viewport.width}/${viewport.height}`;
      const context = canvas.getContext('2d')!;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    };
    render().catch(console.error);
    return () => { task?.destroy(); };
  }, [bytes, pageNumber]);

  const pointerDown = (event: React.PointerEvent) => {
    if (!onDraw) return;
    const rect = event.currentTarget.getBoundingClientRect();
    start.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setDrawing({ x: start.current.x / rect.width, y: start.current.y / rect.height, width: 0, height: 0 });
  };
  const pointerMove = (event: React.PointerEvent) => {
    if (!drawing || !onDraw) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(start.current.x, event.clientX - rect.left) / rect.width;
    const y = Math.min(start.current.y, event.clientY - rect.top) / rect.height;
    const width = Math.abs(event.clientX - rect.left - start.current.x) / rect.width;
    const height = Math.abs(event.clientY - rect.top - start.current.y) / rect.height;
    setDrawing({ x, y, width, height });
  };
  const pointerUp = () => {
    if (drawing && onDraw && drawing.width > 0.015 && drawing.height > 0.01) onDraw(drawing);
    setDrawing(null);
  };
  return (
    <div className={`pdf-page ${onDraw ? 'drawable' : ''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>
      <canvas ref={canvasRef} />
      {redacted && <div className="page-redaction-demo"><span>已发布区域掩码</span></div>}
      {drawing && <i className="drawing-region" style={{ left: `${drawing.x * 100}%`, top: `${drawing.y * 100}%`, width: `${drawing.width * 100}%`, height: `${drawing.height * 100}%` }} />}
    </div>
  );
}

/* ============================== 去密审阅 ============================== */

function ReviewPage() {
  const { documentId } = useParams({ from: '/review/$documentId' });
  const navigate = useNavigate();
  const store = useDisclosureStore();
  const currentUserId = useDisclosureStore((state) => state.currentUserId);
  const doc = store.documents.find((item) => item.id === documentId) ?? store.documents[0];
  const pageRegions = doc.redactions.filter((item) => item.page === store.activePage);
  const active = doc.redactions.find((item) => item.id === store.activeRedactionId);
  const regionReview = (regionId: string) => store.reviewItems.find((item) => item.documentId === doc.id && item.redactionId === regionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('商业秘密');
  const [privilege, setPrivilege] = useState('合同保密');
  const current = reviewers.find((item) => item.id === currentUserId)!;
  const canEdit = doc.ownerId === currentUserId && current.available;
  return (
    <div className="page review-page">
      <header className="review-header">
        <div className="review-title">
          <Button variant="ghost" onClick={() => navigate({ to: '/' })}><ArrowLeft size={16} /></Button>
          <div><small>{doc.id} / 去密审阅 · 负责人 {reviewerName(doc.ownerId)}</small><h1>{doc.title}</h1></div>
          <Badge tone={toneForClassification(doc.classification)}>{doc.classification}</Badge>
          {!canEdit && <Badge tone="neutral"><Lock size={11} /> 当前账号只读</Badge>}
        </div>
        <div className="review-actions">
          <Button
            variant="outline"
            onClick={() => store.toggleRedactionMode()}
            className={store.redactionMode ? 'active-button' : ''}
            disabled={!canEdit}
            title={canEdit ? '' : '仅文档负责人可绘制去密区'}
          >
            <Highlighter size={16} /> {store.redactionMode ? '取消绘制' : '绘制去密区'}
          </Button>
          <Button variant="outline" onClick={() => setDialogOpen(true)}><FileCheck2 size={16} /> 发布前校验</Button>
          <Button onClick={() => store.submitForQc()}><Send size={16} /> 提交质检</Button>
        </div>
      </header>
      <div className="review-layout">
        <aside className="page-thumbs">
          <div className="side-label">页级预览 <span>{doc.pages} 页</span></div>
          {[1, 2, 3].map((page) => (
            <button key={page} className={store.activePage === page ? 'active' : ''} onClick={() => store.setPage(page)}>
              <div className="mini-page"><span>{page}</span><i style={{ width: `${45 + page * 9}%` }} /><i style={{ width: `${70 - page * 5}%` }} /><i style={{ width: `${55 + page * 4}%` }} /></div>
              <small>第 {page} 页</small>
            </button>
          ))}
        </aside>
        <section className="viewer-column">
          <div className="viewer-toolbar">
            <div><button onClick={() => store.setPage(Math.max(1, store.activePage - 1))} disabled={store.activePage === 1}><ChevronLeft size={16} /></button><strong>{store.activePage} / {doc.pages}</strong><button onClick={() => store.setPage(Math.min(doc.pages, store.activePage + 1))} disabled={store.activePage === doc.pages}><ChevronRight size={16} /></button></div>
            <span>125%</span>
            <span>原页 · 掩码叠加</span>
          </div>
          <div className="pdf-stage">
            <PdfPage
              pageNumber={store.activePage}
              onDraw={store.redactionMode ? (region) => store.addRedaction({ ...region, page: store.activePage, reason, privilege }) : undefined}
            />
            {pageRegions.map((region) => {
              const review = regionReview(region.id);
              return (
                <button
                  key={region.id}
                  className={`redaction-region ${region.status} ${store.activeRedactionId === region.id ? 'selected' : ''}`}
                  style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}
                  onClick={() => store.selectRedaction(region.id)}
                  title={`${region.reason} / ${region.privilege} / 处理人 ${reviewerName(region.assigneeId)}`}
                >
                  {review && (
                    <i className={`region-review-dot ${review.status === 'signed' ? (review.verdict === 'reject' ? 'reject' : 'signed') : review.history.some((entry) => entry.invalidated) ? 'invalid' : 'pending'}`}>
                      {review.status === 'signed' ? (review.verdict === 'reject' ? '驳' : '签') : review.history.some((entry) => entry.invalidated) ? '失' : '待'}
                    </i>
                  )}
                </button>
              );
            })}
          </div>
        </section>
        <aside className="inspector">
          <div className="side-label">区域属性</div>
          {active ? (
            <>
              <div className="inspector-title"><strong>{active.reason}</strong><Badge tone={active.status === 'confirmed' ? 'green' : 'amber'}>{active.status === 'confirmed' ? '已确认' : '草稿'}</Badge></div>
              <label>保密级别<select value={doc.classification} disabled={!canEdit} onChange={(event) => store.updateClassification(event.target.value as DisclosureRecord['classification'])}><option>内部</option><option>机密</option><option>严格机密</option></select></label>
              <label>去密原因<input value={active.reason} readOnly /></label>
              <label>特权标签<input value={active.privilege} readOnly /></label>
              <label>文档负责人<input value={`${reviewerName(doc.ownerId)}（交接可转）`} readOnly /></label>
              <label>区域处理人<input value={reviewerName(active.assigneeId)} readOnly /></label>
              <div className="coordinate-grid"><div><span>X</span><b>{Math.round(active.x * 100)}%</b></div><div><span>Y</span><b>{Math.round(active.y * 100)}%</b></div><div><span>宽</span><b>{Math.round(active.width * 100)}%</b></div><div><span>高</span><b>{Math.round(active.height * 100)}%</b></div></div>
              <Button
                onClick={() => store.confirmRedaction(active.id)}
                disabled={active.status === 'confirmed' || (doc.ownerId !== currentUserId && active.assigneeId !== currentUserId) || !current.available}
              >
                <Check size={15} /> 确认此区域
              </Button>
              <Button variant="outline"><Copy size={15} /> 批量复制到同类页</Button>
              <RegionReviewLine item={regionReview(active.id)} />
            </>
          ) : <p className="muted">在文档页面上选择一个去密区域查看属性。</p>}
          <div className="rule-note"><AlertTriangle size={16} /><span>密级或区域一改动，该文档相关已签复核立即失效退回重算；已签结论只读留档。</span></div>
        </aside>
      </div>
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>发布前校验</Dialog.Title>
            <Dialog.Description>系统将核对原始页与发布页的一致性，并检查元数据残留。</Dialog.Description>
            <div className="dialog-checks">
              <p><Check /> {doc.redactions.length} 个去密区域已定位</p>
              <p><Check /> 文档版本与操作者记录完整</p>
              <p className={doc.redactions.some((item) => item.status === 'draft') ? 'failed' : ''}><AlertTriangle /> {doc.redactions.some((item) => item.status === 'draft') ? '仍有未确认区域' : '所有区域已确认'}</p>
            </div>
            <Dialog.Close asChild><Button>返回检查 <X size={15} /></Button></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function RegionReviewLine({ item }: { item?: ReviewItem }) {
  if (!item) return <p className="muted">该区域暂无复核项。</p>;
  const invalidated = item.status === 'pending' && item.history.some((entry) => entry.invalidated);
  if (item.status === 'signed') {
    return (
      <div className={`signed-line ${item.verdict === 'reject' ? 'reject' : ''}`}>
        <FileCheck2 size={14} />
        <span>{item.verdict === 'reject' ? '驳回' : '已签通过'} · {reviewerName(item.signedBy!)} · {item.signedAt}</span>
      </div>
    );
  }
  return (
    <div className={`signed-line pending ${invalidated ? 'invalid' : ''}`}>
      <RefreshCw size={14} />
      <span>{invalidated ? '原结论失效，待重算' : '区域复核待办'} · 承接人 {reviewerName(item.assigneeId)}</span>
    </div>
  );
}

/* ============================== 发布质检 ============================== */

function ReviewRow({ item, doc }: { item: ReviewItem; doc: DisclosureRecord }) {
  const currentUserId = useDisclosureStore((state) => state.currentUserId);
  const signReview = useDisclosureStore((state) => state.signReview);
  const current = reviewers.find((reviewer) => reviewer.id === currentUserId)!;
  const invalidated = item.status === 'pending' && item.history.some((entry) => entry.invalidated);
  const mine = item.status === 'pending' && item.assigneeId === currentUserId && current.available;
  const staleFingerprint =
    item.status === 'signed' && item.fingerprint !== fingerprintFor(doc, item);
  const lastEntry = item.history[item.history.length - 1];
  return (
    <div className={`review-row ${item.status === 'signed' ? (item.verdict === 'reject' ? 'verdict-reject' : 'verdict-pass') : invalidated ? 'verdict-invalid' : ''}`}>
      <div className="review-row-main">
        <div className="review-row-title">
          <strong>{item.label}</strong>
          <Badge tone="blue">{item.kind}</Badge>
          {item.status === 'signed'
            ? <Badge tone={item.verdict === 'reject' ? 'red' : 'green'}>{item.verdict === 'reject' ? '已驳回' : '已签通过'}</Badge>
            : invalidated
              ? <Badge tone="red"><RefreshCw size={10} /> 失效重算</Badge>
              : <Badge tone="amber">待复核</Badge>}
          {staleFingerprint && <Badge tone="red">指纹失配</Badge>}
        </div>
        <small>
          {item.status === 'signed'
            ? `签字：${reviewerName(item.signedBy!)} · ${item.signedAt}（只读保留，不可覆盖）`
            : invalidated
              ? `密级/区域已变更，原 ${lastEntry ? `${reviewerName(lastEntry.signedBy)} 的结论已沉入历史` : '结论失效'}，现分派给 ${reviewerName(item.assigneeId)} 重算`
              : `当前承接人：${reviewerName(item.assigneeId)}`}
        </small>
      </div>
      {item.status === 'pending' && (
        <div className="review-row-actions">
          {mine
            ? <>
                <Button onClick={() => signReview(item.id, 'pass')}><Check size={14} /> 通过</Button>
                <Button variant="danger" onClick={() => signReview(item.id, 'reject', '复核发现遮蔽残留')}><Ban size={14} /> 驳回</Button>
              </>
            : <Badge tone="neutral"><Lock size={11} /> 仅 {reviewerName(item.assigneeId)} 可签{!current.available ? ' · 当前账号已离岗' : ''}</Badge>}
        </div>
      )}
    </div>
  );
}

function QualityPage() {
  const store = useDisclosureStore();
  const currentUserId = useDisclosureStore((state) => state.currentUserId);
  const [docId, setDocId] = useState(store.documents[1]?.id ?? store.documents[0].id);
  const doc = store.documents.find((item) => item.id === docId) ?? store.documents[0];
  const items = store.reviewItems.filter((item) => item.documentId === doc.id);
  const gate = evaluateGate([doc.id], store.documents, store.reviewItems, store.handovers);
  const current = reviewers.find((reviewer) => reviewer.id === currentUserId)!;
  return (
    <div className="page">
      <header className="page-heading">
        <div><small>QUALITY ASSURANCE / SIDE-BY-SIDE</small><h1>发布质控双人复核</h1><p>并排检查原始页与发布页，所有差异必须留下复核结论；签字只读，变更即失效重算。</p></div>
        <div className="doc-switcher">
          <FileText size={15} />
          <select value={doc.id} onChange={(event) => setDocId(event.target.value)}>
            {store.documents.map((entry) => <option key={entry.id} value={entry.id}>{entry.id} · {entry.title}</option>)}
          </select>
        </div>
      </header>
      <div className="comparison-banner">
        <div><Eye size={17} /><strong>{doc.title}</strong><span>负责人 {reviewerName(doc.ownerId)} · 双人复核 · 承接人 {[...new Set(items.filter((item) => item.status === 'pending').map((item) => reviewerName(item.assigneeId)))].join('、') || '无待办'}</span></div>
        <Badge tone={items.some((item) => item.status === 'pending') ? 'amber' : 'green'}>
          {items.filter((item) => item.status === 'signed').length}/{items.length} 已签
        </Badge>
      </div>
      <div className="compare-grid">
        <Card className="compare-panel"><div className="compare-head"><span>原始页</span><Badge tone="neutral">源文件</Badge></div><div className="compare-page"><PdfPage pageNumber={1} /></div></Card>
        <Card className="compare-panel"><div className="compare-head"><span>发布页</span><Badge tone="green">已遮蔽</Badge></div><div className="compare-page redacted-preview"><PdfPage pageNumber={1} redacted /><div className="demo-mask mask-one" /><div className="demo-mask mask-two" /></div></Card>
      </div>
      <div className="quality-bottom">
        <Card className="checks-card quality-review-card">
          <div className="card-title"><ClipboardCheck size={17} /><strong>复核清单（文档级 + 区域级）</strong><span>按文档和区域分派</span></div>
          {items.map((item) => <ReviewRow key={item.id} item={item} doc={doc} />)}
          <SignedHistory items={items} />
        </Card>
        <Card className="decision-card">
          <div className="card-title"><ShieldCheck size={17} /><strong>发布门禁结论</strong></div>
          <p>本份文档共 <b>{doc.redactions.length}</b> 个去密区域、<b>{items.length}</b> 项复核；已签 <b>{items.filter((item) => item.status === 'signed').length}</b> 项，失效待重算 <b>{gate.invalidatedCount}</b> 项。</p>
          <div className={`gate-box ${gate.blocked ? 'blocked' : 'clear'}`}>
            <div>{gate.blocked ? <Lock size={16} /> : <ShieldCheck size={16} />}<strong>{gate.blocked ? '门禁关闭 · 禁止发布' : '门禁放行'}</strong></div>
            {gate.blocked
              ? <ul>{gate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              : <small>全部复核有效且签署完成，交接无挂起。</small>}
          </div>
          <div className="decision-actions single">
            <Button
              disabled={gate.blocked || (current.role !== '复核员' && current.role !== '组长')}
              onClick={() => store.markReady(doc.id)}
              title={current.role !== '复核员' && current.role !== '组长' ? '仅复核员/组长可执行' : ''}
            >
              <Check size={15} /> 通过并标记可发布
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SignedHistory({ items }: { items: ReviewItem[] }) {
  const entries = items.flatMap((item) =>
    item.history.map((entry) => ({ ...entry, itemLabel: item.label, active: !entry.invalidated }))
  );
  if (entries.length === 0) return null;
  return (
    <div className="signed-history">
      <div className="card-title"><History size={15} /><strong>已签结论留档</strong><span>只读</span></div>
      {entries.map((entry, index) => (
        <div key={`${entry.signedAt}-${index}`} className={`history-row ${entry.active ? '' : 'invalid'}`}>
          <Badge tone={entry.verdict === 'reject' ? 'red' : 'green'}>{entry.verdict === 'reject' ? '驳回' : '通过'}</Badge>
          <span>{entry.itemLabel}</span>
          <small>{entry.signedByName} · {entry.signedAt}{entry.invalidated ? ' · 已被密级/区域变更作废（只读）' : ''}</small>
        </div>
      ))}
    </div>
  );
}

/* ============================== 批次与发布门禁 ============================== */

function BatchesPage() {
  const store = useDisclosureStore();
  const bundles = [...new Set(store.documents.map((doc) => doc.bundle))];
  const [activeBundle, setActiveBundle] = useState(bundles[0]);
  const docs = store.documents.filter((doc) => doc.bundle === activeBundle);
  const gate = evaluateGate(docs.map((doc) => doc.id), store.documents, store.reviewItems, store.handovers);
  const published = store.publishedBatches.includes(activeBundle);
  return (
    <div className="page">
      <header className="page-heading">
        <div><small>RELEASE BATCH / TAXONOMY</small><h1>发布批次与标签</h1><p>交接未完成、复核失效或未签全的批次会被门禁挡住；越权发布直接拒绝。</p></div>
        <Button disabled={gate.blocked || published} onClick={() => store.publishBatch(activeBundle)}>
          {published ? <Check size={16} /> : <Lock size={16} />} {published ? '已生成发布包' : '生成发布包'}
        </Button>
      </header>
      <div className={`batch-gate ${gate.blocked ? 'blocked' : 'clear'}`}>
        <div>{gate.blocked ? <Lock size={17} /> : <ShieldCheck size={17} />}<strong>{gate.blocked ? '发布门禁拦截中' : '发布门禁已放行'}</strong><span>{activeBundle}</span></div>
        {gate.blocked
          ? <ul>{gate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          : <span>授权交接全部完成、复核结论全部有效。</span>}
      </div>
      <div className="batch-layout">
        <Card className="batch-list">
          <div className="card-title"><Layers3 size={17} /><strong>发布批次</strong></div>
          {bundles.map((bundle) => {
            const bundleDocs = store.documents.filter((doc) => doc.bundle === bundle);
            const bundleGate = evaluateGate(bundleDocs.map((doc) => doc.id), store.documents, store.reviewItems, store.handovers);
            return (
              <button key={bundle} className={bundle === activeBundle ? 'active' : ''} onClick={() => setActiveBundle(bundle)}>
                <span>BATCH · {bundleDocs[0]?.id.slice(4, 6)}</span>
                <strong>{bundle}</strong>
                <small>{bundleDocs.length} 份文档{bundleGate.blocked ? ' · 门禁关闭' : ' · 可发布'}</small>
              </button>
            );
          })}
        </Card>
        <Card className="batch-content">
          <div className="card-title"><Tags size={17} /><strong>批次文档与复核状态</strong><span>{docs.length} 份</span></div>
          <div className="batch-table">
            {docs.map((doc) => {
              const items = store.reviewItems.filter((item) => item.documentId === doc.id);
              const pending = items.filter((item) => item.status === 'pending');
              const invalid = pending.filter((item) => item.history.some((entry) => entry.invalidated));
              return (
                <div key={doc.id} className="batch-row-static">
                  <FileText size={17} />
                  <div><strong>{doc.title}</strong><span>{doc.id} · 负责人 {reviewerName(doc.ownerId)} · {doc.issue}</span></div>
                  <div className="batch-row-metrics">
                    <span>{items.filter((item) => item.status === 'signed').length}/{items.length} 已签</span>
                    {pending.length > 0 && <Badge tone="amber">{pending.length} 待办</Badge>}
                    {invalid.length > 0 && <Badge tone="red">{invalid.length} 失效</Badge>}
                    <Badge tone={doc.status === '可发布' ? 'green' : 'amber'}>{doc.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="tag-editor">
            <h3>标签与分发级</h3>
            <div className="tag-options">{['合同问题', '设备缺陷', '现场安全', '损害赔偿', '仅律师可见'].map((tag, index) => <span key={tag} className={index < 3 ? 'selected' : ''}>{tag}</span>)}</div>
            <label>导出清单说明<textarea defaultValue="按案卷编号升序导出，保留去密版本、操作者、交接号与审批时间。" /></label>
          </div>
        </Card>
        <Card className="batch-summary">
          <div className="side-label">当前批次摘要</div>
          <strong>{activeBundle}</strong>
          <dl>
            <div><dt>文档</dt><dd>{docs.length}</dd></div>
            <div><dt>未完成复核</dt><dd className={gate.pendingCount ? 'warning-text' : ''}>{gate.pendingCount}</dd></div>
            <div><dt>失效重算</dt><dd className={gate.invalidatedCount ? 'danger-text' : ''}>{gate.invalidatedCount}</dd></div>
            <div><dt>草稿区域</dt><dd className={gate.unsignedRegionCount ? 'warning-text' : ''}>{gate.unsignedRegionCount}</dd></div>
          </dl>
          <div className={`summary-note ${gate.blocked ? 'blocking' : 'passing'}`}>
            {gate.blocked ? <Lock size={15} /> : <ShieldCheck size={15} />}
            <span>{gate.blocked ? '门禁关闭，完成交接并重算失效复核后才可发布。' : '全部检查通过，可生成发布包。'}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================== 授权交接 ============================== */

function HandoverCard({ handover }: { handover: HandoverRecord }) {
  const store = useDisclosureStore();
  const from = reviewers.find((item) => item.id === handover.fromReviewerId)!;
  const to = reviewers.find((item) => item.id === handover.toReviewerId)!;
  const running = handover.status === 'saving';
  const docCount = handover.scope.documentIds.length;
  const regionCount = handover.scope.regionIds.length;
  return (
    <Card className={`handover-card ${handover.status}`}>
      <div className="handover-card-head">
        <div className="handover-id"><HandoverIcon size={16} /><strong>{handover.id}</strong><Badge tone={handover.status === 'completed' ? 'green' : handover.status === 'failed' ? 'red' : 'amber'}>
          {handover.status === 'completed' ? '交接完成' : handover.status === 'saving' ? '保存中…' : handover.status === 'failed' ? '保存失败 · 已恢复原授权' : '待执行'}
        </Badge></div>
        <small>{handover.createdAt} 创建 · 已尝试 {handover.attempts} 次</small>
      </div>
      <div className="handover-flow">
        <div className="handover-party"><span>转出人</span><strong>{from.name}</strong><small>{from.role} · {from.team} · 已离岗</small></div>
        <ArrowRight className="flow-arrow" size={20} />
        <div className="handover-party"><span>接手人</span><strong>{to.name}</strong><small>{to.role} · {to.team}</small></div>
        <div className="handover-scope"><span>交接范围</span><strong>{docCount} 份文档 · {regionCount} 个区域</strong><small>{handover.reason}</small></div>
      </div>
      <div className="handover-scope-tags">
        {handover.scope.documentIds.map((id) => <Badge key={id} tone="blue">文档 {id}</Badge>)}
        {handover.scope.regionIds.map((id) => <Badge key={id} tone="neutral">区域 {id}</Badge>)}
      </div>
      {handover.status === 'failed' && (
        <div className="handover-error">
          <Ban size={15} />
          <span>保存失败（{handover.lastError}）：已从原授权快照恢复，负责人与权限一致，未发生「人换权未换」。请用同一交接号重试。</span>
        </div>
      )}
      {handover.status === 'completed' && handover.changes && (
        <div className="handover-done">
          <Check size={15} />
          <span>实际转出：{handover.changes.documentIds.length} 份文档负责人、{handover.changes.regionIds.length} 个区域、{handover.changes.reviewItemIds.length} 项未完成复核；完成于 {handover.completedAt}，已签结论全部只读保留。</span>
        </div>
      )}
      {handover.status !== 'completed' && (
        <div className="handover-actions">
          <Button disabled={running} onClick={() => store.executeHandover(handover.id)}>
            {running ? <RefreshCw size={15} className="spin" /> : handover.attempts > 0 ? <RotateCcw size={15} /> : <Check size={15} />}
            {running ? '正在保存授权…' : handover.attempts > 0 ? `用同一交接号 ${handover.id} 重试` : '执行交接'}
          </Button>
          <Button variant="outline" disabled={running || handover.status === 'failed'} title={handover.status === 'failed' ? '失败单须用同一交接号重试，不能作废' : ''} onClick={() => store.discardHandover(handover.id)}>{handover.status === 'failed' ? '失败单不可作废' : '作废交接单'}</Button>
        </div>
      )}
    </Card>
  );
}

function HandoversPage() {
  const store = useDisclosureStore();
  const [fromId, setFromId] = useState('U-zhou');
  const [toId, setToId] = useState('U-gu');
  const [reason, setReason] = useState('复核员离岗，授权与待办整体转出');
  const [docScope, setDocScope] = useState<string[]>(['DOC-00418', 'DOC-00427']);
  const [regionScope, setRegionScope] = useState<string[]>(['R-02', 'R-04']);
  const active = activeHandovers(store.handovers);
  const completed = store.handovers.filter((item) => item.status === 'completed');

  const pendingDocs = [...new Set(
    store.reviewItems
      .filter((item) => item.status === 'pending' && item.assigneeId === fromId)
      .map((item) => item.documentId)
  )];
  const ownedDocs = store.documents.filter((doc) => doc.ownerId === fromId).map((doc) => doc.id);
  const eligibleDocIds = [...new Set([...pendingDocs, ...ownedDocs])];
  const eligibleRegions = store.documents.flatMap((doc) =>
    doc.redactions
      .filter((region) => region.assigneeId === fromId || store.reviewItems.some((item) => item.status === 'pending' && item.assigneeId === fromId && item.redactionId === region.id))
      .map((region) => region.id)
  );
  const switchFrom = (nextId: string) => {
    setFromId(nextId);
    const nextDocIds = [...new Set([
      ...store.documents.filter((doc) => doc.ownerId === nextId).map((doc) => doc.id),
      ...store.reviewItems.filter((item) => item.status === 'pending' && item.assigneeId === nextId).map((item) => item.documentId)
    ])];
    const nextRegionIds = store.documents.flatMap((doc) =>
      doc.redactions
        .filter((region) => region.assigneeId === nextId || store.reviewItems.some((item) => item.status === 'pending' && item.assigneeId === nextId && item.redactionId === region.id))
        .map((region) => region.id)
    );
    setDocScope(nextDocIds);
    setRegionScope(nextRegionIds);
  };
  const pendingCount = store.reviewItems.filter(
    (item) =>
      item.status === 'pending' &&
      item.assigneeId === fromId &&
      (docScope.includes(item.documentId) || (item.redactionId && regionScope.includes(item.redactionId)))
  ).length;

  const toggle = (list: string[], setter: (next: string[]) => void, id: string) =>
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  const create = () => {
    const id = store.createHandover({
      fromReviewerId: fromId,
      toReviewerId: toId,
      reason,
      scope: { documentIds: docScope, regionIds: regionScope }
    });
    if (id) {
      setDocScope([]);
      setRegionScope([]);
    }
  };

  return (
    <div className="page handovers-page">
      <header className="page-heading">
        <div><small>AUTHORIZATION / RECOVERABLE HANDOVER</small><h1>可恢复授权交接</h1><p>交接号记录转出人、接手人与范围；已签结论只读保留，未完成项按文档和区域重新分派。</p></div>
        <label className="failure-toggle">
          <input type="checkbox" checked={store.simulateSaveFailure} onChange={(event) => store.setSimulateSaveFailure(event.target.checked)} />
          模拟授权服务保存失败（演示回滚 + 同号重试）
        </label>
      </header>

      {active.map((handover) => <HandoverCard key={handover.id} handover={handover} />)}

      <Card className="handover-form-card">
        <div className="card-title"><HandoverIcon size={17} /><strong>新建交接单</strong><span>草稿持久化，重开页面仍可继续</span></div>
        <div className="handover-form-grid">
          <label>转出人（离岗）
            <select value={fromId} onChange={(event) => switchFrom(event.target.value)}>
              {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name} · {reviewer.role}{reviewer.available ? '' : '（已离岗）'}</option>)}
            </select>
          </label>
          <label>接手人
            <select value={toId} onChange={(event) => setToId(event.target.value)}>
              {reviewers.filter((reviewer) => reviewer.id !== fromId).map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name} · {reviewer.role}{reviewer.available ? '' : '（已离岗，不可承接）'}</option>)}
            </select>
          </label>
          <label className="wide">交接事由<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        </div>
        <div className="scope-picker">
          <div className="scope-column">
            <div className="side-label">按文档转出（负责人 + 该文档待办）</div>
            {eligibleDocIds.length === 0 && <p className="muted">转出人名下没有可转出的文档。</p>}
            {eligibleDocIds.map((id) => {
              const doc = store.documents.find((entry) => entry.id === id)!;
              const pending = store.reviewItems.filter((item) => item.documentId === id && item.status === 'pending' && item.assigneeId === fromId).length;
              return (
                <label key={id} className="scope-row">
                  <input type="checkbox" checked={docScope.includes(id)} onChange={() => toggle(docScope, setDocScope, id)} />
                  <div><strong>{doc.id} · {doc.title}</strong><small>{doc.ownerId === fromId ? '文档负责人' : ''}{doc.ownerId === fromId && pending > 0 ? ' · ' : ''}{pending > 0 ? `${pending} 项未完成复核` : ''}</small></div>
                </label>
              );
            })}
          </div>
          <div className="scope-column">
            <div className="side-label">按区域转出（仅区域处理与区域复核）</div>
            {eligibleRegions.length === 0 && <p className="muted">转出人名下没有可转出的区域。</p>}
            {eligibleRegions.map((regionId) => {
              const doc = store.documents.find((entry) => entry.redactions.some((region) => region.id === regionId))!;
              const region = doc.redactions.find((entry) => entry.id === regionId)!;
              return (
                <label key={region.id} className="scope-row">
                  <input type="checkbox" checked={regionScope.includes(region.id)} onChange={() => toggle(regionScope, setRegionScope, region.id)} />
                  <div><strong>{region.id} · {region.reason}</strong><small>{doc.id} 第 {region.page} 页 · {region.status === 'draft' ? '草稿' : '已确认'}</small></div>
                </label>
              );
            })}
          </div>
        </div>
        <div className="handover-form-foot">
          <span>预计重新分派 <b>{pendingCount}</b> 项未完成复核；已签结论不迁移、不覆盖。</span>
          <Button onClick={create} disabled={active.length > 0}><Send size={15} /> 生成交接单</Button>
        </div>
      </Card>

      <Card className="handover-history-card">
        <div className="card-title"><History size={17} /><strong>交接记录</strong><span>交接号 + 双方 + 范围 + 实际改动</span></div>
        {completed.length === 0 && <p className="muted">尚无完成的交接。执行上面的交接单后在此留档。</p>}
        {completed.map((handover) => (
          <div key={handover.id} className="history-handover-row">
            <Badge tone="green"><Check size={11} /> {handover.id}</Badge>
            <div>
              <strong>{reviewerName(handover.fromReviewerId)} → {reviewerName(handover.toReviewerId)}</strong>
              <small>{handover.scope.documentIds.length} 文档 / {handover.scope.regionIds.length} 区域 · 重派 {handover.changes?.reviewItemIds.length ?? 0} 项 · {handover.createdAt} → {handover.completedAt}</small>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ============================== 路由 ============================== */

const rootRoute = createRootRoute({ component: AppShell });
const documentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DocumentsPage });
const reviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/review/$documentId', component: ReviewPage });
const qualityRoute = createRoute({ getParentRoute: () => rootRoute, path: '/quality', component: QualityPage });
const batchesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/batches', component: BatchesPage });
const handoversRoute = createRoute({ getParentRoute: () => rootRoute, path: '/handovers', component: HandoversPage });
const routeTree = rootRoute.addChildren([documentsRoute, reviewRoute, qualityRoute, batchesRoute, handoversRoute]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

export default function App() {
  return <RouterProvider router={router} />;
}
