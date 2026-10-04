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
  FileWarning,
  Handshake,
  Highlighter,
  Layers3,
  Lock,
  Menu,
  PanelLeftClose,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Stamp,
  Tags,
  UploadCloud,
  X
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Badge, Button, Card, Dialog, Tabs } from './components/ui';
import { useDisclosureStore, isAuthorized, isGated, reviewerName, type DisclosureRecord, type Handover, type Redaction } from './store';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const bundleQuery = async () => ({
  queue: [
    { id: 'Q-31', name: '第三批补充材料', count: 128, owner: '林清', progress: 68, due: '今日 16:00' },
    { id: 'Q-32', name: '证人材料图像件', count: 47, owner: '周叙', progress: 34, due: '明日 11:00' },
    { id: 'Q-33', name: '专家报告附件', count: 19, owner: '顾言', progress: 91, due: '09-30 18:00' }
  ]
});

function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  const links = [
    { to: '/', label: '文档集', icon: Layers3 },
    { to: '/review/$documentId', label: '去密审阅', icon: Highlighter },
    { to: '/quality', label: '发布质检', icon: ScanSearch },
    { to: '/batches', label: '批次与标签', icon: Tags },
    { to: '/handover', label: '授权交接', icon: Handshake }
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-symbol"><Stamp size={18} /></div>
          <div><strong>披露质控台</strong><span>North Ridge / Litigation Support</span></div>
        </div>
        <div className="top-actions">
          <Badge tone="amber">2 项待质检</Badge>
          <div className="operator"><span>质控员</span><strong>林清 · 审核组</strong></div>
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
            {links.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to as '/'} activeProps={{ className: 'active' }} onClick={() => setMobileNav(false)}>
                <Icon size={17} /> <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div><ShieldCheck size={16} /><span>审计记录已开启</span></div>
            <small>草稿自动保存在本机</small>
          </div>
        </aside>
        <main className="main-content"><Outlet /></main>
      </div>
      <RejectionToast />
    </div>
  );
}

function RejectionToast() {
  const rejection = useDisclosureStore((state) => state.rejection);
  const dismissRejection = useDisclosureStore((state) => state.dismissRejection);
  useEffect(() => {
    if (!rejection) return;
    const timer = window.setTimeout(dismissRejection, 6000);
    return () => window.clearTimeout(timer);
  }, [rejection, dismissRejection]);
  if (!rejection) return null;
  return (
    <div className="rejection-toast" role="alert">
      <Ban size={17} />
      <span>{rejection}</span>
      <button onClick={dismissRejection} aria-label="关闭"><X size={15} /></button>
    </div>
  );
}

