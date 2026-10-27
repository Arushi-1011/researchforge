import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle, ArrowDownToLine, BrainCircuit, BarChart2, Check, CheckCheck, ChevronDown, CircleCheck,
  Copy, CreditCard, ExternalLink, Eye, FileOutput, FileText, Filter, GitCompare,
  LoaderCircle, Plus, RefreshCw, Save, Search, ShieldAlert, ShieldCheck, Sparkles, Trash2, TrendingUp, UserPlus, Users,
  WandSparkles, X,
} from 'lucide-react';
import {
  activateDevPremium, addProjectMember, aiCompare, analyzeCitations, askPapers,
  createComparison, createDocument, createGap, deleteComparison, deleteGap,
  downloadDocument, getAnalytics, getComparisons, getComparisonMatrix, getCurrentUser, getDocument, getDocuments, getGaps,
  getLibrary, getProjectMembers, getSubscription, identifyAIGaps, leaveProject, openDocumentView,
  getRecommendations, saveAIGaps, summarizePaper, updateGap, type AIResult, type AISummary,
  type AnalyticsReport, type Comparison, type ComparisonMatrix, type DocumentSection, type LibraryPaper,
  type Project, type ProjectMember, type ResearchDocument, type ResearchGap,
  type Subscription, type User, DOCUMENT_SECTIONS,
} from './api';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function dateLabel(value?: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading workspace-page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

function InlineNotice({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <div className={error ? 'workspace-alert is-error' : 'workspace-alert is-success'} role={error ? 'alert' : 'status'}>
      {error ? <AlertCircle size={16} /> : <CircleCheck size={16} />}
      <span>{error || notice}</span>
    </div>
  );
}

function ProjectPicker({
  projects,
  projectId,
  onChange,
}: {
  projects: Project[];
  projectId: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="workspace-field project-picker">
      <span>Active Project Workspace</span>
      <select
        value={projectId}
        onChange={(event) => onChange(event.target.value)}
        disabled={!projects.length}
      >
        <option value="">{projects.length ? 'Choose a project' : 'Create a project first'}</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Busy({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="workspace-busy">
      <LoaderCircle size={22} className="spin" />
      <span>{label}</span>
    </div>
  );
}

function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="workspace-empty">
      <FileText size={28} />
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

/* =============================================================
   1. COMPARISONS & GAPS PAGE
============================================================= */
export function CompareGapsPage({
  projects,
  projectId,
  onProjectChange,
  onNavigateToLibrary,
}: {
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
  onNavigateToLibrary?: () => void;
}) {
  const [papers, setPapers] = useState<LibraryPaper[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [gaps, setGaps] = useState<ResearchGap[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [comparisonTitle, setComparisonTitle] = useState('Comparative Literature Matrix');
  const [gapNote, setGapNote] = useState('');
  const [gapComparisonId, setGapComparisonId] = useState('');
  const [matrix, setMatrix] = useState<ComparisonMatrix | null>(null);
  const [gapFilter, setGapFilter] = useState<'ALL' | 'OPEN' | 'ADDRESSED'>('ALL');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Confirmation state for deleting comparison or gap
  const [confirmDeleteComparison, setConfirmDeleteComparison] = useState<Comparison | null>(null);
  const [confirmDeleteGap, setConfirmDeleteGap] = useState<ResearchGap | null>(null);

  async function refresh() {
    if (!projectId) {
      setPapers([]);
      setComparisons([]);
      setGaps([]);
      setMatrix(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextPapers, nextComparisons, nextGaps] = await Promise.all([
        getLibrary(projectId),
        getComparisons(projectId),
        getGaps(projectId),
      ]);
      setPapers(nextPapers);
      setComparisons(nextComparisons);
      setGaps(nextGaps);
      setSelectedPaperIds((old) => old.filter((id) => nextPapers.some((paper) => paper.id === id)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [projectId]);

  function togglePaper(id: string) {
    setSelectedPaperIds((old) =>
      old.includes(id) ? old.filter((item) => item !== id) : [...old, id]
    );
  }

  async function handleCreateComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (selectedPaperIds.length < 2) {
      setError('Select at least two different papers to create a comparison matrix.');
      return;
    }
    setBusy(true);
    try {
      const title = comparisonTitle.trim() || 'Comparative Literature Matrix';
      const created = await createComparison(projectId, title, selectedPaperIds);
      setNotice(`Saved comparison matrix “${created.title}”.`);
      setSelectedPaperIds([]);
      await refresh();
      setMatrix(await getComparisonMatrix(projectId, created.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openMatrix(item: Comparison) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const loaded = await getComparisonMatrix(projectId, item.id);
      setMatrix(loaded);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function executeDeleteComparison() {
    if (!confirmDeleteComparison) return;
    const target = confirmDeleteComparison;
    setConfirmDeleteComparison(null);
    setError('');
    try {
      await deleteComparison(projectId, target.id);
      if (matrix?.id === target.id) setMatrix(null);
      setNotice(`Comparison “${target.title}” deleted.`);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleAddGap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!gapNote.trim()) {
      setError('Please enter a research-gap note.');
      return;
    }
    setBusy(true);
    try {
      await createGap(projectId, gapNote.trim(), gapComparisonId || undefined);
      setGapNote('');
      setGapComparisonId('');
      setNotice('Research gap recorded.');
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeGap(gap: ResearchGap, status: 'OPEN' | 'ADDRESSED') {
    setError('');
    try {
      await updateGap(projectId, gap.id, { status });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function executeDeleteGap() {
    if (!confirmDeleteGap) return;
    const target = confirmDeleteGap;
    setConfirmDeleteGap(null);
    try {
      await deleteGap(projectId, target.id);
      setNotice('Research gap note deleted.');
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const displayedGaps = gaps.filter((gap) => {
    if (gapFilter === 'ALL') return true;
    return gap.status === gapFilter;
  });

  return (
    <div className="page-stack workspace-page">
      <PageHeading
        eyebrow="SYNTHESIS & EVIDENCE"
        title="Comparisons & Research Gaps"
        description="Synthesize literature across papers into deterministic metadata matrices and maintain an active research-gap register."
        action={
          <button
            className="secondary-button"
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <ProjectPicker projects={projects} projectId={projectId} onChange={onProjectChange} />
      <InlineNotice error={error} notice={notice} />

      {!projectId ? (
        <EmptyPanel
          title="No Project Selected"
          description="Select or create a research project workspace to compare papers and identify gaps."
        />
      ) : loading ? (
        <Busy label="Loading comparisons and gap register…" />
      ) : (
        <>
          <div className="workspace-grid two-columns">
            {/* Create Comparison Matrix */}
            <section className="content-section workspace-card">
              <div className="workspace-card-title">
                <GitCompare size={20} />
                <div>
                  <h3>Build Comparison Matrix</h3>
                  <p>Select at least 2 papers from your library to compare their core methodology and findings.</p>
                </div>
              </div>

              <form onSubmit={handleCreateComparison} className="workspace-form">
                <label className="workspace-field">
                  <span>Matrix Title</span>
                  <input
                    maxLength={200}
                    value={comparisonTitle}
                    onChange={(event) => setComparisonTitle(event.target.value)}
                    placeholder="e.g. LLM Reasoning vs Search Augmentation"
                    required
                  />
                </label>

                {papers.length ? (
                  <div className="workspace-field">
                    <span>Select Papers ({selectedPaperIds.length} selected)</span>
                    <div className="workspace-selection-list">
                      {papers.map((paper) => (
                        <label className="workspace-check-row" key={paper.id}>
                          <input
                            type="checkbox"
                            checked={selectedPaperIds.includes(paper.id)}
                            onChange={() => togglePaper(paper.id)}
                          />
                          <span>
                            <strong>{paper.title}</strong>
                            <small>
                              {paper.year || 'Year not stated'} · {paper.source === 'upload' ? 'Uploaded PDF' : paper.source}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="workspace-empty" style={{ padding: '24px 12px' }}>
                    <p style={{ margin: '0 0 12px' }}>No papers in this library yet.</p>
                    {onNavigateToLibrary && (
                      <button type="button" className="secondary-button" onClick={onNavigateToLibrary}>
                        Go to Library to add papers
                      </button>
                    )}
                  </div>
                )}

                <button
                  className="primary-button"
                  type="submit"
                  disabled={busy || selectedPaperIds.length < 2}
                >
                  <GitCompare size={16} />
                  {busy ? 'Building Matrix…' : `Build Matrix (${selectedPaperIds.length} selected)`}
                </button>
              </form>
            </section>

            {/* Record a Research Gap */}
            <section className="content-section workspace-card">
              <div className="workspace-card-title">
                <Save size={20} />
                <div>
                  <h3>Record Research Gap</h3>
                  <p>Document unaddressed questions, contradictions, or methodology limits observed during your review.</p>
                </div>
              </div>

              <form onSubmit={handleAddGap} className="workspace-form">
                <label className="workspace-field">
                  <span>Research Gap Note</span>
                  <textarea
                    rows={5}
                    maxLength={10000}
                    value={gapNote}
                    onChange={(event) => setGapNote(event.target.value)}
                    placeholder="What questions remain unanswered, unaddressed, or conflicting across these papers?"
                    required
                  />
                </label>

                <label className="workspace-field">
                  <span>Linked Comparison Matrix (Optional)</span>
                  <select
                    value={gapComparisonId}
                    onChange={(event) => setGapComparisonId(event.target.value)}
                  >
                    <option value="">No linked comparison</option>
                    {comparisons.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>

                <button className="primary-button" type="submit" disabled={busy || !gapNote.trim()}>
                  <Plus size={16} /> Save Gap Note
                </button>
              </form>
            </section>
          </div>

          {/* Saved Comparisons Section */}
          <section className="content-section workspace-card">
            <div className="section-heading">
              <div>
                <h3>
                  Saved Comparisons <span className="workspace-pill">{comparisons.length}</span>
                </h3>
                <p>View deterministic metadata comparisons extracted from your research library.</p>
              </div>
            </div>

            {comparisons.length ? (
              <div className="workspace-record-list">
                {comparisons.map((item) => (
                  <div className="workspace-record" key={item.id}>
                    <div className="workspace-record-main">
                      <strong>{item.title}</strong>
                      <small>
                        {item.paper_ids.length} papers compared · Created {dateLabel(item.created_at)}
                      </small>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void openMatrix(item)}
                      disabled={busy}
                    >
                      <Eye size={14} /> View Matrix
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      title="Delete comparison"
                      onClick={() => setConfirmDeleteComparison(item)}
                    >
                      <Trash2 size={15} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="No comparisons saved yet"
                description="Select 2 or more papers above to save your first comparison matrix."
              />
            )}

            {/* Rendered Comparison Matrix */}
            {matrix && (
              <div className="workspace-matrix-wrap" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-default)' }}>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">METADATA MATRIX</span>
                    <h3>{matrix.title}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{matrix.note}</p>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    title="Close matrix"
                    onClick={() => setMatrix(null)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="workspace-table-scroll">
                  <table className="workspace-table">
                    <thead>
                      <tr>
                        <th style={{ width: '160px' }}>Field</th>
                        {matrix.papers.map((paper) => (
                          <th key={paper.id} style={{ minWidth: '220px' }}>{paper.title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.matrix.map((row) => (
                        <tr key={row.field}>
                          <th>{row.field.replace(/_/g, ' ')}</th>
                          {row.values.map((cell) => (
                            <td key={cell.paper_id}>
                              {Array.isArray(cell.value)
                                ? (cell.value as string[]).join(', ') || '—'
                                : cell.value == null || cell.value === ''
                                ? '—'
                                : String(cell.value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Research Gap Register */}
          <section className="content-section workspace-card">
            <div className="section-heading">
              <div>
                <h3>
                  Research Gap Register <span className="workspace-pill">{gaps.length}</span>
                </h3>
                <p>Track unexplored areas, validate hypothesis directions, and record progress.</p>
              </div>

              {gaps.length > 0 && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['ALL', 'OPEN', 'ADDRESSED'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`secondary-button ${gapFilter === status ? 'active' : ''}`}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        background: gapFilter === status ? '#eef2ff' : '#ffffff',
                        borderColor: gapFilter === status ? '#6366f1' : 'var(--border-default)',
                        color: gapFilter === status ? '#4f46e5' : '#475569',
                      }}
                      onClick={() => setGapFilter(status)}
                    >
                      {status === 'ALL' ? 'All' : status === 'OPEN' ? 'Open' : 'Addressed'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {displayedGaps.length ? (
              <div className="workspace-gap-list">
                {displayedGaps.map((gap) => (
                  <article className="workspace-gap" key={gap.id}>
                    <div className="workspace-gap-top">
                      <span className={`workspace-pill ${gap.status === 'ADDRESSED' ? 'pill-success' : ''}`}>
                        {gap.status}
                      </span>
                      <span className="workspace-origin">{gap.origin}</span>
                      <time>{dateLabel(gap.created_at)}</time>
                    </div>

                    <p>{gap.note}</p>

                    <div className="workspace-actions-row">
                      {gap.status === 'OPEN' ? (
                        <button
                          className="secondary-button"
                          type="button"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                          onClick={() => void changeGap(gap, 'ADDRESSED')}
                        >
                          <Check size={14} /> Mark Addressed
                        </button>
                      ) : (
                        <button
                          className="secondary-button"
                          type="button"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                          onClick={() => void changeGap(gap, 'OPEN')}
                        >
                          Reopen
                        </button>
                      )}

                      <button
                        className="text-button danger-text"
                        type="button"
                        style={{ marginLeft: 'auto', fontSize: '11px' }}
                        onClick={() => setConfirmDeleteGap(gap)}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="No research gaps matching this view"
                description={
                  gaps.length
                    ? 'No gaps match the selected status filter.'
                    : 'Record your first gap note above or run AI Gap Analysis to discover candidate directions.'
                }
              />
            )}
          </section>
        </>
      )}

      {/* Confirmation Modals */}
      {confirmDeleteComparison && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteComparison(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow" style={{ color: '#ef4444' }}>CONFIRM DELETION</span>
                <h2>Delete Comparison?</h2>
                <p>Are you sure you want to delete “{confirmDeleteComparison.title}”?</p>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmDeleteComparison(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button danger-button"
                onClick={() => void executeDeleteComparison()}
              >
                Delete Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteGap && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteGap(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow" style={{ color: '#ef4444' }}>CONFIRM DELETION</span>
                <h2>Delete Gap Note?</h2>
                <p>This action removes this research gap entry from your register.</p>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmDeleteGap(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button danger-button"
                onClick={() => void executeDeleteGap()}
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   2. AI RESEARCH TOOLS PAGE
============================================================= */
export function AIResearchPage({
  projects,
  projectId,
  onProjectChange,
  onOpenSettings,
}: {
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const [papers, setPapers] = useState<LibraryPaper[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feature, setFeature] = useState<'summary' | 'gaps' | 'compare' | 'recommendations' | 'citations' | 'qa'>('summary');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AIResult | AISummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [activatingDev, setActivatingDev] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedGapIndexes, setSelectedGapIndexes] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setPapers([]);
      setSelectedIds([]);
      setResult(null);
      return;
    }
    let cancelled = false;
    setFetching(true);
    setError('');
    getLibrary(projectId)
      .then((rows) => {
        if (!cancelled) {
          setPapers(rows);
          setSelectedIds((old) => old.filter((id) => rows.some((paper) => paper.id === id)));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function toggle(id: string) {
    setSelectedIds((old) =>
      old.includes(id) ? old.filter((item) => item !== id) : [...old, id]
    );
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setResult(null);

    if (!projectId) {
      setError('Choose a project workspace first.');
      return;
    }

    if (feature !== 'recommendations' && feature !== 'qa' && !selectedIds.length) {
      setError('Select at least one paper for this analysis.');
      return;
    }

    if ((feature === 'compare' || feature === 'gaps') && selectedIds.length < 2) {
      setError('This feature requires selecting at least two different papers.');
      return;
    }

    if (feature === 'summary') {
      const selected = papers.find((p) => p.id === selectedIds[0]);
      if (selected && selected.extraction_status !== 'completed') {
        setError('Paper summaries require extracted PDF text. Run text extraction in the Library first.');
        return;
      }
    }

    if (feature === 'qa' && question.trim().length < 3) {
      setError('Please enter a question with at least 3 characters.');
      return;
    }

    setLoading(true);
    setSelectedGapIndexes([]);

    try {
      let output: AIResult | AISummary;
      if (feature === 'summary') output = await summarizePaper(projectId, selectedIds[0]);
      else if (feature === 'gaps') output = await identifyAIGaps(projectId, selectedIds);
      else if (feature === 'compare') output = await aiCompare(projectId, selectedIds);
      else if (feature === 'recommendations') output = await getRecommendations(projectId, selectedIds);
      else if (feature === 'citations') output = await analyzeCitations(projectId, selectedIds);
      else output = await askPapers(projectId, question.trim(), selectedIds);
      setResult(output);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleActivateDevPremium() {
    setActivatingDev(true);
    setError('');
    try {
      await activateDevPremium();
      setNotice('Development Premium active! You can now run all AI research features.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActivatingDev(false);
    }
  }

  async function saveAsGap() {
    if (!projectId || !result) return;
    const text =
      'summary' in result
        ? result.summary
        : typeof result.result?.text === 'string'
        ? result.result.text
        : typeof result.result?.answer === 'string'
        ? result.result.answer
        : result.answer || '';

    if (!text.trim()) {
      setError('No textual output to save.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      await createGap(
        projectId,
        `${feature === 'gaps' ? 'AI-Identified Gap' : 'AI Research Note'}: ${text.slice(0, 500)}`
      );
      setNotice('Saved AI synthesis to your project Research Gap Register.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveStructuredGaps() {
    if (!projectId || !aiFeatureResult?.id || !selectedGapIndexes.length) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await saveAIGaps(projectId, aiFeatureResult.id, selectedGapIndexes);
      setNotice(`Saved ${response.saved_count} structured research gap${response.saved_count === 1 ? '' : 's'} to your project register.`);
      setSelectedGapIndexes([]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!outputText) return;
    void navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const premiumRequired = /premium/i.test(error) || /subscription/i.test(error);
  const aiFeatureResult = result && !('summary' in result) ? result : null;
  const structuredGaps = Array.isArray(aiFeatureResult?.result?.gaps)
    ? (aiFeatureResult.result.gaps as { title?: string; description?: string; suggested_direction?: string }[])
    : [];

  const outputText = result
    ? 'summary' in result
      ? result.summary
      : typeof result.result?.text === 'string'
      ? result.result.text
      : typeof result.result?.narrative === 'string'
      ? result.result.narrative
      : typeof result.result?.answer === 'string'
      ? result.result.answer
      : result.answer || JSON.stringify(result.result ?? result, null, 2)
    : '';

  return (
    <div className="page-stack workspace-page">
      <PageHeading
        eyebrow="GROUNDED INTELLIGENCE"
        title="AI Research Tools"
        description="Run explicit, evidence-bound AI features strictly grounded in your project's stored paper texts and abstracts."
        action={
          <span className="workspace-pill" style={{ background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Sparkles size={13} /> Premium Entitlement
          </span>
        }
      />

      <ProjectPicker projects={projects} projectId={projectId} onChange={onProjectChange} />
      <InlineNotice error={error} notice={notice} />

      {premiumRequired && (
        <div className="workspace-upgrade">
          <div>
            <CreditCard size={24} />
            <div>
              <strong>Premium Entitlement Required</strong>
              <p>AI features require a Premium plan. You can activate test Premium below for local testing.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleActivateDevPremium()}
              disabled={activatingDev}
            >
              {activatingDev ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
              {activatingDev ? 'Activating…' : 'Activate Test Premium'}
            </button>
            <button className="secondary-button" type="button" onClick={onOpenSettings}>
              Settings & Account
            </button>
          </div>
        </div>
      )}

      {!projectId ? (
        <EmptyPanel
          title="No Project Selected"
          description="Select a project workspace to ground AI features in the project's saved literature."
        />
      ) : fetching ? (
        <Busy label="Loading library papers for analysis…" />
      ) : (
        <div className="workspace-grid two-columns">
          {/* Feature Configuration & Input Form */}
          <section className="content-section workspace-card">
            <div className="workspace-card-title">
              <WandSparkles size={20} />
              <div>
                <h3>Configure AI Feature</h3>
                <p>AI models are invoked explicitly on form submission. No automated background inferences occur.</p>
              </div>
            </div>

            <form onSubmit={run} className="workspace-form">
              <label className="workspace-field">
                <span>Select Feature</span>
                <select
                  value={feature}
                  onChange={(event) => {
                    const next = event.target.value as typeof feature;
                    setFeature(next);
                    if (next === 'summary') setSelectedIds((old) => old.slice(0, 1));
                    setResult(null);
                    setError('');
                  }}
                >
                  <option value="summary">1. Paper Executive Summary (PDF text required)</option>
                  <option value="gaps">2. Research Gap Identification (Min 2 papers)</option>
                  <option value="compare">3. Cross-Paper Comparative Analysis (Min 2 papers)</option>
                  <option value="recommendations">4. Recommended Next Research Directions</option>
                  <option value="citations">5. Citation Metadata & Boundary Analysis</option>
                  <option value="qa">6. Ask Questions Across Papers (Q&A)</option>
                </select>
              </label>

              {feature === 'qa' && (
                <label className="workspace-field">
                  <span>Your Research Question</span>
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    rows={4}
                    minLength={3}
                    maxLength={2000}
                    placeholder="e.g. What specific benchmarks and limitations are stated across these papers?"
                    required
                  />
                </label>
              )}

              <div className="workspace-field">
                <span>
                  {feature === 'summary' ? 'Choose 1 Paper (Single Select)' : 'Scope Papers (Select Multiple)'}
                </span>

                {papers.length ? (
                  <div className="workspace-selection-list">
                    {papers.map((paper) => {
                      const isExtracted = paper.extraction_status === 'completed';
                      return (
                        <label className="workspace-check-row" key={paper.id}>
                          <input
                            type={feature === 'summary' ? 'radio' : 'checkbox'}
                            name={feature === 'summary' ? 'summary-paper-choice' : undefined}
                            checked={selectedIds.includes(paper.id)}
                            onChange={() =>
                              feature === 'summary' ? setSelectedIds([paper.id]) : toggle(paper.id)
                            }
                          />
                          <span>
                            <strong>{paper.title}</strong>
                            <small>
                              {isExtracted ? '✓ Extracted PDF text available' : paper.abstract ? 'Abstract available' : 'No text/abstract'}
                              {paper.year ? ` · ${paper.year}` : ''}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="workspace-muted">
                    No papers in this library. Upload PDFs or import papers via Discover before using AI features.
                  </p>
                )}
              </div>

              {feature === 'recommendations' && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                  Tip: If no individual papers are checked, recommendations will synthesize across all papers in this workspace.
                </p>
              )}

              <button
                className="primary-button"
                type="submit"
                disabled={loading || !papers.length}
              >
                {loading ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                {loading ? 'Synthesizing…' : 'Run AI Feature'}
              </button>
            </form>
          </section>

          {/* AI Result Presentation */}
          <section className="content-section workspace-card ai-output-card">
            <div className="workspace-card-title">
              <BrainCircuit size={20} />
              <div>
                <h3>Synthesis & Output</h3>
                <p>Inspected provider, model, grounding evidence, and safety disclaimers.</p>
              </div>
            </div>

            {loading ? (
              <Busy label="Waiting for configured AI provider response…" />
            ) : result ? (
              <>
                <div className="ai-result-meta">
                  <span>
                    Provider: {'summary' in result ? result.provider : result.provider || 'offline/mock'}
                  </span>
                  <span>
                    Model: {'summary' in result ? result.model : result.model || 'standard'}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    style={{ marginLeft: 'auto' }}
                    onClick={handleCopy}
                    title="Copy output"
                  >
                    {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="ai-result-text">{outputText}</div>

                {/* Disclaimer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', fontSize: '11px', color: '#64748b', marginBottom: '14px' }}>
                  <ShieldAlert size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span>{result.disclaimer || 'AI-assisted output may be incomplete. Verify every claim against original paper texts.'}</span>
                </div>

                {/* Structured Gaps List */}
                {feature === 'gaps' && structuredGaps.length > 0 && (
                  <div style={{ border: '1px solid #e0e7ff', borderRadius: '12px', padding: '16px', background: '#f5f3ff', marginBottom: '14px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#4338ca' }}>
                      Structured Gap Candidates
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {structuredGaps.map((gap, index) => (
                        <label className="workspace-check-row" key={`${index}-${gap.title || 'candidate'}`}>
                          <input
                            type="checkbox"
                            checked={selectedGapIndexes.includes(index)}
                            onChange={() =>
                              setSelectedGapIndexes((old) =>
                                old.includes(index) ? old.filter((i) => i !== index) : [...old, index]
                              )
                            }
                          />
                          <span>
                            <strong>{gap.title || `Gap ${index + 1}`}</strong>
                            <small>{gap.description || gap.suggested_direction || 'No description'}</small>
                          </span>
                        </label>
                      ))}
                    </div>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void saveStructuredGaps()}
                      disabled={loading || !selectedGapIndexes.length}
                    >
                      <Save size={14} />
                      Save Selected Gaps ({selectedGapIndexes.length})
                    </button>
                  </div>
                )}

                {/* Grounding Evidence Excerpts */}
                {aiFeatureResult?.evidence?.length ? (
                  <details className="workspace-evidence">
                    <summary>Grounding Evidence Excerpts ({aiFeatureResult.evidence.length})</summary>
                    {aiFeatureResult.evidence.map((item, index) => (
                      <article key={`${item.paper_id}-${index}`}>
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{item.title}</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                          “{item.excerpt}”
                        </p>
                      </article>
                    ))}
                  </details>
                ) : null}

                {/* Save Output as Note Button */}
                <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void saveAsGap()}
                    disabled={loading}
                  >
                    <Save size={14} /> Save Output as Gap Note
                  </button>
                </div>
              </>
            ) : (
              <EmptyPanel
                title="No Analysis Run Yet"
                description="Select a feature and submit the form above to generate evidence-grounded research synthesis."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   3. DOCUMENTS & EXPORTS PAGE
============================================================= */
export function DocumentsPage({
  projects,
  projectId,
  onProjectChange,
}: {
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
}) {
  const [documents, setDocuments] = useState<ResearchDocument[]>([]);
  const [selected, setSelected] = useState<ResearchDocument | null>(null);
  const [title, setTitle] = useState('ResearchForge Project Report');
  const [sections, setSections] = useState<DocumentSection[]>(DOCUMENT_SECTIONS.map((item) => item.key));
  const [includeAi, setIncludeAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);

  // In-app HTML view modal state
  const [htmlModalOpen, setHtmlModalOpen] = useState(false);

  async function refresh() {
    if (!projectId) {
      setDocuments([]);
      setSelected(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const docs = await getDocuments(projectId);
      setDocuments(docs);
      if (docs.length > 0 && !selected) {
        const full = await getDocument(projectId, docs[0].id);
        setSelected(full);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [projectId]);

  function toggleSection(section: DocumentSection) {
    setSections((old) =>
      old.includes(section) ? old.filter((k) => k !== section) : [...old, section]
    );
  }

  function selectAllSections() {
    setSections(DOCUMENT_SECTIONS.map((s) => s.key));
  }

  function clearAllSections() {
    setSections([]);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!title.trim()) {
      setError('Please enter a document report title.');
      return;
    }
    if (!sections.length) {
      setError('Select at least one section to include in the report.');
      return;
    }
    setGenerating(true);
    try {
      const doc = await createDocument(projectId, title.trim(), sections, includeAi);
      setSelected(doc);
      setNotice('Research report generated and persisted.');
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function openDocument(doc: ResearchDocument) {
    setError('');
    setGenerating(true);
    try {
      const full = await getDocument(projectId, doc.id);
      setSelected(full);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleOpenHtmlView() {
    if (!selected) return;
    setError('');
    try {
      await openDocumentView(projectId, selected.id);
    } catch (err) {
      // Fallback: open in modal if popup is blocked
      setHtmlModalOpen(true);
    }
  }

  async function exportDocument(format: 'pdf' | 'docx') {
    if (!selected) return;
    setError('');
    setNotice('');
    setExportingFormat(format);
    try {
      await downloadDocument(projectId, selected.id, format);
      setNotice(`${format.toUpperCase()} export downloaded successfully.`);
    } catch (err) {
      const msg = errorMessage(err);
      if (format === 'pdf' && msg.includes('WeasyPrint')) {
        setError('PDF renderer is unavailable in this environment (platform libraries missing). You can export DOCX or use the HTML View.');
      } else {
        setError(msg);
      }
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="page-stack workspace-page">
      <PageHeading
        eyebrow="PUBLISH & ARCHIVE"
        title="Documents & Reports"
        description="Compile saved research papers, matrices, gap notes, and citations into persisted reports with PDF, DOCX, and HTML exports."
        action={
          <button
            className="secondary-button"
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <ProjectPicker projects={projects} projectId={projectId} onChange={onProjectChange} />
      <InlineNotice error={error} notice={notice} />

      {!projectId ? (
        <EmptyPanel
          title="No Project Selected"
          description="Select a project workspace to compile its research into a structured report."
        />
      ) : (
        <div className="workspace-grid two-columns">
          {/* Generator Form & Saved List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section className="content-section workspace-card">
              <div className="workspace-card-title">
                <FileOutput size={20} />
                <div>
                  <h3>Generate New Report</h3>
                  <p>Reports are generated deterministically from your project database records.</p>
                </div>
              </div>

              <form className="workspace-form" onSubmit={generate}>
                <label className="workspace-field">
                  <span>Document Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={200}
                    placeholder="e.g. State of AI Safety Research"
                    required
                  />
                </label>

                <div className="workspace-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>Included Sections</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="text-button" onClick={selectAllSections}>
                        All
                      </button>
                      <button type="button" className="text-button" onClick={clearAllSections}>
                        Clear
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {DOCUMENT_SECTIONS.map((item) => (
                      <label className="workspace-check-row" key={item.key} style={{ padding: '8px 10px' }}>
                        <input
                          type="checkbox"
                          checked={sections.includes(item.key)}
                          onChange={() => toggleSection(item.key)}
                        />
                        <span style={{ fontSize: '12px' }}>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="workspace-check-row" style={{ marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    checked={includeAi}
                    onChange={(event) => setIncludeAi(event.target.checked)}
                  />
                  <span>
                    <strong>Include Saved AI Insights</strong>
                    <small>Only previously generated and persisted AI results will be included.</small>
                  </span>
                </label>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={generating || !sections.length}
                >
                  {generating ? <LoaderCircle size={16} className="spin" /> : <FileOutput size={16} />}
                  {generating ? 'Compiling Report…' : 'Generate Report'}
                </button>
              </form>
            </section>

            {/* Saved Reports List */}
            <section className="content-section workspace-card">
              <div className="section-heading">
                <div>
                  <h3>
                    Saved Reports <span className="workspace-pill">{documents.length}</span>
                  </h3>
                  <p>Previously compiled reports stored for this project.</p>
                </div>
              </div>

              {loading ? (
                <Busy label="Loading saved documents…" />
              ) : documents.length ? (
                <div className="workspace-record-list">
                  {documents.map((doc) => (
                    <div
                      className="workspace-record"
                      key={doc.id}
                      style={{
                        cursor: 'pointer',
                        borderColor: selected?.id === doc.id ? '#6366f1' : 'var(--border-default)',
                        background: selected?.id === doc.id ? '#f5f3ff' : '#ffffff',
                      }}
                      onClick={() => void openDocument(doc)}
                    >
                      <FileText size={20} style={{ color: selected?.id === doc.id ? '#6366f1' : '#94a3b8' }} />
                      <div className="workspace-record-main">
                        <strong>{doc.title}</strong>
                        <small>{dateLabel(doc.created_at)} · {doc.sections.length} sections</small>
                      </div>
                      <ChevronDown size={16} style={{ color: '#94a3b8' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="No reports compiled yet"
                  description="Use the generator above to compile your first project document."
                />
              )}
            </section>
          </div>

          {/* Document Preview Pane */}
          <section className="content-section workspace-card">
            <div className="workspace-card-title">
              <FileText size={20} />
              <div>
                <h3>Report Preview</h3>
                <p>{selected ? selected.title : 'Select a saved report to preview its contents and exports.'}</p>
              </div>
            </div>

            {generating && !selected ? (
              <Busy label="Compiling report preview…" />
            ) : selected?.content ? (
              <>
                <div className="document-preview-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void handleOpenHtmlView()}
                  >
                    <ExternalLink size={14} /> Open HTML View
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void exportDocument('pdf')}
                    disabled={exportingFormat === 'pdf'}
                  >
                    {exportingFormat === 'pdf' ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <ArrowDownToLine size={14} />
                    )}
                    {exportingFormat === 'pdf' ? 'Exporting…' : 'Export PDF'}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void exportDocument('docx')}
                    disabled={exportingFormat === 'docx'}
                  >
                    {exportingFormat === 'docx' ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <ArrowDownToLine size={14} />
                    )}
                    {exportingFormat === 'docx' ? 'Exporting…' : 'Export DOCX'}
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: '700px',
                    overflowY: 'auto',
                    padding: '16px',
                    border: '1px solid var(--border-default)',
                    borderRadius: '14px',
                    background: '#ffffff',
                  }}
                >
                  <div className="document-cover">
                    <span>RESEARCHFORGE OFFICIAL REPORT</span>
                    <h2>{selected.content.title}</h2>
                    <p>Workspace: {selected.content.project_name}</p>
                    <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                      Compiled {selected.content.created_at}
                    </small>
                  </div>

                  {selected.content.sections.map((section) => (
                    <article
                      key={section.key}
                      style={{
                        paddingBottom: '20px',
                        marginBottom: '20px',
                        borderBottom: '1px solid var(--border-light)',
                      }}
                    >
                      <h4 style={{ fontSize: '15px', color: '#1e293b', margin: '0 0 10px' }}>
                        {section.title}
                      </h4>

                      {section.text && (
                        <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#475569', margin: '0 0 10px' }}>
                          {section.text}
                        </p>
                      )}

                      {section.kind === 'table' && section.headers && section.rows ? (
                        <div className="workspace-table-scroll">
                          <table className="workspace-table">
                            <thead>
                              <tr>
                                {section.headers.map((header) => (
                                  <th key={header}>{header}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.rows.map((row, idx) => (
                                <tr key={`${section.key}-${idx}`}>
                                  {row.map((cell, cellIdx) => (
                                    <td key={`${cellIdx}-${cell}`}>{cell || '—'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {section.items?.length ? (
                        <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: '#475569' }}>
                          {section.items.map((item, idx) => (
                            <li key={`${section.key}-${idx}`} style={{ marginBottom: '6px' }}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : !section.text && section.kind !== 'table' ? (
                        <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                          No records recorded in this section yet.
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <EmptyPanel
                title="Select a Report"
                description="Choose a report from the list on the left to preview its content and exports."
              />
            )}
          </section>
        </div>
      )}

      {/* In-app HTML view fallback modal */}
      {htmlModalOpen && selected && (
        <div className="modal-backdrop" onClick={() => setHtmlModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 800px)' }}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">DOCUMENT PREVIEW</span>
                <h2>{selected.title}</h2>
                <p>Rendered HTML output for this report.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setHtmlModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                {JSON.stringify(selected.content, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   4. TEAM PAGE
============================================================= */
export function TeamPage({
  projects,
  projectId,
  onProjectChange,
  onRefreshProjects,
}: {
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
  onRefreshProjects: () => Promise<void>;
}) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function refresh() {
    if (!projectId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [people, me] = await Promise.all([getProjectMembers(projectId), getCurrentUser()]);
      setMembers(people);
      setCurrentUser(me);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [projectId]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setError('Enter the registered email of the user to invite.');
      return;
    }
    setBusy(true);
    try {
      const added = await addProjectMember(projectId, targetEmail);
      setEmail('');
      setNotice(`Added ${added.display_name} to this project workspace.`);
      await refresh();
      await onRefreshProjects();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function executeLeave() {
    if (!currentUser) return;
    setConfirmLeave(false);
    setError('');
    setBusy(true);
    try {
      await leaveProject(projectId, currentUser.id);
      setNotice('You left the project workspace.');
      await onRefreshProjects();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack workspace-page">
      <PageHeading
        eyebrow="COLLABORATION"
        title="Project Members"
        description="Invite registered researchers to collaborate in this project workspace."
      />

      <ProjectPicker projects={projects} projectId={projectId} onChange={onProjectChange} />
      <InlineNotice error={error} notice={notice} />

      {!projectId ? (
        <EmptyPanel
          title="No Project Selected"
          description="Select a project workspace to manage members."
        />
      ) : (
        <div className="workspace-grid two-columns">
          {/* Invite Collaborator Card */}
          <section className="content-section workspace-card">
            <div className="workspace-card-title">
              <UserPlus size={20} />
              <div>
                <h3>Invite Researcher</h3>
                <p>Invite an existing ResearchForge user by their registered email address.</p>
              </div>
            </div>

            <form className="workspace-form" onSubmit={invite}>
              <label className="workspace-field">
                <span>Account Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="colleague@university.edu"
                  required
                />
              </label>

              <button type="submit" className="primary-button" disabled={busy || !email.trim()}>
                <UserPlus size={16} />
                {busy ? 'Adding…' : 'Add Member'}
              </button>
            </form>

            <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.5', marginTop: '16px' }}>
              Note: The invitee must already have registered an account on ResearchForge. All workspace members currently share equal read and write permissions.
            </p>
          </section>

          {/* Members List */}
          <section className="content-section workspace-card">
            <div className="section-heading">
              <div>
                <h3>
                  Workspace Members <span className="workspace-pill">{members.length}</span>
                </h3>
                <p>Researchers with access to this project.</p>
              </div>
              <button
                className="icon-button"
                type="button"
                title="Refresh members"
                onClick={() => void refresh()}
                disabled={loading}
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {loading ? (
              <Busy label="Loading project members…" />
            ) : members.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {members.map((member) => {
                  const initials = member.display_name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase();
                  const isYou = member.id === currentUser?.id;

                  return (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 14px',
                        background: '#ffffff',
                        border: '1px solid var(--border-default)',
                        borderRadius: '12px',
                      }}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                          color: '#6d28d9',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: '12px',
                        }}
                      >
                        {initials}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>
                          {member.display_name} {isYou && <span style={{ color: '#6366f1', fontWeight: 600 }}>(You)</span>}
                        </strong>
                        <small style={{ fontSize: '11px', color: '#64748b' }}>{member.email}</small>
                      </div>

                      {isYou && (
                        <span className="workspace-pill" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                          Current User
                        </span>
                      )}
                    </div>
                  );
                })}

                {currentUser && members.some((m) => m.id === currentUser.id) && members.length > 1 && (
                  <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-light)', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="secondary-button danger-button"
                      onClick={() => setConfirmLeave(true)}
                      disabled={busy}
                    >
                      <Users size={14} /> Leave this Project
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyPanel
                title="No members found"
                description="Refresh this project or switch workspaces."
              />
            )}
          </section>
        </div>
      )}

      {/* Confirmation modal for leaving project */}
      {confirmLeave && (
        <div className="modal-backdrop" onClick={() => setConfirmLeave(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow" style={{ color: '#ef4444' }}>CONFIRM DEPARTURE</span>
                <h2>Leave this Project?</h2>
                <p>You will immediately lose access to this workspace unless re-invited by another member.</p>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmLeave(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button danger-button"
                onClick={() => void executeLeave()}
              >
                Leave Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   5. SETTINGS PAGE
============================================================= */
export function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [me, plan] = await Promise.all([getCurrentUser(), getSubscription()]);
      setUser(me);
      setSubscription(plan);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function activate() {
    setActivating(true);
    setError('');
    setNotice('');
    try {
      const plan = await activateDevPremium();
      setSubscription(plan);
      setNotice('Development Premium plan activated successfully.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActivating(false);
    }
  }

  const initials = user?.display_name
    ? user.display_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : 'RF';

  return (
    <div className="page-stack workspace-page">
      <PageHeading
        eyebrow="ACCOUNT & ENTITLEMENT"
        title="Settings & Subscription"
        description="Manage your account profile, check subscription entitlements, and test development features."
        action={
          <button
            className="secondary-button"
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <InlineNotice error={error} notice={notice} />

      {loading ? (
        <Busy label="Loading account settings…" />
      ) : (
        <div className="workspace-grid two-columns">
          {/* User Account Card */}
          <section className="content-section workspace-card">
            <div className="workspace-card-title">
              <Users size={20} />
              <div>
                <h3>Account Profile</h3>
                <p>Authenticated researcher identity returned by the backend.</p>
              </div>
            </div>

            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #ede9fe, #c4b5fd)',
                    color: '#5b21b6',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: '18px',
                  }}
                >
                  {initials}
                </div>

                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: '#0f172a' }}>
                    {user.display_name}
                  </h4>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b' }}>{user.email}</p>
                  <small style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {user.id}</small>
                </div>
              </div>
            )}

            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
              <button className="secondary-button danger-button" type="button" onClick={onLogout}>
                Sign Out
              </button>
            </div>
          </section>

          {/* Subscription & Entitlement */}
          <section className="content-section workspace-card">
            <div className="workspace-card-title">
              <CreditCard size={20} />
              <div>
                <h3>Subscription Entitlement</h3>
                <p>Server-enforced plan checking for Premium research capabilities.</p>
              </div>
            </div>

            {subscription ? (
              <div>
                <div
                  style={{
                    padding: '20px',
                    borderRadius: '14px',
                    background: subscription.premium ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : '#f8fafc',
                    border: `1px solid ${subscription.premium ? '#a7f3d0' : 'var(--border-default)'}`,
                    marginBottom: '16px',
                  }}
                >
                  <span
                    className={`workspace-pill ${subscription.premium ? 'pill-success' : ''}`}
                    style={{ marginBottom: '8px' }}
                  >
                    {subscription.premium ? '✨ Premium Active' : 'Free Plan'}
                  </span>

                  <h4 style={{ margin: '8px 0 4px', fontSize: '20px', color: subscription.premium ? '#065f46' : '#0f172a' }}>
                    {subscription.plan}
                  </h4>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748b' }}>
                    Status: <strong style={{ textTransform: 'capitalize' }}>{subscription.status}</strong>
                  </p>
                  <small style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Started: {dateLabel(subscription.started_at)}
                    {subscription.expires_at ? ` · Expires: ${dateLabel(subscription.expires_at)}` : ' · No expiry limit'}
                  </small>
                </div>

                {!subscription.premium && (
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}>
                      Local Development Test Activation
                    </strong>
                    <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 12px' }}>
                      In development mode, you can instantly activate test Premium without any payment processing.
                    </p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void activate()}
                      disabled={activating}
                    >
                      {activating ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                      {activating ? 'Activating…' : 'Activate Dev Premium'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyPanel
                title="Subscription Record Unavailable"
                description="Unable to load current billing subscription."
              />
            )}
          </section>
        </div>
      )}

      {/* Architecture & Security Notice */}
      <section className="content-section workspace-card">
        <div className="workspace-card-title">
          <ShieldCheck size={20} />
          <div>
            <h3>Security & Boundary Architecture</h3>
            <p>
              ResearchForge strictly enforces scoped project permissions via bearer tokens, and guarantees that AI inference is never executed on static reads, paper extraction, or document compilation. All AI features are explicit POST actions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


// ---------------------------------------------------------------------------
// AnalyticsPage — quantitative research portfolio analytics
// Treats papers as financial "assets" and surfaces signal-processing metrics:
//   • Publication time-series with rolling-window momentum
//   • Pairwise cosine-similarity matrix (portfolio correlation)
//   • Composite portfolio health score with buy/hold/rebalance signal
// ---------------------------------------------------------------------------

export function AnalyticsPage({
  projects,
  projectId,
  onProjectChange,
}: {
  projects: Project[];
  projectId: string | null;
  onProjectChange: (id: string) => void;
}) {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) { setReport(null); return; }
    setLoading(true); setError(null);
    getAnalytics(projectId)
      .then(setReport)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [projectId]);

  const signalColor = (sig: string) => {
    if (sig === 'STRONG_BUY') return 'text-emerald-400';
    if (sig === 'HOLD') return 'text-amber-400';
    if (sig === 'REBALANCE') return 'text-rose-400';
    return 'text-slate-400';
  };

  const signalBg = (sig: string) => {
    if (sig === 'STRONG_BUY') return 'status-extracted';
    if (sig === 'HOLD') return 'status-pending';
    if (sig === 'REBALANCE') return 'status-failed';
    return 'status-pending';
  };

  const maxCount = report
    ? Math.max(...report.timeline.map((t) => t.count), 1)
    : 1;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Research Analytics</h1>
          <p className="page-subtitle">
            Quantitative portfolio analysis · publication momentum · paper similarity matrix
          </p>
        </div>
        <ProjectPicker
          projects={projects}
          projectId={projectId || ''}
          onChange={onProjectChange}
        />
      </div>

      {!projectId && (
        <EmptyPanel
          title="Select a workspace"
          description="Choose a project to view its quantitative analytics report."
        />
      )}

      {projectId && loading && <Busy label="Computing analytics…" />}
      {projectId && error && (
        <InlineNotice error={error} />
      )}

      {report && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Portfolio Signal Card ─────────────────────────────────────── */}
          <section className="workspace-card content-section">
            <div className="workspace-card-title">
              <TrendingUp size={20} />
              <div>
                <h3>Portfolio Signal</h3>
                <p>Composite health score based on coverage, diversity, and recency</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              {/* Signal badge */}
              <div className="workspace-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signal</div>
                <span className={`status-badge ${signalBg(report.portfolio.signal)}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                  {report.portfolio.signal.replace('_', ' ')}
                </span>
              </div>

              {/* Composite score */}
              <div className="workspace-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Composite Score</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{report.portfolio.composite_score}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>/ 100</div>
              </div>

              {/* Coverage */}
              <div className="workspace-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Text Coverage</div>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{(report.portfolio.coverage_score * 100).toFixed(0)}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>PDFs extracted</div>
              </div>

              {/* Diversity */}
              <div className="workspace-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diversity Score</div>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{(report.portfolio.diversity_score * 100).toFixed(0)}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>1 − avg similarity</div>
              </div>

              {/* Recency */}
              <div className="workspace-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recency Weight</div>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{(report.portfolio.recency_decay * 100).toFixed(0)}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>exp decay 5y half-life</div>
              </div>

              {/* Velocity */}
              <div className="workspace-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Velocity Signal</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: report.portfolio.velocity_signal > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                  {report.portfolio.velocity_signal > 0 ? '+' : ''}{report.portfolio.velocity_signal.toFixed(2)}σ
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>z-score vs rolling avg</div>
              </div>
            </div>

            <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
              {report.portfolio.rationale}
            </p>
          </section>

          {/* ── Publication Timeline ──────────────────────────────────────── */}
          {report.timeline.length > 0 && (
            <section className="workspace-card content-section">
              <div className="workspace-card-title">
                <BarChart2 size={20} />
                <div>
                  <h3>Publication Timeline</h3>
                  <p>Annual paper counts with {report.timeline.length >= 3 ? '3-year ' : ''}rolling-window momentum</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '140px', marginTop: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                {report.timeline.map((point) => {
                  const heightPct = (point.count / maxCount) * 100;
                  const rollingPct = point.rolling_avg != null ? (point.rolling_avg / maxCount) * 100 : null;
                  return (
                    <div key={point.period} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', position: 'relative' }}>
                      {/* Bar */}
                      <div
                        title={`${point.year}: ${point.count} papers`}
                        style={{
                          width: '100%',
                          height: `${heightPct}%`,
                          minHeight: '4px',
                          background: 'var(--accent)',
                          borderRadius: '3px 3px 0 0',
                          opacity: 0.85,
                          transition: 'opacity 0.15s',
                          cursor: 'default',
                        }}
                      />
                      {/* Rolling avg marker */}
                      {rollingPct != null && (
                        <div
                          title={`Rolling avg: ${point.rolling_avg.toFixed(1)}`}
                          style={{
                            position: 'absolute',
                            bottom: `${rollingPct}%`,
                            width: '100%',
                            height: '2px',
                            background: 'rgba(255,255,255,0.5)',
                            borderRadius: '1px',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', overflowX: 'auto' }}>
                {report.timeline.map((point) => (
                  <div key={point.period} style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {point.year}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /> Paper count
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 12, height: 2, background: 'rgba(255,255,255,0.5)', display: 'inline-block' }} /> Rolling average
                </span>
              </div>
            </section>
          )}

          {/* ── Similarity Matrix ─────────────────────────────────────────── */}
          {report.similarity.labels.length >= 2 && (
            <section className="workspace-card content-section">
              <div className="workspace-card-title">
                <GitCompare size={20} />
                <div>
                  <h3>Paper Similarity Matrix</h3>
                  <p>Cosine similarity between paper TF-IDF vectors — lower off-diagonal = more diverse portfolio</p>
                </div>
              </div>

              {report.similarity.insights.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0' }}>
                  {report.similarity.insights.map((insight, i) => (
                    <div key={i} style={{ padding: '0.625rem 0.875rem', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--muted)', borderLeft: '3px solid var(--accent)' }}>
                      {insight}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.25rem 0.5rem', color: 'var(--muted)', textAlign: 'left', fontWeight: 500 }}>Paper</th>
                      {report.similarity.labels.map((label, i) => (
                        <th key={i} style={{ padding: '0.25rem 0.5rem', color: 'var(--muted)', textAlign: 'center', fontWeight: 500, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          P{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.similarity.matrix.map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: '0.25rem 0.5rem', color: 'var(--text)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={report.similarity.labels[i]}>
                          P{i + 1}: {report.similarity.labels[i]}
                        </td>
                        {row.map((val, j) => {
                          const isDiag = i === j;
                          const intensity = isDiag ? 1 : Math.min(val, 1);
                          const bg = isDiag
                            ? 'rgba(99,102,241,0.3)'
                            : `rgba(99,102,241,${(intensity * 0.6).toFixed(2)})`;
                          return (
                            <td key={j} title={`${val.toFixed(3)}`} style={{ padding: '0.25rem 0.5rem', textAlign: 'center', background: bg, borderRadius: '3px', color: isDiag ? 'var(--muted)' : intensity > 0.5 ? 'var(--text)' : 'var(--muted)' }}>
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                Values near 1.0 indicate highly similar papers (potential redundancy). Values near 0 indicate orthogonal topics (high diversity).
              </p>
            </section>
          )}

          {/* ── Stats Summary ─────────────────────────────────────────────── */}
          <section className="workspace-card content-section">
            <div className="workspace-card-title">
              <Search size={20} />
              <div>
                <h3>Descriptive Statistics</h3>
                <p>Year distribution and portfolio composition summary</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Paper count</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{report.portfolio.paper_count}</div>
              </div>
              <div style={{ padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Mean pub year</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{report.portfolio.mean_publication_year.toFixed(0)}</div>
              </div>
              <div style={{ padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Year std dev</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>σ {report.portfolio.publication_year_std.toFixed(1)}</div>
              </div>
              <div style={{ padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>NumPy active</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{report.portfolio.numpy_available ? '✓' : '✗'}</div>
              </div>
            </div>
          </section>

        </div>
      )}

      {report && report.portfolio.paper_count === 0 && !loading && (
        <EmptyPanel
          title="No papers yet"
          description="Import papers into your library to generate quantitative analytics."
        />
      )}
    </div>
  );
}
