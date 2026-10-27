/** Typed client for the complete ResearchForge API. */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api/v1';
const TOKEN_KEY = 'researchforge_token';

type ApiErrorResponse = {
  detail?: string | { message?: string; code?: string } | Array<{ msg?: string; loc?: unknown[] }>;
};

function readError(body: ApiErrorResponse | null, status: number): string {
  if (typeof body?.detail === 'string') return body.detail;
  if (body?.detail && !Array.isArray(body.detail) && typeof body.detail === 'object') {
    return body.detail.message || body.detail.code || `Request failed (${status})`;
  }
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item) => item.msg ?? 'Invalid input').join('; ');
  }
  return `Request failed (${status})`;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    if (response.status === 401 && !['/auth/login', '/auth/login/oauth', '/auth/register'].includes(path)) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('researchforge:unauthorized'));
    }
    throw new Error(readError(body, response.status));
  }
  if (response.status === 204) return undefined as T;
  if (response.status === 205) return undefined as T;
  return (await response.json()) as T;
}

export type AuthResponse = { access_token: string; token_type: string };
export type User = { id: string; email: string; display_name: string };
export type Project = {
  id: string; name: string; description: string; members?: number;
  created_at?: string; updated_at?: string;
};

export function register(email: string, password: string, display_name: string): Promise<User> {
  return apiRequest<User>('/auth/register', { method: 'POST', body: JSON.stringify({
    email: email.trim().toLowerCase(), password, display_name: display_name.trim(),
  }) });
}
export function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({
    email: email.trim().toLowerCase(), password,
  }) });
}
/** OAuth2 form-compatible login contract for clients that need it. */
export function loginOAuth(email: string, password: string): Promise<AuthResponse> {
  const form = new URLSearchParams({ username: email.trim().toLowerCase(), password });
  return apiRequest<AuthResponse>('/auth/login/oauth', {
    method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}
export function getCurrentUser(): Promise<User> { return apiRequest<User>('/auth/me'); }
export function logout(): void { localStorage.removeItem(TOKEN_KEY); }

export function getProjects(): Promise<Project[]> { return apiRequest<Project[]>('/projects'); }
export function getProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${encodeURIComponent(projectId)}`);
}
export function createProject(name: string, description: string): Promise<Project> {
  return apiRequest<Project>('/projects', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim() }) });
}
export function updateProject(projectId: string, name: string, description: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH', body: JSON.stringify({ name: name.trim(), description: description.trim() }),
  });
}
export function deleteProject(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
}
export type AuthResponseWithRefresh = AuthResponse & { refresh_token?: string };
export function loginWithRefresh(email: string, password: string): Promise<AuthResponseWithRefresh> {
  return apiRequest<AuthResponseWithRefresh>('/auth/login', { method: 'POST', body: JSON.stringify({
    email: email.trim().toLowerCase(), password,
  }) });
}
export function refreshAccessToken(refresh_token: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token }) });
}
export function logoutWithToken(refresh_token: string): Promise<{ ok: boolean }> {
  return apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token }) });
}

export type ProjectMember = User & { role?: 'OWNER' | 'EDITOR' | 'VIEWER' };
export function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return apiRequest<ProjectMember[]>(`/projects/${encodeURIComponent(projectId)}/members`);
}
export function addProjectMember(projectId: string, email: string): Promise<ProjectMember> {
  return apiRequest<ProjectMember>(`/projects/${encodeURIComponent(projectId)}/members`, {
    method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}
export function leaveProject(projectId: string, userId: string): Promise<void> {
  return apiRequest<void>(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export type DiscoveryPaper = {
  source: string; source_id: string; title: string; authors: string[]; year: number | null;
  venue: string | null; citation_count: number | null; abstract: string; doi: string | null;
  pdf_url: string | null; landing_url: string | null;
};
export type DiscoveryResponse = { query: string; results: DiscoveryPaper[]; warnings: string[] };
export type DiscoverySource = 'arxiv' | 'semantic_scholar';
export function searchPapers(query: string, sources: DiscoverySource[] = ['arxiv', 'semantic_scholar'], limit = 10): Promise<DiscoveryResponse> {
  return apiRequest<DiscoveryResponse>('/discovery/search', { method: 'POST', body: JSON.stringify({ query: query.trim(), sources, limit }) });
}

export type LibraryPaper = {
  id: string; project_id: string; source: string; source_id: string; title: string; authors: string[];
  year: number | null; abstract: string; doi: string | null; landing_url: string | null; pdf_path: string | null;
  extraction_status: string; page_count: number | null; extracted_at: string | null;
};
export type ImportPaperInput = {
  source: string; source_id: string; title: string; authors: string[]; year: number | null;
  abstract: string; doi: string | null; landing_url: string | null;
};
export type ExtractionResult = {
  paper_id: string; title: string; extraction_status: string; page_count: number;
  character_count: number; text: string; extracted_at?: string | null;
};
export function getLibrary(projectId: string): Promise<LibraryPaper[]> {
  return apiRequest<LibraryPaper[]>(`/projects/${encodeURIComponent(projectId)}/library`);
}
export function importPaper(projectId: string, paper: DiscoveryPaper): Promise<LibraryPaper> {
  const landingUrl = paper.landing_url && /^https?:\/\//i.test(paper.landing_url.trim()) ? paper.landing_url.trim() : null;
  const body: ImportPaperInput = {
    source: paper.source,
    source_id: paper.source_id,
    title: paper.title,
    authors: paper.authors ?? [],
    year: paper.year,
    abstract: paper.abstract ?? '',
    doi: paper.doi?.trim() || null,
    landing_url: landingUrl,
  };
  return apiRequest<LibraryPaper>(`/projects/${encodeURIComponent(projectId)}/library/import`, {
    method: 'POST', body: JSON.stringify(body),
  });
}
export function uploadPdf(projectId: string, file: File): Promise<LibraryPaper> {
  const form = new FormData(); form.append('file', file);
  return apiRequest<LibraryPaper>(`/projects/${encodeURIComponent(projectId)}/library/upload`, { method: 'POST', body: form });
}
export function extractPaper(projectId: string, paperId: string): Promise<ExtractionResult> {
  return apiRequest<ExtractionResult>(`/projects/${encodeURIComponent(projectId)}/library/${encodeURIComponent(paperId)}/extract`, { method: 'POST' });
}
export function getExtractedText(projectId: string, paperId: string): Promise<ExtractionResult> {
  return apiRequest<ExtractionResult>(`/projects/${encodeURIComponent(projectId)}/library/${encodeURIComponent(paperId)}/extraction`);
}

export type Comparison = { id: string; project_id: string; title: string; paper_ids: string[]; created_at: string };
export type ComparisonMatrix = {
  id: string; project_id: string; title: string; papers: { id: string; title: string }[];
  matrix: { field: string; values: { paper_id: string; value: unknown }[] }[]; note: string;
};
export type ResearchGap = {
  id: string; project_id: string; comparison_id: string | null; note: string;
  status: 'OPEN' | 'ADDRESSED'; origin: string; created_by: string; created_at: string;
};
export function getComparisons(projectId: string): Promise<Comparison[]> {
  return apiRequest<Comparison[]>(`/projects/${encodeURIComponent(projectId)}/comparisons`);
}
export function createComparison(projectId: string, title: string, paper_ids: string[]): Promise<Comparison> {
  return apiRequest<Comparison>(`/projects/${encodeURIComponent(projectId)}/comparisons`, { method: 'POST', body: JSON.stringify({ title, paper_ids }) });
}
export function getComparisonMatrix(projectId: string, comparisonId: string): Promise<ComparisonMatrix> {
  return apiRequest<ComparisonMatrix>(`/projects/${encodeURIComponent(projectId)}/comparisons/${encodeURIComponent(comparisonId)}`);
}
export function deleteComparison(projectId: string, comparisonId: string): Promise<void> {
  return apiRequest<void>(`/projects/${encodeURIComponent(projectId)}/comparisons/${encodeURIComponent(comparisonId)}`, { method: 'DELETE' });
}
export function getGaps(projectId: string, status?: 'OPEN' | 'ADDRESSED'): Promise<ResearchGap[]> {
  const query = status ? `?status=${status}` : '';
  return apiRequest<ResearchGap[]>(`/projects/${encodeURIComponent(projectId)}/gaps${query}`);
}
export function createGap(projectId: string, note: string, comparison_id?: string): Promise<ResearchGap> {
  return apiRequest<ResearchGap>(`/projects/${encodeURIComponent(projectId)}/gaps`, { method: 'POST', body: JSON.stringify({ note, comparison_id: comparison_id || null }) });
}
export function updateGap(projectId: string, gapId: string, changes: { note?: string; status?: 'OPEN' | 'ADDRESSED' }): Promise<ResearchGap> {
  return apiRequest<ResearchGap>(`/projects/${encodeURIComponent(projectId)}/gaps/${encodeURIComponent(gapId)}`, { method: 'PATCH', body: JSON.stringify(changes) });
}
export function deleteGap(projectId: string, gapId: string): Promise<void> {
  return apiRequest<void>(`/projects/${encodeURIComponent(projectId)}/gaps/${encodeURIComponent(gapId)}`, { method: 'DELETE' });
}

export type AIResult = {
  id?: string; feature?: string; provider?: string; model?: string; result?: Record<string, unknown>;
  reasoning?: string; evidence?: { paper_id: string; title: string; excerpt: string }[];
  disclaimer?: string; created_at?: string; answer?: string;
};
export type AISummary = {
  paper_id: string; title: string; provider: string; model: string; summary: string;
  source_text_characters: number; source_text_truncated: boolean; disclaimer: string;
};
const aiPath = (projectId: string, suffix: string) => `/projects/${encodeURIComponent(projectId)}/ai/${suffix}`;
export function summarizePaper(projectId: string, paperId: string): Promise<AISummary> {
  return apiRequest<AISummary>(aiPath(projectId, `papers/${encodeURIComponent(paperId)}/summary`), { method: 'POST' });
}
export function identifyAIGaps(projectId: string, paper_ids: string[]): Promise<AIResult> {
  return apiRequest<AIResult>(aiPath(projectId, 'gaps'), { method: 'POST', body: JSON.stringify({ paper_ids }) });
}
export function saveAIGaps(projectId: string, result_id: string, gap_indexes: number[]): Promise<{ saved_count: number; gap_ids: string[] }> {
  return apiRequest(aiPath(projectId, 'gaps/save'), { method: 'POST', body: JSON.stringify({ result_id, gap_indexes }) });
}
export function aiCompare(projectId: string, paper_ids: string[]): Promise<AIResult> {
  return apiRequest<AIResult>(aiPath(projectId, 'compare'), { method: 'POST', body: JSON.stringify({ paper_ids }) });
}
export function getRecommendations(projectId: string, paper_ids: string[] = []): Promise<AIResult> {
  return apiRequest<AIResult>(aiPath(projectId, 'recommendations'), { method: 'POST', body: JSON.stringify({ paper_ids }) });
}
export function analyzeCitations(projectId: string, paper_ids: string[]): Promise<AIResult> {
  return apiRequest<AIResult>(aiPath(projectId, 'citations'), { method: 'POST', body: JSON.stringify({ paper_ids }) });
}
export function askPapers(projectId: string, question: string, paper_ids: string[] = []): Promise<AIResult> {
  return apiRequest<AIResult>(aiPath(projectId, 'qa'), { method: 'POST', body: JSON.stringify({ question, paper_ids }) });
}

export type Subscription = { plan: string; status: string; premium: boolean; started_at: string; expires_at: string | null };
export function getSubscription(): Promise<Subscription> { return apiRequest<Subscription>('/billing/subscription'); }
export function activateDevPremium(): Promise<Subscription> {
  return apiRequest<Subscription>('/billing/dev/activate-premium', { method: 'POST' });
}

export const DOCUMENT_SECTIONS = [
  { key: 'overview', label: 'Project overview' }, { key: 'literature', label: 'Literature table' },
  { key: 'summaries', label: 'Publication summaries' }, { key: 'comparisons', label: 'Methodology comparisons' },
  { key: 'gaps', label: 'Research gaps' }, { key: 'ai_insights', label: 'AI insights' },
  { key: 'references', label: 'References' },
] as const;
export type DocumentSection = typeof DOCUMENT_SECTIONS[number]['key'];
export type DocumentSectionContent = {
  key: DocumentSection; title: string; kind: string; items: string[]; text: string;
  headers?: string[]; rows?: string[][];
};
export type ResearchDocument = {
  id: string; project_id: string; title: string; sections: DocumentSection[];
  include_ai: boolean; created_at: string;
  content?: { title: string; project_name: string; created_at: string; sections: DocumentSectionContent[] };
};
export function getDocuments(projectId: string): Promise<ResearchDocument[]> {
  return apiRequest<ResearchDocument[]>(`/projects/${encodeURIComponent(projectId)}/documents`);
}
export function getDocument(projectId: string, documentId: string): Promise<ResearchDocument> {
  return apiRequest<ResearchDocument>(`/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`);
}
export function createDocument(projectId: string, title: string, sections: DocumentSection[], include_ai: boolean): Promise<ResearchDocument> {
  return apiRequest<ResearchDocument>(`/projects/${encodeURIComponent(projectId)}/documents`, { method: 'POST', body: JSON.stringify({ title, sections, include_ai }) });
}
export async function openDocumentView(projectId: string, documentId: string): Promise<void> {
  // Open the new tab synchronously from the click handler to avoid popup blockers,
  // then load the authenticated HTML response into it.
  const view = window.open('about:blank', '_blank');
  if (!view) throw new Error('Allow pop-ups for this site to open the HTML document view.');
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = new Headers({ Accept: 'text/html' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/view`, { headers });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      throw new Error(readError(body, response.status));
    }
    const html = await response.text();
    const objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    view.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    view.close();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Quantitative Analytics API