function DocumentsPage() {
  const documents = useDisclosureStore((state) => state.documents);
  const { data } = useQuery({ queryKey: ['document-queues'], queryFn: bundleQuery });
  const [filter, setFilter] = useState('全部');
  const visible = filter === '全部' ? documents : documents.filter((doc) => doc.status === filter);
  return (
    <div className="page">
      <header className="page-heading">
        <div><small>DISCLOSURE CONTROL / DOCUMENT SET</small><h1>披露文档集</h1><p>分批完成密级复核、敏感区域去密与发布版本比对。</p></div>
        <Button><UploadCloud size={16} /> 导入文档集</Button>
      </header>
      <section className="summary-strip">
        <div><span>文档总数</span><strong>194</strong><small>12.8 GB</small></div>
        <div><span>去密区域</span><strong>2,481</strong><small>较上版 +34</small></div>
        <div><span>待质检</span><strong className="warning-text">17</strong><small>4 项高风险</small></div>
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
            {visible.map((doc) => (
              <div className="document-row" key={doc.id}>
                <div className="file-icon"><FileText size={19} /></div>
                <div className="doc-main">
                  <strong>{doc.title}</strong>
                  <span>{doc.id} · {doc.bundle} · {doc.size}</span>
                </div>
                <div className="doc-field"><span>密级</span><Badge tone={doc.classification === '严格机密' ? 'red' : doc.classification === '机密' ? 'amber' : 'neutral'}>{doc.classification}</Badge></div>
                <div className="doc-field"><span>负责人员</span><strong>{doc.owner}</strong></div>
                <div className="doc-field"><span>状态</span><Badge tone={doc.status === '可发布' ? 'green' : doc.status === '待质检' ? 'amber' : 'blue'}>{doc.status}</Badge></div>
                <div className="doc-actions">
                  <Link to="/review/$documentId" params={{ documentId: doc.id }}><Button variant="outline">审阅</Button></Link>
                </div>
              </div>
            ))}
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
            <div className="card-title"><ShieldCheck size={17} /><strong>最近操作</strong></div>
            <p><b>09:48</b> 林清确认 DOC-00418 的合同价款遮蔽区域。</p>
            <p><b>09:31</b> 周叙提交会议纪要待质检。</p>
            <p><b>08:54</b> 顾言导出 DOC-00435 发布清单。</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

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

function ReviewPage() {
  const { documentId } = useParams({ from: '/review/$documentId' });
  const navigate = useNavigate();
  const { documents, reviewers, authorizations, handovers, currentOperatorId, activePage, redactionMode, activeRedactionId } = useDisclosureStore();
  const store = useDisclosureStore();
  const doc = documents.find((item) => item.id === documentId) ?? documents[0];
  const pageRegions = doc.redactions.filter((item) => item.page === activePage);
  const active = doc.redactions.find((item) => item.id === activeRedactionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('商业秘密');
  const [privilege, setPrivilege] = useState('合同保密');
  const authorized = isAuthorized(authorizations, doc.id, currentOperatorId);
  const gate = isGated(handovers, doc.id);
  return (
    <div className="page review-page">
      <header className="review-header">
        <div className="review-title">
          <Button variant="ghost" onClick={() => navigate({ to: '/' })}><ArrowLeft size={16} /></Button>
          <div><small>{doc.id} / 去密审阅</small><h1>{doc.title}</h1></div>
          <Badge tone={doc.classification === '严格机密' ? 'red' : 'amber'}>{doc.classification}</Badge>
        </div>
        <div className="review-actions">
          <Button variant="outline" onClick={() => store.toggleRedactionMode()} className={redactionMode ? 'active-button' : ''}><Highlighter size={16} /> {redactionMode ? '取消绘制' : '绘制去密区'}</Button>
          <Button variant="outline" onClick={() => setDialogOpen(true)}><FileCheck2 size={16} /> 发布前校验</Button>
          <Button onClick={store.submitForQuality}><Check size={16} /> 提交质检</Button>
        </div>
      </header>
      {!authorized && (
        <div className="inline-banner denied"><Ban size={15} /><span>您不是 {doc.id} 的授权复核人（当前负责人：{reviewerName(reviewers, doc.owner)}），绘制、确认、改密级与提交均会被直接拒绝。</span></div>
      )}
      {authorized && gate && (
        <div className="inline-banner gate"><ShieldAlert size={15} /><span>发布门禁未放行：本文档存在未完成的授权交接 {gate.id}，交接完成前相应批次不得发布。</span></div>
      )}
      {doc.reviewInvalid && (
        <div className="inline-banner invalid"><FileWarning size={15} /><span>原复核结论已失效：{doc.invalidReason ?? '密级或区域变更'}，须重新生成复核结论后再发布。</span></div>
      )}
      <div className="review-layout">
        <aside className="page-thumbs">
          <div className="side-label">页级预览 <span>{doc.pages} 页</span></div>
          {[1, 2, 3].map((page) => (
            <button key={page} className={activePage === page ? 'active' : ''} onClick={() => store.setPage(page)}>
              <div className="mini-page"><span>{page}</span><i style={{ width: `${45 + page * 9}%` }} /><i style={{ width: `${70 - page * 5}%` }} /><i style={{ width: `${55 + page * 4}%` }} /></div>
              <small>第 {page} 页</small>
            </button>
          ))}
        </aside>
        <section className="viewer-column">
          <div className="viewer-toolbar">
            <div><button onClick={() => store.setPage(Math.max(1, activePage - 1))} disabled={activePage === 1}><ChevronLeft size={16} /></button><strong>{activePage} / {doc.pages}</strong><button onClick={() => store.setPage(Math.min(doc.pages, activePage + 1))} disabled={activePage === doc.pages}><ChevronRight size={16} /></button></div>
            <span>125%</span>
            <span>原页 · 掩码叠加</span>
          </div>
          <div className="pdf-stage">
            <PdfPage
              pageNumber={activePage}
              onDraw={redactionMode ? (region) => store.addRedaction({ ...region, page: activePage, reason, privilege }) : undefined}
            />
            {pageRegions.map((region) => (
              <button
                key={region.id}
                className={`redaction-region ${region.status} ${activeRedactionId === region.id ? 'selected' : ''}`}
                style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}
                onClick={() => store.selectRedaction(region.id)}
                title={`${region.reason} / ${region.privilege}`}
              />
            ))}
          </div>
        </section>
        <aside className="inspector">
          <div className="side-label">区域属性</div>
          {active ? (
            <>
              <div className="inspector-title"><strong>{active.reason}</strong><Badge tone={active.status === 'confirmed' ? 'green' : 'amber'}>{active.status === 'confirmed' ? '已确认' : '草稿'}</Badge></div>
              {active.status === 'confirmed'
                ? <div className="signed-note"><Lock size={13} /><span>已签结论 · 只读保留（签署人：{reviewerName(reviewers, active.signedBy)}）</span></div>
                : <div className="unsigned-note"><Highlighter size={13} /><span>未完成项：交接后随文档与区域重新分派给接手人</span></div>}
              <label>保密级别<select value={doc.classification} onChange={(event) => store.updateClassification(event.target.value as DisclosureRecord['classification'])}><option>内部</option><option>机密</option><option>严格机密</option></select></label>
              <label>去密原因<input value={active.reason} readOnly /></label>
              <label>特权标签<input value={active.privilege} readOnly /></label>
              <label>责任人员<input value={reviewerName(reviewers, doc.owner)} readOnly /></label>
              <div className="coordinate-grid"><div><span>X</span><b>{Math.round(active.x * 100)}%</b></div><div><span>Y</span><b>{Math.round(active.y * 100)}%</b></div><div><span>宽</span><b>{Math.round(active.width * 100)}%</b></div><div><span>高</span><b>{Math.round(active.height * 100)}%</b></div></div>
              <Button onClick={() => store.confirmRedaction(active.id)} disabled={active.status === 'confirmed' || !authorized}><Check size={15} /> 确认此区域</Button>
              <Button variant="outline"><Copy size={15} /> 批量复制到同类页</Button>
            </>
          ) : <p className="muted">在文档页面上选择一个去密区域查看属性。</p>}
          <div className="rule-note"><AlertTriangle size={16} /><span>发布版本不得包含原始文本层或图片残片。</span></div>
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

function QualityPage() {
  const { documents, handovers, authorizations, currentOperatorId } = useDisclosureStore();
  const store = useDisclosureStore();
  const doc = documents[1];
  const gate = isGated(handovers, doc.id);
  const authorized = isAuthorized(authorizations, doc.id, currentOperatorId);
  const checks = [
    { id: 'forbidden-terms', label: '全文禁词与姓名复核', detail: '扫描原始页和发布页文本层' },
    { id: 'page-number', label: '页序与页码连续性', detail: '检查拆页、合并及漏页情况' },
    { id: 'image-boundary', label: '图像边界残片', detail: '逐页比较遮蔽边界 2mm 区域' },
    { id: 'metadata', label: '文档元数据清理', detail: '作者、修订人、批注和隐藏字段' }
  ];
  return (
    <div className="page">
      <header className="page-heading"><div><small>QUALITY ASSURANCE / SIDE-BY-SIDE</small><h1>发布质控双人复核</h1><p>并排检查原始页与发布页，所有差异必须留下复核结论。</p></div><Button><FileCheck2 size={16} /> 导出发布清单</Button></header>
      {!authorized && (
        <div className="inline-banner denied"><Ban size={15} /><span>您不是 {doc.id} 的授权复核人，复核结论与发布操作均会被直接拒绝。</span></div>
      )}
      {gate && (
        <div className="inline-banner gate"><ShieldAlert size={15} /><span>发布门禁未放行：{doc.id} 存在未完成的授权交接 {gate.id}，交接完成前相应批次不得发布。</span></div>
      )}
      {doc.reviewInvalid && (
        <div className="inline-banner invalid"><FileWarning size={15} /><span>复核已失效：{doc.invalidReason ?? '密级或区域变更'}，以下结论须重新生成后才能发布。</span></div>
      )}
      <div className="comparison-banner">
        <div><Eye size={17} /><strong>{doc.title}</strong><span>版本 3.4 · 双人复核</span></div>
        <Badge tone="amber">等待复审员 2/2</Badge>
      </div>
      <div className="compare-grid">
        <Card className="compare-panel"><div className="compare-head"><span>原始页</span><Badge tone="neutral">源文件</Badge></div><div className="compare-page"><PdfPage pageNumber={1} /></div></Card>
        <Card className="compare-panel"><div className="compare-head"><span>发布页</span><Badge tone="green">已遮蔽</Badge></div><div className="compare-page redacted-preview"><PdfPage pageNumber={1} redacted /><div className="demo-mask mask-one" /><div className="demo-mask mask-two" /></div></Card>
      </div>
      <div className="quality-bottom">
        <Card className="checks-card"><div className="card-title"><ClipboardCheck size={17} /><strong>发布前校验项</strong></div>{checks.map((check) => <button className="check-row" key={check.id} onClick={() => store.toggleReviewCheck(check.id)}><span className={store.reviewChecks[check.id] ? 'checked' : ''}>{store.reviewChecks[check.id] && <Check size={13} />}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div></button>)}</Card>
        <Card className="decision-card"><div className="card-title"><ShieldCheck size={17} /><strong>复核结论</strong></div><p>本批次共有 <b>{doc.redactions.length}</b> 个去密区域，其中已确认 {doc.redactions.filter((item) => item.status === 'confirmed').length} 个。</p><label><input type="checkbox" checked={store.metadataCleaned} onChange={store.toggleMetadata} /> 已确认元数据清理</label><div className="decision-actions"><Button variant="outline"><ArrowLeft size={15} /> 退回补件</Button><Button disabled={!store.metadataCleaned || Object.values(store.reviewChecks).some((value) => !value) || !!gate || !authorized || doc.reviewInvalid} onClick={store.markReady}><Check size={15} /> 通过并标记可发布</Button></div></Card>
      </div>
    </div>
  );
}

function BatchesPage() {
  const { documents, handovers } = useDisclosureStore();
  const store = useDisclosureStore();
  const [selected, setSelected] = useState<string[]>(['DOC-00418']);
  const activeDoc = documents.find((doc) => doc.id === selected[0]) ?? documents[0];
  return (
    <div className="page">
      <header className="page-heading"><div><small>RELEASE BATCH / TAXONOMY</small><h1>发布批次与标签</h1><p>按案件问题、辖区和披露对象组织文档，生成可追溯发布清单。</p></div><Button onClick={() => store.generateReleasePackage(selected)}>生成发布包</Button></header>
      <div className="batch-layout">
        <Card className="batch-list"><div className="card-title"><Layers3 size={17} /><strong>发布批次</strong></div>{['第一批披露 · 审阅中', '第二批披露 · 编制中', '专家材料 · 待补充'].map((name, index) => <button key={name} className={index === 0 ? 'active' : ''}><span>BATCH-{String(index + 1).padStart(2, '0')}</span><strong>{name}</strong><small>{[48, 79, 19][index]} 份文档</small></button>)}</Card>
        <Card className="batch-content">
          <div className="card-title"><Tags size={17} /><strong>文档与案件问题映射</strong><span>{selected.length} 已选择</span></div>
          <div className="batch-table">
            {documents.map((doc) => {
              const gate = isGated(handovers, doc.id);
              return (
                <label key={doc.id} className="batch-row"><input type="checkbox" checked={selected.includes(doc.id)} onChange={() => setSelected((ids) => ids.includes(doc.id) ? ids.filter((id) => id !== doc.id) : [...ids, doc.id])} /><FileText size={17} /><div><strong>{doc.title}</strong><span>{doc.id} · {doc.issue}</span></div>{gate && <Badge tone="amber">交接未完成 {gate.id}</Badge>}<Badge tone={doc.status === '可发布' ? 'green' : 'amber'}>{doc.status}</Badge></label>
              );
            })}
          </div>
          <div className="tag-editor"><h3>标签与分发级</h3><div className="tag-options">{(['合同问题', '设备缺陷', '现场安全', '损害赔偿', '仅律师可见']).map((tag, index) => <span key={tag} className={index < 3 ? 'selected' : ''}>{tag}</span>)}</div><label>导出清单说明<textarea defaultValue="按案卷编号升序导出，保留去密版本、操作者与审批时间。" /></label><Button>保存批次设置</Button></div>
        </Card>
        <Card className="batch-summary"><div className="side-label">当前批次摘要</div><strong>{activeDoc.bundle}</strong><dl><div><dt>文档</dt><dd>{selected.length}</dd></div><div><dt>页数</dt><dd>{selected.reduce((sum, id) => sum + (documents.find((doc) => doc.id === id)?.pages ?? 0), 0)}</dd></div><div><dt>风险项</dt><dd>4</dd></div></dl><div className="summary-note"><AlertTriangle size={15} /><span>发布前仍需完成 4 项双人复核。</span></div></Card>
      </div>
    </div>
  );
}

function HandoverPage() {
  const { handovers, documents, reviewers, authorizations, currentOperatorId } = useDisclosureStore();
  const store = useDisclosureStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [from, setFrom] = useState(currentOperatorId);
  const [to, setTo] = useState('zhou-xu');
  const [docIds, setDocIds] = useState<string[]>([]);
  const [regionByDoc, setRegionByDoc] = useState<Record<string, string[]>>({});
  const [simulateFailure, setSimulateFailure] = useState(false);

  const resetForm = () => {
    setDocIds([]);
    setRegionByDoc({});
    setSimulateFailure(false);
    setDialogOpen(false);
  };
  const submit = () => {
    if (from === to || docIds.length === 0) return;
    const regionIds = docIds.flatMap((docId) => {
      const doc = documents.find((item) => item.id === docId);
      const all = doc?.redactions.map((region) => region.id) ?? [];
      return regionByDoc[docId] ?? all;
    });
    const id = store.createHandover({ fromReviewerId: from, toReviewerId: to, documentIds: docIds, regionIds, simulateFailure });
    resetForm();
    store.saveHandover(id);
  };
  const toggleDoc = (docId: string) => {
    setDocIds((prev) => (prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]));
  };
  const toggleRegion = (docId: string, regionId: string) => {
    setRegionByDoc((prev) => {
      const doc = documents.find((item) => item.id === docId)!;
      const all = doc.redactions.map((region) => region.id);
      const current = prev[docId] ?? all;
      const next = current.includes(regionId) ? current.filter((id) => id !== regionId) : [...current, regionId];
      return { ...prev, [docId]: next };
    });
  };

  const statusBadge = (status: Handover['status']) =>
    status === 'completed' ? <Badge tone="green">已完成</Badge>
      : status === 'failed' ? <Badge tone="red">保存失败</Badge>
      : <Badge tone="amber">待完成</Badge>;

  return (
    <div className="page">
      <header className="page-heading">
        <div><small>AUTHORIZATION HANDOVER</small><h1>授权交接</h1><p>复核员离岗时按交接号转移文档与授权：已签结论只读保留，未完成项按文档与区域重新分派；保存失败从原授权恢复，同号重试。</p></div>
        <Button onClick={() => setDialogOpen(true)}><Handshake size={16} /> 新建交接</Button>
      </header>

      <div className="handover-grid">
        <div className="handover-list">
          {handovers.map((h) => {
            const scopeDocs = documents.filter((doc) => h.documentIds.includes(doc.id));
            const signedTotal = scopeDocs.reduce((sum, doc) => sum + doc.redactions.filter((region) => h.regionIds.includes(region.id) && region.status === 'confirmed').length, 0);
            const draftTotal = scopeDocs.reduce((sum, doc) => sum + doc.redactions.filter((region) => h.regionIds.includes(region.id) && region.status === 'draft').length, 0);
            return (
              <Card key={h.id} className="handover-card">
                <div className="handover-head">
                  <div className="handover-id"><strong>{h.id}</strong>{statusBadge(h.status)}</div>
                  <span>{h.createdAt}</span>
                </div>
                <div className="handover-parties">
                  <div><span>转出人</span><strong>{reviewerName(reviewers, h.fromReviewerId)}</strong></div>
                  <ArrowRight size={16} className="handover-arrow" />
                  <div><span>接手人</span><strong>{reviewerName(reviewers, h.toReviewerId)}</strong></div>
                </div>
                <div className="handover-scope">
                  {scopeDocs.map((doc) => (
                    <div className="scope-doc" key={doc.id}>
                      <FileText size={15} />
                      <div>
                        <strong>{doc.id} · {doc.title}</strong>
                        <span>{h.regionIds.filter((regionId) => doc.redactions.some((region) => region.id === regionId)).length} 个区域 · 已签结论 {signedTotal} 项（只读保留）· 未完成 {draftTotal} 项（重新分派给 {reviewerName(reviewers, h.toReviewerId)}）</span>
                      </div>
                    </div>
                  ))}
                </div>
                {h.status === 'failed' && <p className="handover-fail"><AlertTriangle size={14} /> {h.failReason}</p>}
                <div className="handover-actions">
                  {h.status !== 'completed'
                    ? <Button variant="outline" onClick={() => store.saveHandover(h.id)}><RotateCcw size={15} /> {h.status === 'failed' ? '重试交接（同一交接号）' : '保存交接'}</Button>
                    : <span className="handover-done"><Check size={14} /> 已于 {h.completedAt} 完成，负责人与授权均已变更</span>}
                </div>
              </Card>
            );
          })}
        </div>

        <aside className="side-stack">
          <Card className="auth-matrix">
            <div className="card-title"><ShieldCheck size={17} /><strong>当前授权范围</strong></div>
            {reviewers.map((reviewer) => (
              <div className="auth-row" key={reviewer.id}>
                <div><strong>{reviewer.name}</strong><span>{reviewer.team}</span></div>
                <div className="auth-badges">
                  {(authorizations[reviewer.id] ?? []).length === 0 && <Badge tone="neutral">无授权文档</Badge>}
                  {(authorizations[reviewer.id] ?? []).map((docId) => {
                    const doc = documents.find((item) => item.id === docId);
                    const mismatch = doc?.owner !== reviewer.id;
                    return <Badge key={docId} tone={mismatch ? 'red' : 'green'}>{docId}{mismatch ? ' · 负责人不一致' : ''}</Badge>;
                  })}
                </div>
              </div>
            ))}
          </Card>
          <Card className="audit-card">
            <div className="card-title"><ClipboardCheck size={17} /><strong>交接规则</strong></div>
            <p><b>已签结论只读</b>confirmed 区域保留原签结论人，不得变更或重新分派。</p>
            <p><b>未完成项重分派</b>草稿区域随文档与区域范围划归接手人。</p>
            <p><b>失败可恢复</b>保存失败从原授权回滚，沿用同一交接号重试，负责人与权限同步变更。</p>
            <p><b>发布门禁</b>交接完成前相应批次不得发布；之后密级或区域变更，受影响复核失效重算。</p>
          </Card>
        </aside>
      </div>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content handover-dialog">
            <Dialog.Title>新建授权交接</Dialog.Title>
            <Dialog.Description>交接号保存时自动生成；范围按文档与区域勾选，未完成项将重新分派。</Dialog.Description>
            <div className="handover-form">
              <div className="handover-parties">
                <label>转出人
                  <select value={from} onChange={(event) => setFrom(event.target.value)}>
                    {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name} · {reviewer.team}</option>)}
                  </select>
                </label>
                <ArrowRight size={16} className="handover-arrow" />
                <label>接手人
                  <select value={to} onChange={(event) => setTo(event.target.value)}>
                    {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name} · {reviewer.team}</option>)}
                  </select>
                </label>
              </div>
              <div className="scope-picker">
                <span className="side-label">交接范围（按文档与区域）</span>
                {documents.map((doc) => {
                  const checked = docIds.includes(doc.id);
                  const all = doc.redactions.map((region) => region.id);
                  const selected = regionByDoc[doc.id] ?? all;
                  return (
                    <div key={doc.id} className="scope-picker-doc">
                      <label className="scope-doc-head">
                        <input type="checkbox" checked={checked} onChange={() => toggleDoc(doc.id)} />
                        <FileText size={15} />
                        <strong>{doc.id} · {doc.title}</strong>
                        <Badge tone={doc.status === '可发布' ? 'green' : 'amber'}>{doc.status}</Badge>
                      </label>
                      {checked && (
                        <div className="scope-regions">
                          {doc.redactions.map((region) => (
                            <label key={region.id} className="scope-region">
                              <input type="checkbox" checked={selected.includes(region.id)} onChange={() => toggleRegion(doc.id, region.id)} />
                              <span className={region.status === 'confirmed' ? 'signed' : ''}>{region.id} · {region.reason} · {region.status === 'confirmed' ? `已签（${reviewerName(reviewers, region.signedBy)}，只读保留）` : '未完成（重新分派）'}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <label className="simulate-failure">
                <input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} />
                <span>模拟本次保存失败（演练从原授权恢复与同号重试）</span>
              </label>
            </div>
            <div className="dialog-actions">
              <Dialog.Close asChild><Button variant="outline">取消</Button></Dialog.Close>
              <Button onClick={submit} disabled={from === to || docIds.length === 0}><Handshake size={15} /> 生成交接号并保存</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

const rootRoute = createRootRoute({ component: AppShell });
const documentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DocumentsPage });
const reviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/review/$documentId', component: ReviewPage });
const qualityRoute = createRoute({ getParentRoute: () => rootRoute, path: '/quality', component: QualityPage });
const batchesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/batches', component: BatchesPage });
const handoverRoute = createRoute({ getParentRoute: () => rootRoute, path: '/handover', component: HandoverPage });
const routeTree = rootRoute.addChildren([documentsRoute, reviewRoute, qualityRoute, batchesRoute, handoverRoute]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

export default function App() {
  return <RouterProvider router={router} />;
}
