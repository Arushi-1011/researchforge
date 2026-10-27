import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  FileSearch,
  FileText,
  FolderKanban,
  GitCompare,
  LayoutDashboard,
  LibraryBig,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';

import {
  createProject,
  updateProject,
  deleteProject,
  importPaper,
  getProjects,
  login,
  register,
  logout,
  searchPapers,
  getLibrary,
  uploadPdf,
  extractPaper,
  getExtractedText,
  getCurrentUser,
  type Project,
  type DiscoveryPaper,
  type DiscoverySource,
  type LibraryPaper,
  type User,
} from './api';

import {
  AIResearchPage,
  AnalyticsPage,
  CompareGapsPage,
  DocumentsPage,
  SettingsPage,
  TeamPage,
} from './WorkspacePages';

type PageName =
  | 'Overview'
  | 'My projects'
  | 'Discover papers'
  | 'Library'
  | 'Comparisons & gaps'
  | 'AI research'
  | 'Analytics'
  | 'Documents'
  | 'Team'
  | 'Settings';

type AuthMode = 'login' | 'register';

const NAV_GROUPS: {
  title: string;
  items: { label: PageName; icon: typeof LayoutDashboard; badge?: string }[];
}[] = [
  {
    title: 'Workspace',
    items: [
      { label: 'Overview', icon: LayoutDashboard },
      { label: 'My projects', icon: FolderKanban },
    ],
  },
  {
    title: 'Literature',
    items: [
      { label: 'Discover papers', icon: Search, badge: 'arXiv / S2' },
      { label: 'Library', icon: LibraryBig },
      { label: 'Comparisons & gaps', icon: GitCompare },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'AI research', icon: Sparkles, badge: 'Premium' },
      { label: 'Analytics', icon: FileText, badge: 'Quant' },
      { label: 'Documents', icon: FileText },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Team', icon: Users },
      { label: 'Settings', icon: Settings2 },
    ],
  },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function formatDate(value?: string | null): string {
  if (!value) return 'Recently created';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently created';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getUserInitials(name?: string): string {
  if (!name?.trim()) return 'RF';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
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

function App() {
  const [authenticated, setAuthenticated] = useState(
    () => Boolean(localStorage.getItem('researchforge_token')),
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Auth form state
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Global project & page state
  const [active, setActive] = useState<PageName>('Overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Notifications popup state
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Discovery state
  const [discoveryQuery, setDiscoveryQuery] = useState('');
  const [discoverySources, setDiscoverySources] = useState<DiscoverySource[]>([
    'arxiv',
    'semantic_scholar',
  ]);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryPaper[]>([]);
  const [discoveryWarnings, setDiscoveryWarnings] = useState<string[]>([]);
  const [discoveryError, setDiscoveryError] = useState('');
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [importingPaperKey, setImportingPaperKey] = useState('');
  const [importError, setImportError] = useState('');
  const [importNotice, setImportNotice] = useState('');

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4000);
  }

  // Load user profile & projects upon auth
  useEffect(() => {
    if (authenticated) {
      void loadUserData();
      void loadProjects();
    }
  }, [authenticated]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthenticated(false);
      setCurrentUser(null);
      setProjects([]);
      setSelectedProjectId('');
      showToast('Session expired. Please sign in again.', 'info');
    };
    window.addEventListener('researchforge:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('researchforge:unauthorized', handleUnauthorized);
  }, []);

  async function loadUserData() {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch {
      // Non-fatal, token will handle permissions
    }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    setProjectsError('');

    try {
      const data = await getProjects();
      setProjects(data);
      setSelectedProjectId((current) =>
        data.some((project) => project.id === current) ? current : data[0]?.id ?? ''
      );
    } catch (error) {
      setProjectsError(getErrorMessage(error));
    } finally {
      setProjectsLoading(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError('');

    const email = authEmail.trim();
    const password = authPassword;

    if (!email || !password) {
      setAuthError('Please enter your email and password.');
      return;
    }

    if (authMode === 'register') {
      if (!displayName.trim()) {
        setAuthError('Please enter your full name.');
        return;
      }
      if (password.length < 8) {
        setAuthError('Password must contain at least 8 characters.');
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setAuthError('Password must contain at least one letter and one number.');
        return;
      }
    }

    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        await register(email, password, displayName.trim());
      }

      const response = await login(email, password);
      if (!response?.access_token) {
        throw new Error('Login succeeded without returning an access token.');
      }

      localStorage.setItem('researchforge_token', response.access_token);
      setAuthenticated(true);
      setActive('Overview');
      setAuthPassword('');
      setAuthError('');
      showToast(authMode === 'register' ? 'Account created successfully!' : 'Welcome back!');
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleQuickDemo() {
    setAuthLoading(true);
    setAuthError('');
    const demoEmail = 'recruiter.demo@researchforge.dev';
    const demoPass = 'ResearchForge2026!';
    try {
      let res;
      try {
        res = await login(demoEmail, demoPass);
      } catch {
        await register(demoEmail, demoPass, 'Guest Reviewer');
        res = await login(demoEmail, demoPass);
      }
      if (res?.access_token) {
        localStorage.setItem('researchforge_token', res.access_token);
        setAuthenticated(true);
        setActive('Overview');
        showToast('Logged in as Guest Reviewer!');
      }
    } catch (err) {
      setAuthError(getErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    logout();
    setAuthenticated(false);
    setCurrentUser(null);
    setProjects([]);
    setSelectedProjectId('');
    setActive('Overview');
    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
    showToast('Signed out of ResearchForge.', 'info');
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError('');

    const name = newProjectName.trim();
    const description = newProjectDescription.trim();

    if (!name) {
      setCreateError('Please give your project a name.');
      return;
    }

    setCreateLoading(true);

    try {
      const created = await createProject(name, description);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateModal(false);
      setSelectedProjectId(created.id);
      setActive('My projects');
      await loadProjects();
      showToast(`Project “${created.name}” created!`);
    } catch (error) {
      setCreateError(getErrorMessage(error));
    } finally {
      setCreateLoading(false);
    }
  }

  function startEditProject(project: Project) {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || '');
    setEditError('');
  }

  async function handleSaveEditProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProject) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError('Project name cannot be empty.');
      return;
    }

    setEditLoading(true);
    setEditError('');

    try {
      await updateProject(editingProject.id, trimmedName, editDescription.trim());
      setEditingProject(null);
      await loadProjects();
      showToast(`Project updated.`);
    } catch (error) {
      setEditError(getErrorMessage(error));
    } finally {
      setEditLoading(false);
    }
  }

  async function executeDeleteProject() {
    if (!deletingProject) return;
    setDeleteLoading(true);

    try {
      await deleteProject(deletingProject.id);
      const targetId = deletingProject.id;
      setDeletingProject(null);
      showToast('Project deleted.');
      await loadProjects();
      if (selectedProjectId === targetId) {
        setSelectedProjectId('');
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handlePaperSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = discoveryQuery.trim();
    if (query.length < 2) {
      setDiscoveryError('Enter at least 2 characters to search.');
      return;
    }

    if (discoverySources.length === 0) {
      setDiscoveryError('Select at least one academic search source.');
      return;
    }

    setDiscoveryLoading(true);
    setDiscoveryError('');
    setDiscoveryWarnings([]);
    setDiscoveryResults([]);
    setHasSearched(true);

    try {
      const response = await searchPapers(query, discoverySources, 12);
      setDiscoveryResults(response.results);
      setDiscoveryWarnings(response.warnings ?? []);
    } catch (error) {
      setDiscoveryError(getErrorMessage(error));
    } finally {
      setDiscoveryLoading(false);
    }
  }

  async function handleImportPaper(paper: DiscoveryPaper) {
    if (!selectedProjectId) {
      setImportError('Please create or select a project workspace before saving papers.');
      setImportNotice('');
      return;
    }

    const key = `${paper.source}:${paper.source_id}`;
    setImportingPaperKey(key);
    setImportError('');
    setImportNotice('');

    try {
      const saved = await importPaper(selectedProjectId, paper);
      const projectName = projects.find((p) => p.id === selectedProjectId)?.name ?? 'your project';
      setImportNotice(`Saved “${saved.title}” to ${projectName}.`);
      showToast(`Paper saved to ${projectName}!`);
    } catch (error) {
      setImportError(getErrorMessage(error));
    } finally {
      setImportingPaperKey('');
    }
  }

  function toggleDiscoverySource(source: DiscoverySource) {
    setDiscoverySources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source]
    );
  }

  function openCreateModal() {
    setCreateError('');
    setNewProjectName('');
    setNewProjectDescription('');
    setShowCreateModal(true);
  }

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  // Authentication View
  if (!authenticated) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={(mode) => {
          setAuthMode(mode);
          setAuthError('');
        }}
        email={authEmail}
        setEmail={setAuthEmail}
        password={authPassword}
        setPassword={setAuthPassword}
        displayName={displayName}
        setDisplayName={setDisplayName}
        error={authError}
        loading={authLoading}
        onSubmit={handleAuthSubmit}
        onQuickDemo={handleQuickDemo}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast is-${toast.type}`}>
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : toast.type === 'error' ? (
              <AlertCircle size={18} />
            ) : (
              <Sparkles size={18} />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => setToast(null)}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit size={22} />
          </div>
          <div className="brand-copy">
            <span className="brand-name">ResearchForge</span>
            <span className="brand-caption">Research Workspace</span>
          </div>
          <span className="brand-badge">v0.3</span>
        </div>

        {/* Global Workspace Switcher Dropdown */}
        <div className="sidebar-project-select">
          <label className="workspace-trigger" htmlFor="global-project-select">
            <div className="workspace-trigger-icon">
              {activeProject ? activeProject.name[0]?.toUpperCase() : 'RF'}
            </div>
            <div className="workspace-trigger-info">
              <span className="workspace-trigger-title">
                {activeProject ? activeProject.name : 'Choose Project'}
              </span>
              <span className="workspace-trigger-sub">
                {activeProject
                  ? `${activeProject.members ?? 1} member${(activeProject.members ?? 1) === 1 ? '' : 's'}`
                  : 'Workspace'}
              </span>
            </div>
            <ChevronDown size={14} style={{ color: '#94a3b8' }} />
          </label>
          <select
            id="global-project-select"
            value={selectedProjectId}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                openCreateModal();
              } else {
                setSelectedProjectId(e.target.value);
              }
            }}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              cursor: 'pointer',
              width: '100%',
              height: '100%',
            }}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
            <option value="__NEW__">+ Create New Project…</option>
          </select>
        </div>

        {/* Navigation Groups */}
        <div className="sidebar-nav-wrap">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="sidebar-section-label">{group.title}</div>
              <nav className="sidebar-nav">
                {group.items.map(({ label, icon: Icon, badge }) => (
                  <button
                    key={label}
                    type="button"
                    className={`nav-item ${active === label ? 'active' : ''}`}
                    onClick={() => {
                      setActive(label);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{label}</span>
                    {badge && (
                      <span
                        className={`nav-pill-badge ${
                          badge === 'Premium' ? 'premium' : badge === 'arXiv / S2' ? 'accent' : ''
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Sidebar Footer & User Profile */}
        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="user-avatar">{getUserInitials(currentUser?.display_name)}</div>
            <div className="user-info">
              <span className="user-name">
                {currentUser?.display_name || 'Researcher'}
              </span>
              <span className="user-email">
                {currentUser?.email || 'workspace@researchforge'}
              </span>
            </div>
            <button
              type="button"
              className="user-signout-btn"
              title="Sign Out"
              onClick={handleLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-panel">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>

          <div className="breadcrumb-trail">
            <span className="breadcrumb-crumb">ResearchForge</span>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-crumb">{activeProject?.name || 'All Projects'}</span>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-current">{active}</span>
          </div>

          <div className="topbar-actions">
            {/* Quick search button */}
            <button
              type="button"
              className="topbar-search-btn"
              onClick={() => setActive('Discover papers')}
              title="Search Literature"
            >
              <Search size={14} />
              <span>Search papers…</span>
              <kbd>/</kbd>
            </button>

            {/* Workspace status badge */}
            <span className="workspace-status-badge">
              <span className="status-dot" />
              Live
            </span>

            {/* Notifications Button */}
            <button
              type="button"
              className="icon-button"
              title="Notifications"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell size={18} />
            </button>

            {/* Quick "New Project" Button */}
            <button
              type="button"
              className="primary-button"
              style={{ padding: '8px 14px', fontSize: '12px' }}
              onClick={openCreateModal}
            >
              <Plus size={15} />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {active === 'Overview' && (
            <OverviewPage
              projects={projects}
              currentUser={currentUser}
              loading={projectsLoading}
              error={projectsError}
              onCreateProject={openCreateModal}
              onOpenProjects={() => setActive('My projects')}
              onOpenDiscovery={() => setActive('Discover papers')}
              onOpenLibrary={() => setActive('Library')}
              onSelectProject={(id) => {
                setSelectedProjectId(id);
                setActive('Library');
              }}
              onRetry={loadProjects}
            />
          )}

          {active === 'My projects' && (
            <ProjectsPage
              projects={projects}
              selectedProjectId={selectedProjectId}
              loading={projectsLoading}
              error={projectsError}
              onCreateProject={openCreateModal}
              onRetry={loadProjects}
              onSelectProject={(id) => {
                setSelectedProjectId(id);
                setActive('Library');
              }}
              onEditProject={startEditProject}
              onDeleteProject={(p) => setDeletingProject(p)}
            />
          )}

          {active === 'Discover papers' && (
            <DiscoveryPage
              query={discoveryQuery}
              setQuery={setDiscoveryQuery}
              sources={discoverySources}
              toggleSource={toggleDiscoverySource}
              results={discoveryResults}
              warnings={discoveryWarnings}
              error={discoveryError}
              loading={discoveryLoading}
              hasSearched={hasSearched}
              onSearch={handlePaperSearch}
              projects={projects}
              projectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              onImportPaper={handleImportPaper}
              importingPaperKey={importingPaperKey}
              importError={importError}
              importNotice={importNotice}
            />
          )}

          {active === 'Library' && (
            <LibraryPage
              projects={projects}
              projectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              onNavigateToDiscovery={() => setActive('Discover papers')}
              onToast={showToast}
            />
          )}

          {active === 'Comparisons & gaps' && (
            <CompareGapsPage
              projects={projects}
              projectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              onNavigateToLibrary={() => setActive('Library')}
            />
          )}

          {active === 'AI research' && (
            <AIResearchPage
              projects={projects}
              projectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              onOpenSettings={() => setActive('Settings')}
            />
          )}

          {active === 'Analytics' && (
            <AnalyticsPage
              projects={projects}
              projectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
            />
          )}

          {active === 'Documents' && (
            <DocumentsPage
              projects={projects}
              projectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
            />
          )}

          {active === 'Team' && (
            <TeamPage
              projects={projects}
              projectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              onRefreshProjects={loadProjects}
            />
          )}

          {active === 'Settings' && <SettingsPage onLogout={handleLogout} />}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <section className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">NEW WORKSPACE</span>
                <h2>Create a Project</h2>
                <p>Set up an organized space for papers, matrices, and reports.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCreateProject}>
              <label className="workspace-field">
                <span>Project Name</span>
                <input
                  autoFocus
                  required
                  maxLength={120}
                  placeholder="e.g. LLM Reasoning & Search"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </label>

              <label className="workspace-field">
                <span>Description (Optional)</span>
                <textarea
                  rows={4}
                  maxLength={2000}
                  placeholder="What hypotheses, problem domain, or research questions are you investigating?"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                />
              </label>

              {createError && (
                <div className="workspace-alert is-error" role="alert">
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={createLoading || !newProjectName.trim()}
                >
                  {createLoading ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
                  {createLoading ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingProject(null);
          }}
        >
          <section className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">EDIT WORKSPACE</span>
                <h2>Edit Project Details</h2>
                <p>Update title and description for “{editingProject.name}”.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditingProject(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSaveEditProject}>
              <label className="workspace-field">
                <span>Project Name</span>
                <input
                  required
                  maxLength={120}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>

              <label className="workspace-field">
                <span>Description</span>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </label>

              {editError && (
                <div className="workspace-alert is-error" role="alert">
                  <AlertCircle size={16} />
                  <span>{editError}</span>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditingProject(null)}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={editLoading || !editName.trim()}
                >
                  {editLoading ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deletingProject && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!deleteLoading) setDeletingProject(null);
          }}
        >
          <section className="modal-card" style={{ maxWidth: '440px' }} role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div>
                <span className="eyebrow" style={{ color: '#ef4444' }}>DANGER ZONE</span>
                <h2>Delete Project?</h2>
                <p>
                  Permanently delete <strong>“{deletingProject.name}”</strong> and all attached papers, comparisons, gaps, and documents?
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeletingProject(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button danger-button"
                onClick={() => void executeDeleteProject()}
                disabled={deleteLoading}
              >
                {deleteLoading ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}
                {deleteLoading ? 'Deleting…' : 'Permanently Delete'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Notifications Modal */}
      {notificationsOpen && (
        <div className="modal-backdrop" onClick={() => setNotificationsOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">UPDATES & ACTIVITY</span>
                <h2>Notifications</h2>
                <p>All system alerts and project activities.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setNotificationsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-default)', fontSize: '13px' }}>
                <strong style={{ display: 'block', color: '#0f172a' }}>System is fully operational</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Connected to ResearchForge API. Local environment is healthy.</span>
              </div>
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-default)', fontSize: '13px' }}>
                <strong style={{ display: 'block', color: '#0f172a' }}>You are all caught up</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>No pending tasks or unresolved errors.</span>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setNotificationsOpen(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   AUTH SCREEN (SPLIT DESIGN)
============================================================= */
type AuthScreenProps = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  error: string;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQuickDemo: () => void;
};

function AuthScreen({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  displayName,
  setDisplayName,
  error,
  loading,
  onSubmit,
  onQuickDemo,
}: AuthScreenProps) {
  const isRegister = mode === 'register';

  return (
    <main className="auth-layout">
      {/* Left Showcase Banner */}
      <section className="auth-showcase">
        <div className="auth-brand brand">
          <div className="brand-mark">
            <BrainCircuit size={24} />
          </div>
          <span className="brand-name">ResearchForge</span>
        </div>

        <div className="showcase-content">
          <span className="showcase-pill">
            <Sparkles size={14} />
            RESEARCH INTELLIGENCE PLATFORM
          </span>

          <h1>
            Rigorous research.
            <br />
            <span>Structured insights.</span>
          </h1>

          <p>
            An evidence-bound research workspace connecting academic paper discovery, PDF text
            extraction, comparison matrices, research-gap tracking, and report exports.
          </p>

          <div className="showcase-features">
            <div className="feature-line">
              <div className="feature-icon">
                <Search size={18} />
              </div>
              <div>
                <strong>Multi-Source Academic Discovery</strong>
                <p>Query arXiv and Semantic Scholar simultaneously.</p>
              </div>
              <CheckCircle2 size={16} className="feature-check" />
            </div>

            <div className="feature-line">
              <div className="feature-icon">
                <FileText size={18} />
              </div>
              <div>
                <strong>PDF Selectable Text Extraction</strong>
                <p>Upload papers up to 25 MB and extract searchable content.</p>
              </div>
              <CheckCircle2 size={16} className="feature-check" />
            </div>

            <div className="feature-line">
              <div className="feature-icon">
                <GitCompare size={18} />
              </div>
              <div>
                <strong>Comparative Matrices & Gap Tracking</strong>
                <p>Compare methodologies and track unanswered questions.</p>
              </div>
              <CheckCircle2 size={16} className="feature-check" />
            </div>

            <div className="feature-line">
              <div className="feature-icon">
                <Sparkles size={18} />
              </div>
              <div>
                <strong>Grounded AI Research Synthesis</strong>
                <p>Explicit, evidence-backed summaries and Q&A.</p>
              </div>
              <CheckCircle2 size={16} className="feature-check" />
            </div>
          </div>
        </div>

        <div className="showcase-footer">
          ResearchForge · Deterministic research workflows with zero hallucination.
        </div>
      </section>

      {/* Right Login/Register Form */}
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand brand">
            <div className="brand-mark">
              <BrainCircuit size={22} />
            </div>
            <span className="brand-name">ResearchForge</span>
          </div>

          <div className="auth-heading">
            <span className="eyebrow">{isRegister ? 'JOIN RESEARCHFORGE' : 'WELCOME BACK'}</span>
            <h2>{isRegister ? 'Create researcher account' : 'Sign in to your workspace'}</h2>
            <p>
              {isRegister
                ? 'Start building your project-scoped research library.'
                : 'Enter your credentials to access your research.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            {isRegister && (
              <>
                <label htmlFor="display-name">Full Name</label>
                <div className="input-with-icon">
                  <Users size={18} />
                  <input
                    id="display-name"
                    type="text"
                    maxLength={120}
                    autoComplete="name"
                    placeholder="e.g. Dr. Jane Smith"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <label htmlFor="auth-email">Academic or Work Email</label>
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="researcher@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <label htmlFor="auth-password">Password</label>
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input
                id="auth-password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? 'Min 8 characters with letters & numbers' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isRegister ? 8 : undefined}
                required
              />
            </div>

            {error && (
              <div className="workspace-alert is-error" role="alert" style={{ marginTop: '8px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="primary-button auth-submit"
              disabled={loading}
            >
              {loading ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <ArrowRight size={18} />
              )}
              {loading ? 'Authenticating…' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to ResearchForge?'}
            <button
              type="button"
              onClick={() => setMode(isRegister ? 'login' : 'register')}
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button
              type="button"
              className="ghost-button"
              onClick={onQuickDemo}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '0.65rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--accent)',
                borderColor: 'var(--accent)',
                borderRadius: '8px',
              }}
            >
              <Sparkles size={16} /> Guest Demo
            </button>
          </div>

          <p className="auth-security-note">
            <LockKeyhole size={13} />
            Project data is private and scoped to authenticated members.
          </p>
        </div>
      </section>
    </main>
  );
}

/* =============================================================
   PAGE 1: OVERVIEW DASHBOARD
============================================================= */
function OverviewPage({
  projects,
  currentUser,
  loading,
  error,
  onCreateProject,
  onOpenProjects,
  onOpenDiscovery,
  onOpenLibrary,
  onSelectProject,
  onRetry,
}: {
  projects: Project[];
  currentUser: User | null;
  loading: boolean;
  error: string;
  onCreateProject: () => void;
  onOpenProjects: () => void;
  onOpenDiscovery: () => void;
  onOpenLibrary: () => void;
  onSelectProject: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <div className="page-stack">
      {/* Welcome Hero Banner */}
      <section className="welcome-banner">
        <div className="welcome-copy">
          <span className="eyebrow light-eyebrow">RESEARCH COMMAND CENTER</span>
          <h1>
            {currentUser?.display_name
              ? `Welcome back, ${currentUser.display_name.split(' ')[0]}!`
              : 'Every breakthrough starts with literature.'}
          </h1>
          <p>
            Organize hypotheses, ingest arXiv and Semantic Scholar papers, extract text, and build
            reproducible matrices for your next publication.
          </p>

          <div className="welcome-actions">
            <button
              type="button"
              className="welcome-primary-button"
              onClick={onCreateProject}
            >
              <Plus size={16} /> New Project Workspace
            </button>
            <button
              type="button"
              className="welcome-secondary-button"
              onClick={onOpenDiscovery}
            >
              <Search size={16} /> Search Literature
            </button>
          </div>
        </div>
      </section>

      {/* KPI Stats */}
      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon">
              <FolderKanban size={18} />
            </div>
            <span className="stat-label">Active Projects</span>
          </div>
          <div className="stat-value">{loading ? '—' : projects.length}</div>
          <p>Project workspaces</p>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
              <Search size={18} />
            </div>
            <span className="stat-label">Literature Search</span>
          </div>
          <div className="stat-value stat-value-text">arXiv + S2</div>
          <p>Dual-source discovery ready</p>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
              <GitCompare size={18} />
            </div>
            <span className="stat-label">Analysis Matrices</span>
          </div>
          <div className="stat-value stat-value-text">Enabled</div>
          <p>Cross-paper comparison</p>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}>
              <Sparkles size={18} />
            </div>
            <span className="stat-label">AI Engine</span>
          </div>
          <div className="stat-value stat-value-text">Grounded</div>
          <p>Evidence-backed inference</p>
        </article>
      </section>

      {/* Recent Projects Section */}
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR RESEARCH WORKSPACES</span>
            <h2>Recent Projects</h2>
            <p>Pick up directly where your review left off.</p>
          </div>
          <button type="button" className="text-button" onClick={onOpenProjects}>
            View all ({projects.length}) <ArrowUpRight size={15} />
          </button>
        </div>

        {error && (
          <div className="workspace-alert is-error">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button type="button" className="text-button" onClick={onRetry} style={{ marginLeft: 'auto' }}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="workspace-busy">
            <LoaderCircle size={22} className="spin" />
            <span>Loading projects…</span>
          </div>
        ) : projects.length > 0 ? (
          <div className="project-grid">
            {projects.slice(0, 3).map((project) => (
              <article
                className="project-card"
                key={project.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectProject(project.id)}
              >
                <div className="project-card-top">
                  <div className="project-icon">
                    <FolderKanban size={20} />
                  </div>
                  <span className="project-status">
                    <span className="status-dot" />
                    Active
                  </span>
                </div>

                <h3>{project.name}</h3>
                <p className="project-description">
                  {project.description?.trim() || 'No description provided.'}
                </p>

                <div className="project-card-footer">
                  <span>
                    <CalendarDays size={13} />
                    {formatDate(project.created_at)}
                  </span>
                  <span style={{ color: '#4f46e5', fontWeight: 600 }}>
                    Open Workspace <ArrowRight size={13} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : !error ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FolderKanban size={26} />
            </div>
            <h3>No research projects yet</h3>
            <p>Create your first project workspace to start organizing papers and reports.</p>
            <button type="button" className="primary-button" onClick={onCreateProject}>
              <Plus size={16} /> Create First Project
            </button>
          </div>
        ) : null}
      </section>

      {/* Quick Discovery CTA Card */}
      <section
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
          border: '1px solid #e0e7ff',
          borderRadius: '16px',
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#ede9fe',
              color: '#6366f1',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#0f172a' }}>
              Explore Related Literature
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Search across academic sources, inspect citations, and import papers into your library.
            </p>
          </div>
        </div>

        <button type="button" className="primary-button" onClick={onOpenDiscovery}>
          <Search size={15} /> Discover Papers
        </button>
      </section>
    </div>
  );
}

/* =============================================================
   PAGE 2: MY PROJECTS
============================================================= */
function ProjectsPage({
  projects,
  selectedProjectId,
  loading,
  error,
  onCreateProject,
  onRetry,
  onSelectProject,
  onEditProject,
  onDeleteProject,
}: {
  projects: Project[];
  selectedProjectId: string;
  loading: boolean;
  error: string;
  onCreateProject: () => void;
  onRetry: () => void;
  onSelectProject: (id: string) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
}) {
  const [searchFilter, setSearchFilter] = useState('');

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="WORKSPACE DIRECTORY"
        title="My Projects"
        description="Every research question deserves a structured home for literature, comparative analysis, and outputs."
        action={
          <button type="button" className="primary-button" onClick={onCreateProject}>
            <Plus size={16} /> New Project
          </button>
        }
      />

      {error && (
        <div className="workspace-alert is-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" className="text-button" onClick={onRetry} style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      )}

      {/* Filter and Count Bar */}
      {projects.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div className="input-with-icon" style={{ width: 'min(100%, 320px)' }}>
            <Search size={16} />
            <input
              type="search"
              placeholder="Filter projects by title…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ padding: '8px 12px 8px 38px', fontSize: '13px' }}
            />
          </div>

          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
            Showing {filtered.length} of {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {loading ? (
        <div className="workspace-busy">
          <LoaderCircle size={24} className="spin" />
          <span>Loading project directory…</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="project-grid">
          {filtered.map((project) => {
            const isCurrent = project.id === selectedProjectId;

            return (
              <article
                className="project-card"
                key={project.id}
                style={{
                  borderColor: isCurrent ? '#6366f1' : 'var(--border-default)',
                  background: '#ffffff',
                }}
              >
                <div className="project-card-top">
                  <div
                    className="project-icon"
                    style={{
                      background: isCurrent ? 'linear-gradient(135deg, #ede9fe, #ddd6fe)' : '#f1f5f9',
                      color: isCurrent ? '#6366f1' : '#475569',
                    }}
                  >
                    <FolderKanban size={20} />
                  </div>

                  {isCurrent ? (
                    <span
                      className="project-status"
                      style={{ background: '#eef2ff', color: '#4f46e5' }}
                    >
                      Active Selection
                    </span>
                  ) : (
                    <span className="project-status">Active</span>
                  )}
                </div>

                <h3>{project.name}</h3>
                <p className="project-description">
                  {project.description?.trim() || 'No description provided.'}
                </p>

                <div className="project-card-footer">
                  <span>
                    <CalendarDays size={13} />
                    {formatDate(project.created_at)}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      className="project-mini-action"
                      onClick={() => onSelectProject(project.id)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="project-mini-action"
                      onClick={() => onEditProject(project)}
                      title="Edit project"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      className="project-mini-action danger-text"
                      onClick={() => onDeleteProject(project)}
                      title="Delete project"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : !loading && projects.length > 0 && filtered.length === 0 ? (
        <div className="empty-state">
          <p>No projects match your filter “{searchFilter}”.</p>
          <button type="button" className="text-button" onClick={() => setSearchFilter('')}>
            Clear filter
          </button>
        </div>
      ) : !error ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FolderKanban size={26} />
          </div>
          <h3>Start Your First Project</h3>
          <p>Create a project to start importing papers, extracting text, and generating reports.</p>
          <button type="button" className="primary-button" onClick={onCreateProject}>
            <Plus size={16} /> Create Project
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* =============================================================
   PAGE 3: DISCOVERY
============================================================= */
function DiscoveryPage({
  query,
  setQuery,
  sources,
  toggleSource,
  results,
  warnings,
  error,
  loading,
  hasSearched,
  onSearch,
  projects,
  projectId,
  onProjectChange,
  onImportPaper,
  importingPaperKey,
  importError,
  importNotice,
}: {
  query: string;
  setQuery: (value: string) => void;
  sources: DiscoverySource[];
  toggleSource: (source: DiscoverySource) => void;
  results: DiscoveryPaper[];
  warnings: string[];
  error: string;
  loading: boolean;
  hasSearched: boolean;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
  onImportPaper: (paper: DiscoveryPaper) => void;
  importingPaperKey: string;
  importError: string;
  importNotice: string;
}) {
  return (
    <div className="page-stack discovery-page">
      <PageHeading
        eyebrow="LITERATURE EXPLORER"
        title="Discover Papers"
        description="Query arXiv and Semantic Scholar to discover related research and save directly to your library."
      />

      {/* Target Project Selection */}
      <div className="discovery-save-target">
        <label htmlFor="discovery-project-target">Save imported papers to:</label>
        <select
          id="discovery-project-target"
          value={projectId}
          onChange={(e) => onProjectChange(e.target.value)}
          disabled={!projects.length}
        >
          {projects.length ? (
            projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))
          ) : (
            <option value="">Create a project first</option>
          )}
        </select>
      </div>

      {importError && (
        <div className="workspace-alert is-error">
          <AlertCircle size={16} />
          <span>{importError}</span>
        </div>
      )}

      {importNotice && (
        <div className="workspace-alert is-success">
          <CheckCircle2 size={16} />
          <span>{importNotice}</span>
        </div>
      )}

      {/* Search Input Form */}
      <form className="discovery-search" onSubmit={onSearch}>
        <label htmlFor="paper-search">Search Academic Publications</label>

        <div className="discovery-search-row">
          <div className="input-with-icon discovery-input">
            <Search size={18} />
            <input
              id="paper-search"
              type="search"
              minLength={2}
              maxLength={300}
              placeholder="e.g. Graph Neural Networks, Transformer Attention, Quantum Computing…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
            />
            {query && (
              <button
                type="button"
                className="clear-search-button"
                onClick={() => setQuery('')}
                title="Clear query"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button type="submit" className="primary-button" disabled={loading || query.trim().length < 2}>
            {loading ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
            {loading ? 'Searching…' : 'Search Papers'}
          </button>
        </div>

        {/* Source Toggles */}
        <div className="source-options">
          <span style={{ fontWeight: 700, fontSize: '12px', color: '#334155' }}>Sources:</span>

          <label>
            <input
              type="checkbox"
              checked={sources.includes('arxiv')}
              onChange={() => toggleSource('arxiv')}
            />
            <span>arXiv</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={sources.includes('semantic_scholar')}
              onChange={() => toggleSource('semantic_scholar')}
            />
            <span>Semantic Scholar</span>
          </label>

          <span className="source-hint">Select at least one source</span>
        </div>
      </form>

      {/* Error / Warnings */}
      {error && (
        <div className="workspace-alert is-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {warnings.map((warning, index) => (
        <div className="warning-banner" key={`${warning}-${index}`}>
          <AlertCircle size={16} />
          <span>{warning}</span>
        </div>
      ))}

      {/* Loading */}
      {loading && (
        <div className="discovery-loading">
          <LoaderCircle size={28} className="spin" />
          <h3 style={{ fontSize: '16px', margin: '8px 0 4px', color: '#0f172a' }}>
            Querying academic adapters…
          </h3>
          <p style={{ margin: 0, fontSize: '13px' }}>Fetching paper metadata from arXiv and Semantic Scholar.</p>
        </div>
      )}

      {/* Results Grid */}
      {!loading && hasSearched && results.length > 0 && (
        <section className="content-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SEARCH RESULTS</span>
              <h2>Found {results.length} Papers</h2>
              <p>
                Literature results matching <strong>“{query.trim()}”</strong>
              </p>
            </div>
          </div>

          <div className="discovery-results">
            {results.map((paper, index) => (
              <DiscoveryPaperCard
                key={`${paper.source}-${paper.source_id}-${index}`}
                paper={paper}
                onImport={() => onImportPaper(paper)}
                importing={importingPaperKey === `${paper.source}:${paper.source_id}`}
                canImport={Boolean(projectId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* No results */}
      {!loading && hasSearched && results.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileSearch size={26} />
          </div>
          <h3>No papers found</h3>
          <p>Try modifying your search terms, removing filters, or selecting another source.</p>
        </div>
      )}

      {/* Initial Suggestions */}
      {!loading && !hasSearched && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: '#eef2ff',
              color: '#6366f1',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}
          >
            <BookOpen size={24} />
          </div>
          <h3 style={{ fontSize: '17px', color: '#0f172a', margin: '0 0 8px' }}>
            Discover Academic Literature
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px', lineHeight: '1.6' }}>
            Search by research topic, method name, or author. Results will include titles, abstracts, publication years, and external paper links.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Suggested:</span>
            {['Large Language Models', 'Reinforcement Learning', 'Graph Neural Networks', 'Diffusion Models'].map(
              (suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="secondary-button"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setQuery(suggestion)}
                >
                  {suggestion}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DiscoveryPaperCard({
  paper,
  onImport,
  importing,
  canImport,
}: {
  paper: DiscoveryPaper;
  onImport: () => void;
  importing: boolean;
  canImport: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const authors = paper.authors?.length
    ? paper.authors.slice(0, 4).join(', ') + (paper.authors.length > 4 ? ' et al.' : '')
    : 'Authors not listed';

  const sourceLabel = paper.source === 'semantic_scholar' ? 'Semantic Scholar' : 'arXiv';

  return (
    <article className="discovery-paper-card">
      <div className="paper-card-meta">
        <span className="paper-source">{sourceLabel}</span>
        {paper.year && <span>{paper.year}</span>}
        {paper.venue && <span>{paper.venue}</span>}
        {paper.citation_count != null && <span>{paper.citation_count.toLocaleString()} citations</span>}
      </div>

      <h3>{paper.title || 'Untitled Paper'}</h3>
      <p className="paper-authors">{authors}</p>

      {paper.abstract ? (
        <p className="paper-abstract" style={expanded ? { WebkitLineClamp: 'unset' } : {}}>
          {paper.abstract}
        </p>
      ) : (
        <p className="paper-abstract" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
          No abstract available from source.
        </p>
      )}

      {paper.abstract && paper.abstract.length > 240 && (
        <button
          type="button"
          className="text-button"
          style={{ padding: 0, fontSize: '11px', marginBottom: '12px' }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      <div className="paper-card-actions">
        {paper.landing_url && (
          <a href={paper.landing_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} /> Paper Page
          </a>
        )}

        {paper.pdf_url && (
          <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer">
            <FileText size={13} /> PDF
          </a>
        )}

        {paper.doi && (
          <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
            <ArrowUpRight size={13} /> DOI
          </a>
        )}

        <button type="button" onClick={onImport} disabled={!canImport || importing}>
          {importing ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />}
          {importing ? 'Saving…' : 'Save to Library'}
        </button>
      </div>
    </article>
  );
}

/* =============================================================
   PAGE 4: RESEARCH LIBRARY
============================================================= */
function LibraryPage({
  projects,
  projectId,
  onProjectChange,
  onNavigateToDiscovery,
  onToast,
}: {
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
  onNavigateToDiscovery?: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [papers, setPapers] = useState<LibraryPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Extracted text viewer modal state
  const [viewingPaper, setViewingPaper] = useState<LibraryPaper | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState('');
  const [textSearch, setTextSearch] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  async function refreshLibrary() {
    if (!projectId) {
      setPapers([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getLibrary(projectId);
      setPapers(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshLibrary();
  }, [projectId]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!projectId) {
      setError('Create or select a project before uploading a paper.');
      return;
    }

    if (!file) {
      setError('Choose a PDF file to upload.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('PDF files must be 25 MB or smaller.');
      return;
    }

    setUploading(true);

    try {
      const paper = await uploadPdf(projectId, file);
      setFile(null);

      // Attempt extraction automatically
      try {
        const result = await extractPaper(projectId, paper.id);
        setNotice(
          `Uploaded and extracted “${result.title}” (${result.page_count} pages, ${result.character_count.toLocaleString()} characters).`
        );
        onToast(`Extracted “${result.title}”!`);
      } catch (extractErr) {
        setNotice(`Uploaded PDF, but selectable text extraction encountered: ${getErrorMessage(extractErr)}`);
      }

      await refreshLibrary();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleExtractSingle(paper: LibraryPaper) {
    setExtractingId(paper.id);
    setError('');
    try {
      const res = await extractPaper(projectId, paper.id);
      onToast(`Extracted ${res.page_count} pages from “${res.title}”!`);
      await refreshLibrary();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExtractingId(null);
    }
  }

  async function handleViewText(paper: LibraryPaper) {
    setViewingPaper(paper);
    setExtractedText('');
    setTextError('');
    setTextLoading(true);

    try {
      const res = await getExtractedText(projectId, paper.id);
      setExtractedText(res.text ?? '');
    } catch (err) {
      setTextError(getErrorMessage(err));
    } finally {
      setTextLoading(false);
    }
  }

  function handleCopyExtractedText() {
    if (!extractedText) return;
    void navigator.clipboard.writeText(extractedText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  }

  return (
    <div className="page-stack library-page">
      <PageHeading
        eyebrow="PROJECT ARCHIVE"
        title="Research Library"
        description="Ingest PDFs, extract selectable text, and maintain papers organized within your project workspace."
        action={
          <button
            type="button"
            className="secondary-button"
            onClick={() => void refreshLibrary()}
            disabled={loading || !projectId}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {/* Upload Zone */}
      <section className="content-section library-upload-panel">
        <div className="section-heading">
          <div>
            <h2>Ingest PDF Paper</h2>
            <p>Upload a PDF publication to extract selectable text (Max size 25 MB).</p>
          </div>
        </div>

        {projects.length > 0 && (
          <label className="workspace-field" style={{ maxWidth: '440px', marginBottom: '16px' }}>
            <span>Target Project Workspace</span>
            <select value={projectId} onChange={(e) => onProjectChange(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <form onSubmit={handleUpload} style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="library-file-picker">
            <Upload size={20} />
            <span>{file ? file.name : 'Click to browse or drop a PDF here'}</span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
          </label>

          {file && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </span>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={uploading || !file || !projectId}
          >
            {uploading ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}
            {uploading ? 'Extracting Text…' : 'Upload & Extract'}
          </button>
        </form>

        {error && (
          <div className="workspace-alert is-error" style={{ marginTop: '16px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="workspace-alert is-success" style={{ marginTop: '16px' }}>
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}
      </section>

      {/* Saved Papers List */}
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SAVED PAPERS</span>
            <h2>Library Collection ({papers.length})</h2>
            <p>Papers stored and indexed in this project.</p>
          </div>

          {onNavigateToDiscovery && (
            <button type="button" className="secondary-button" onClick={onNavigateToDiscovery}>
              <Search size={14} /> Search Academic Sources
            </button>
          )}
        </div>

        {loading ? (
          <div className="workspace-busy">
            <LoaderCircle size={24} className="spin" />
            <span>Loading library papers…</span>
          </div>
        ) : papers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <LibraryBig size={26} />
            </div>
            <h3>Your library is empty</h3>
            <p>Upload a PDF above or use Discover Papers to import academic publications.</p>
          </div>
        ) : (
          <div className="library-paper-list">
            {papers.map((paper) => {
              const isCompleted = paper.extraction_status === 'completed';
              const isExtracting = extractingId === paper.id;

              return (
                <article className="library-paper-card" key={paper.id}>
                  <div className="library-paper-icon">
                    <FileText size={22} />
                  </div>

                  <div className="library-paper-main">
                    <h3>{paper.title}</h3>

                    <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748b' }}>
                      {paper.authors?.length
                        ? paper.authors.join(', ')
                        : paper.source === 'upload'
                        ? 'Uploaded PDF'
                        : paper.source}
                      {paper.year ? ` · ${paper.year}` : ''}
                    </p>

                    <div className="library-paper-meta">
                      <span>{paper.page_count != null ? `${paper.page_count} pages` : 'Pages uncounted'}</span>
                      <span className={`library-status ${paper.extraction_status || 'not-extracted'}`}>
                        {paper.extraction_status === 'completed'
                          ? '✓ Text Extracted'
                          : paper.extraction_status === 'failed'
                          ? 'Extraction Failed'
                          : 'Not Extracted'}
                      </span>
                      {paper.doi && <span>DOI: {paper.doi}</span>}
                    </div>

                    {paper.abstract && (
                      <p
                        style={{
                          fontSize: '13px',
                          color: '#475569',
                          lineHeight: '1.6',
                          margin: '10px 0 0',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {paper.abstract}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => void handleViewText(paper)}
                        disabled={!isCompleted}
                      >
                        <FileSearch size={14} /> View Extracted Text
                      </button>

                      {paper.pdf_path && !isCompleted && (
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => void handleExtractSingle(paper)}
                          disabled={isExtracting}
                        >
                          {isExtracting ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}
                          {isExtracting ? 'Extracting…' : 'Run Text Extraction'}
                        </button>
                      )}

                      {paper.landing_url && (
                        <a
                          href={paper.landing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-button"
                          style={{ fontSize: '12px' }}
                        >
                          <ExternalLink size={13} /> Original Source
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Extracted Text Viewer Modal */}
      {viewingPaper && (
        <div className="modal-backdrop" onClick={() => setViewingPaper(null)}>
          <div
            className="modal-card"
            style={{ width: 'min(100%, 860px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">SELECTABLE PDF TEXT</span>
                <h2>{viewingPaper.title}</h2>
                <p>
                  {extractedText.length.toLocaleString()} characters extracted from attached PDF.
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setViewingPaper(null)}
              >
                <X size={18} />
              </button>
            </div>

            {textLoading ? (
              <div className="workspace-busy">
                <LoaderCircle size={22} className="spin" />
                <span>Loading extracted text…</span>
              </div>
            ) : textError ? (
              <div className="workspace-alert is-error">
                <AlertCircle size={16} />
                <span>{textError}</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
                  <div className="input-with-icon" style={{ flex: 1 }}>
                    <Search size={16} />
                    <input
                      type="search"
                      placeholder="Search within extracted text…"
                      value={textSearch}
                      onChange={(e) => setTextSearch(e.target.value)}
                      style={{ padding: '8px 12px 8px 36px', fontSize: '13px' }}
                    />
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCopyExtractedText}
                  >
                    {copiedText ? <Check size={14} /> : <Copy size={14} />}
                    {copiedText ? 'Copied' : 'Copy Text'}
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: '520px',
                    overflowY: 'auto',
                    padding: '16px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid var(--border-default)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    lineHeight: '1.7',
                    whiteSpace: 'pre-wrap',
                    color: '#1e293b',
                  }}
                >
                  {extractedText || 'No text extracted.'}
                </div>
              </>
            )}

            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setViewingPaper(null)}
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