// ---------------------------------------------------------------------------

export type TimelinePoint = {
  period: string; year: number; count: number; rolling_avg: number;
};
export type SimilarityMatrix = {
  labels: string[]; matrix: number[][]; insights: string[];
};
export type PortfolioMetrics = {
  paper_count: number;
  coverage_score: number;
  diversity_score: number;
  recency_decay: number;
  mean_publication_year: number;
  publication_year_std: number;
  velocity_signal: number;
  composite_score: number;
  signal: 'STRONG_BUY' | 'HOLD' | 'REBALANCE' | 'NO_DATA';
  rationale: string;
  numpy_available: boolean;
};
export type AnalyticsReport = {
  project_id: string;
  timeline: TimelinePoint[];
  similarity: SimilarityMatrix;
  portfolio: PortfolioMetrics;
};

export function getAnalytics(projectId: string): Promise<AnalyticsReport> {
  return apiRequest<AnalyticsReport>(`/projects/${encodeURIComponent(projectId)}/analytics`);
}
export function getTimeline(projectId: string): Promise<TimelinePoint[]> {
  return apiRequest<TimelinePoint[]>(`/projects/${encodeURIComponent(projectId)}/analytics/timeline`);
}
export function getPortfolioMetrics(projectId: string): Promise<PortfolioMetrics> {
  return apiRequest<PortfolioMetrics>(`/projects/${encodeURIComponent(projectId)}/analytics/portfolio`);
}

export async function downloadDocument(projectId: string, documentId: string, format: 'pdf' | 'docx'): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers({ Accept: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/export.${format}`, { headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(readError(body, response.status));
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `researchforge-document.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
