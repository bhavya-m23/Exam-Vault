import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import RequestAccessModal from '../components/RequestAccessModal';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCheck, 
  Flame, 
  Clock, 
  UserX, 
  FileX,
  Zap,
  ShieldCheck,
  Search,
  Filter,
  Activity,
  Sliders,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  UserCheck,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  Play,
  RotateCcw,
  Eye,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SecurityActivity = () => {
  const { currentUser, showToast } = useAuth();
  const isInvestigator = currentUser && ['Administrator', 'Exam Coordinator'].includes(currentUser.role);
  const isAdmin = currentUser && currentUser.role === 'Administrator';

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'events' | 'incidents' | 'rules'
  const [timeRange, setTimeRange] = useState('all');

  // Data States
  const [stats, setStats] = useState({
    activeAlerts: 0,
    blockedAttempts: 0,
    integrityWarnings: 0,
    openIncidents: 0,
    investigatingIncidents: 0,
    resolvedIncidents: 0,
    failedAuthCount: 0,
    eventsBySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Event Explorer States
  const [explorerEvents, setExplorerEvents] = useState([]);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerSeverity, setExplorerSeverity] = useState('ALL');
  const [explorerOutcome, setExplorerOutcome] = useState('ALL');
  const [explorerRule, setExplorerRule] = useState('ALL');
  const [explorerPage, setExplorerPage] = useState(1);
  const [explorerTotalPages, setExplorerTotalPages] = useState(1);
  const [explorerTotalCount, setExplorerTotalCount] = useState(0);

  // Incident Center States
  const [incidents, setIncidents] = useState([]);
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('all');
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [assigneeInput, setAssigneeInput] = useState('');
  const [resolutionSummaryInput, setResolutionSummaryInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Detection Rules States
  const [rules, setRules] = useState([]);

  // Controlled Simulation State
  const [simulating, setSimulating] = useState(false);

  // General Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Fetch Dashboard Stats & Overview Events
  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const [statsRes, eventsRes] = await Promise.all([
        fetch(`/api/security/stats?range=${timeRange}`),
        fetch('/api/security/events?limit=8&paginate=true')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setRecentEvents(eventsData.events || (Array.isArray(eventsData) ? eventsData : []));
      }
    } catch {
      showToast('Error loading security activity data', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Event Explorer with filters & pagination
  const fetchExplorerData = async () => {
    try {
      const queryParams = new URLSearchParams({
        paginate: 'true',
        page: explorerPage,
        limit: 15
      });
      if (explorerSearch) queryParams.append('search', explorerSearch);
      if (explorerSeverity !== 'ALL') queryParams.append('severity', explorerSeverity);
      if (explorerOutcome !== 'ALL') queryParams.append('outcome', explorerOutcome);
      if (explorerRule !== 'ALL') queryParams.append('ruleId', explorerRule);

      const res = await fetch(`/api/security/events?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExplorerEvents(data.events || []);
        if (data.pagination) {
          setExplorerTotalPages(data.pagination.totalPages || 1);
          setExplorerTotalCount(data.pagination.total || 0);
        }
      }
    } catch {
      showToast('Error fetching security events', 'danger');
    }
  };

  // Fetch Incidents
  const fetchIncidentsData = async () => {
    if (!isInvestigator) return;
    try {
      const queryParams = new URLSearchParams({ limit: 50 });
      if (incidentStatusFilter !== 'all') queryParams.append('status', incidentStatusFilter);
      if (incidentSeverityFilter !== 'all') queryParams.append('severity', incidentSeverityFilter);

      const res = await fetch(`/api/security/incidents?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch {
      showToast('Error fetching incidents', 'danger');
    }
  };

  // Fetch Single Incident Details
  const fetchIncidentDetails = async (id) => {
    try {
      const res = await fetch(`/api/security/incidents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedIncident(data);
        setAssigneeInput(data.assignedTo || '');
      }
    } catch {
      showToast('Error loading incident details', 'danger');
    }
  };

  // Fetch Detection Rules
  const fetchRulesData = async () => {
    try {
      const res = await fetch('/api/security/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch {
      showToast('Error fetching detection rules', 'danger');
    }
  };

  // Trigger loads based on active tab
  useEffect(() => {
    fetchOverviewData();
  }, [timeRange]);

  useEffect(() => {
    if (activeTab === 'events') {
      fetchExplorerData();
    } else if (activeTab === 'incidents') {
      fetchIncidentsData();
    } else if (activeTab === 'rules') {
      fetchRulesData();
    }
  }, [activeTab, explorerPage, explorerSeverity, explorerOutcome, explorerRule, incidentStatusFilter, incidentSeverityFilter]);

  // Handle Mark Single Event as Reviewed
  const handleMarkAsReviewed = async (eventId) => {
    try {
      const res = await fetch(`/api/security/events/${eventId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser ? currentUser.name : "Administrator",
          status: "Reviewed"
        })
      });

      if (res.ok) {
        showToast(`Security alert ${eventId} marked as Reviewed.`, 'success');
        fetchOverviewData();
        if (activeTab === 'events') fetchExplorerData();
      }
    } catch {
      showToast('Error updating security alert', 'danger');
    }
  };

  // Incident Actions
  const handleAddNote = async () => {
    if (!newNoteText.trim() || !selectedIncident) return;
    try {
      const res = await fetch(`/api/security/incidents/${selectedIncident.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNoteText.trim() })
      });
      if (res.ok) {
        showToast('Investigation note recorded', 'success');
        setNewNoteText('');
        fetchIncidentDetails(selectedIncident.id);
        fetchIncidentsData();
      }
    } catch {
      showToast('Failed to add note', 'danger');
    }
  };

  const handleUpdateIncidentStatus = async (newStatus, summary = null) => {
    if (!selectedIncident) return;
    try {
      const res = await fetch(`/api/security/incidents/${selectedIncident.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolutionSummary: summary || (newStatus === 'Resolved' ? 'Incident investigated and resolved.' : undefined)
        })
      });
      if (res.ok) {
        showToast(`Incident status updated to ${newStatus}`, 'success');
        setIsResolving(false);
        setResolutionSummaryInput('');
        fetchIncidentDetails(selectedIncident.id);
        fetchIncidentsData();
        fetchOverviewData();
      }
    } catch {
      showToast('Failed to update status', 'danger');
    }
  };

  const handleAssignIncident = async () => {
    if (!assigneeInput.trim() || !selectedIncident) return;
    try {
      const res = await fetch(`/api/security/incidents/${selectedIncident.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: assigneeInput.trim() })
      });
      if (res.ok) {
        showToast(`Incident assigned to ${assigneeInput.trim()}`, 'success');
        fetchIncidentDetails(selectedIncident.id);
        fetchIncidentsData();
      }
    } catch {
      showToast('Failed to assign incident', 'danger');
    }
  };

  // Controlled Simulation Trigger
  const handleRunSimulation = async (scenario) => {
    try {
      setSimulating(true);
      const res = await fetch('/api/security/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Simulation executed: ${scenario}. New alert & incident recorded.`, 'success');
        fetchOverviewData();
        if (activeTab === 'events') fetchExplorerData();
        if (activeTab === 'incidents') fetchIncidentsData();
      } else {
        showToast(data.message || 'Simulation execution failed', 'danger');
      }
    } catch {
      showToast('Simulation error', 'danger');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 pb-16">
      <Header
        title="Security Monitoring & Threat Detection"
        subtitle="Real-time heuristic threat detection, incident response, and forensic investigation"
        onOpenRequestModal={() => setIsRequestModalOpen(true)}
      />

      <main className="p-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Activity size={15} />
              Security Overview
            </button>

            <button
              onClick={() => setActiveTab('events')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'events'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Search size={15} />
              Event Explorer
            </button>

            <button
              onClick={() => setActiveTab('incidents')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 relative ${
                activeTab === 'incidents'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <ShieldAlert size={15} />
              Incident Center
              {(stats.openIncidents > 0 || stats.investigatingIncidents > 0) && (
                <span className="px-1.5 py-0.2 bg-red-500 text-white text-[10px] font-black rounded-full ml-1">
                  {(stats.openIncidents || 0) + (stats.investigatingIncidents || 0)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'rules'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Sliders size={15} />
              Detection Rules
            </button>
          </div>

          {/* Time Range Selector for Overview */}
          {activeTab === 'overview' && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-500" />
              <span className="text-xs text-slate-400">Time Range:</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="1h">Last 1 Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SECURITY OVERVIEW */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Active Threat Alerts"
                value={stats.activeAlerts || 0}
                subtitle="Requires Triage"
                icon={ShieldAlert}
                color="red"
              />

              <StatCard
                title="Open Incidents"
                value={(stats.openIncidents || 0) + (stats.investigatingIncidents || 0)}
                subtitle={`${stats.openIncidents || 0} Open, ${stats.investigatingIncidents || 0} In Progress`}
                icon={AlertCircle}
                color="amber"
              />

              <StatCard
                title="Blocked Accesses"
                value={stats.blockedAttempts || 0}
                subtitle="Policy Enforcements"
                icon={UserX}
                color="purple"
              />

              <StatCard
                title="Integrity Failures"
                value={stats.integrityWarnings || 0}
                subtitle="Cryptographic Mismatches"
                icon={Flame}
                color="red"
              />
            </div>

            {/* Severity Distribution Cards */}
            <div className="vault-card p-5 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Security Alerts by Threat Severity
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-red-950/20 border border-red-500/30 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-red-400 block">Critical</span>
                    <span className="text-xl font-black text-red-200">
                      {stats.eventsBySeverity?.CRITICAL || 0}
                    </span>
                  </div>
                  <Flame size={20} className="text-red-400" />
                </div>

                <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-400 block">High</span>
                    <span className="text-xl font-black text-amber-200">
                      {stats.eventsBySeverity?.HIGH || 0}
                    </span>
                  </div>
                  <AlertTriangle size={20} className="text-amber-400" />
                </div>

                <div className="bg-blue-950/20 border border-blue-500/30 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-blue-400 block">Medium</span>
                    <span className="text-xl font-black text-blue-200">
                      {stats.eventsBySeverity?.MEDIUM || 0}
                    </span>
                  </div>
                  <ShieldAlert size={20} className="text-blue-400" />
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Low / Info</span>
                    <span className="text-xl font-black text-slate-200">
                      {stats.eventsBySeverity?.LOW || 0}
                    </span>
                  </div>
                  <ShieldCheck size={20} className="text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Controlled Security Simulation Bar (Admin Only) */}
            {isAdmin && (
              <div className="vault-card p-4 border border-blue-500/20 bg-blue-950/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Controlled Threat Event Simulation (Demo Sandbox)
                    </h3>
                  </div>
                  <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    Admin Demonstration Tool
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Inject synthetic threat patterns to demonstrate real-time rule triggering, correlation, and automated incident creation.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    disabled={simulating}
                    onClick={() => handleRunSimulation('AUTH_BURST')}
                    className="vault-btn vault-btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 text-amber-300 hover:border-amber-400"
                  >
                    <Play size={12} /> Simulate Auth Brute Force
                  </button>

                  <button
                    disabled={simulating}
                    onClick={() => handleRunSimulation('DOC_UNAUTH')}
                    className="vault-btn vault-btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 text-cyan-300 hover:border-cyan-400"
                  >
                    <Play size={12} /> Simulate Document Harvest Probe
                  </button>

                  <button
                    disabled={simulating}
                    onClick={() => handleRunSimulation('INTEGRITY_TAMPER')}
                    className="vault-btn vault-btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 text-red-400 hover:border-red-500"
                  >
                    <Play size={12} /> Simulate Cryptographic Corrupt Alert
                  </button>
                </div>
              </div>
            )}

            {/* Recent Security Activity Stream */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert size={20} className="text-red-400" />
                  Recent Threat Detection Feed
                </h2>
                <button
                  onClick={() => setActiveTab('events')}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  View All in Explorer <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {recentEvents.length === 0 ? (
                  <div className="vault-card p-8 text-center text-slate-500 text-sm">
                    No recent security events detected in this time range.
                  </div>
                ) : (
                  recentEvents.map((evt) => {
                    const isCritical = evt.severity === 'CRITICAL' || evt.severity === 'HIGH';
                    return (
                      <div
                        key={evt.id}
                        className={`vault-card p-4 border transition-all ${
                          isCritical
                            ? 'border-red-500/40 bg-gradient-to-r from-red-950/20 via-slate-900 to-slate-950'
                            : 'border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={evt.severity} />
                              <span className="font-mono text-xs font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                {evt.id}
                              </span>
                              {evt.ruleId && (
                                <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                  {evt.ruleId}
                                </span>
                              )}
                              <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                <Clock size={12} /> {evt.timestamp}
                              </span>
                            </div>

                            <p className="text-sm font-semibold text-slate-200">
                              {evt.message}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <span>Actor: <strong className="text-white">{evt.user || 'Unknown'}</strong> ({evt.userRole || 'Staff'})</span>
                              <span>•</span>
                              <span>Resource: <strong className="text-cyan-400">{evt.document || evt.resourceName}</strong></span>
                              {evt.ip && evt.ip !== 'REDACTED' && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-slate-500">IP: {evt.ip}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {evt.status === 'Active' ? (
                              isAdmin ? (
                                <button
                                  onClick={() => handleMarkAsReviewed(evt.id)}
                                  className="vault-btn vault-btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5"
                                >
                                  <CheckCheck size={14} /> Review
                                </button>
                              ) : (
                                <span className="text-xs text-amber-400 font-medium">Active Alert</span>
                              )
                            ) : (
                              <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
                                <ShieldCheck size={13} /> Reviewed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: EVENT EXPLORER */}
        {/* ======================================================== */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {/* Filter Controls Bar */}
            <div className="vault-card p-4 border border-slate-800 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by actor, document, message, IP, or rule ID..."
                    value={explorerSearch}
                    onChange={(e) => {
                      setExplorerSearch(e.target.value);
                      setExplorerPage(1);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchExplorerData(); }}
                    className="vault-input pl-9 text-xs w-full"
                  />
                </div>

                {/* Dropdown Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={explorerSeverity}
                    onChange={(e) => { setExplorerSeverity(e.target.value); setExplorerPage(1); }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>

                  <select
                    value={explorerOutcome}
                    onChange={(e) => { setExplorerOutcome(e.target.value); setExplorerPage(1); }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200"
                  >
                    <option value="ALL">All Outcomes</option>
                    <option value="DENIED">Denied</option>
                    <option value="ALLOWED">Allowed</option>
                    <option value="FAILED">Failed</option>
                  </select>

                  <select
                    value={explorerRule}
                    onChange={(e) => { setExplorerRule(e.target.value); setExplorerPage(1); }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200"
                  >
                    <option value="ALL">All Rules</option>
                    <option value="RULE-AUTH-FAILED">Auth Brute Force</option>
                    <option value="RULE-DOC-UNAUTHORIZED">Unauthorized Docs</option>
                    <option value="RULE-SUSPICIOUS-PATTERN">Suspicious Pattern</option>
                    <option value="RULE-INTEGRITY-TAMPER">Integrity Failure</option>
                    <option value="RULE-ADMIN-CHANGE">Admin Change</option>
                  </select>

                  <button
                    onClick={() => {
                      setExplorerSearch('');
                      setExplorerSeverity('ALL');
                      setExplorerOutcome('ALL');
                      setExplorerRule('ALL');
                      setExplorerPage(1);
                    }}
                    className="vault-btn vault-btn-outline text-xs px-2.5 py-2 flex items-center gap-1"
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-850">
                <span>Total Filtered Records: <strong className="text-white">{explorerTotalCount}</strong></span>
                <span>Page {explorerPage} of {explorerTotalPages}</span>
              </div>
            </div>

            {/* Events List Table */}
            <div className="vault-card overflow-hidden border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Event ID</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Rule / Type</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Resource</th>
                      <th className="p-3">Outcome</th>
                      <th className="p-3">Explanation</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {explorerEvents.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-slate-500">
                          No matching security events found.
                        </td>
                      </tr>
                    ) : (
                      explorerEvents.map((evt) => (
                        <tr key={evt.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-white">{evt.id}</td>
                          <td className="p-3">
                            <StatusBadge status={evt.severity} />
                          </td>
                          <td className="p-3">
                            {evt.ruleId ? (
                              <span className="font-mono text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                {evt.ruleId}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 uppercase font-mono">{evt.type}</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-white">{evt.user || 'Unknown'}</div>
                            <div className="text-[10px] text-slate-400">{evt.userRole || 'Staff'}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-cyan-400 truncate max-w-[140px]">
                              {evt.document || evt.resourceName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">{evt.documentId || evt.resourceId}</div>
                          </td>
                          <td className="p-3">
                            <StatusBadge status={evt.outcome || (evt.severity === 'CRITICAL' ? 'BLOCKED' : 'ALLOWED')} />
                          </td>
                          <td className="p-3 max-w-[280px]">
                            <p className="text-slate-300 leading-snug line-clamp-2" title={evt.explanation || evt.message}>
                              {evt.explanation || evt.message}
                            </p>
                          </td>
                          <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                            {evt.timestamp}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                <button
                  disabled={explorerPage <= 1}
                  onClick={() => setExplorerPage(p => Math.max(1, p - 1))}
                  className="vault-btn vault-btn-outline text-xs px-3 py-1 flex items-center gap-1 disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                <span className="text-xs text-slate-400 font-mono">
                  Page {explorerPage} of {explorerTotalPages}
                </span>

                <button
                  disabled={explorerPage >= explorerTotalPages}
                  onClick={() => setExplorerPage(p => Math.min(explorerTotalPages, p + 1))}
                  className="vault-btn vault-btn-outline text-xs px-3 py-1 flex items-center gap-1 disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: INCIDENT CENTER */}
        {/* ======================================================== */}
        {activeTab === 'incidents' && (
          <div className="space-y-4">
            {!isInvestigator ? (
              <div className="vault-card p-8 text-center space-y-3 border border-amber-500/30 bg-amber-950/10">
                <ShieldAlert size={36} className="text-amber-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Investigator Access Required</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Incident management and forensic investigation workflows are restricted to authorized Administrators and Exam Coordinators.
                </p>
              </div>
            ) : (
              <>
                {/* Incident Filter Bar */}
                <div className="vault-card p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">Filter by Status:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['all', 'Open', 'Investigating', 'Resolved', 'False Positive'].map((st) => (
                        <button
                          key={st}
                          onClick={() => setIncidentStatusFilter(st)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                            incidentStatusFilter === st
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {st === 'all' ? 'All Statuses' : st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <select
                    value={incidentSeverityFilter}
                    onChange={(e) => setIncidentSeverityFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="all">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                {/* Incident Cards / Table */}
                <div className="space-y-3">
                  {incidents.length === 0 ? (
                    <div className="vault-card p-8 text-center text-slate-500 text-sm">
                      No security incidents found matching filter criteria.
                    </div>
                  ) : (
                    incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="vault-card p-5 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={inc.severity} />
                            <StatusBadge status={inc.status} />
                            <span className="font-mono text-xs font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {inc.id}
                            </span>
                            {inc.ruleId && (
                              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                {inc.ruleId}
                              </span>
                            )}
                            {inc.isSimulated && (
                              <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded">
                                Simulated
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-white">
                            {inc.title}
                          </h3>

                          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                            {inc.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                            <span>First Detected: <strong className="text-slate-300">{inc.firstDetectedAt}</strong></span>
                            <span>•</span>
                            <span>Last Activity: <strong className="text-slate-300">{inc.lastActivityAt}</strong></span>
                            <span>•</span>
                            <span>Assigned: <strong className="text-cyan-400">{inc.assignedTo || 'Unassigned'}</strong></span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Activity size={13} /> {inc.eventCount || 0} events
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <MessageSquare size={13} /> {inc.noteCount || 0} notes
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            onClick={() => {
                              fetchIncidentDetails(inc.id);
                              setIsIncidentModalOpen(true);
                            }}
                            className="vault-btn vault-btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
                          >
                            <Eye size={14} /> Investigate
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: DETECTION RULES */}
        {/* ======================================================== */}
        {activeTab === 'rules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders size={20} className="text-cyan-400" />
                  Deterministic Detection Rules
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-configured bounded heuristic rules continuously evaluating audit events for anomalous patterns.
                </p>
              </div>

              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
                5 Rules Active & Indexed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => (
                <div key={rule.ruleId} className="vault-card p-5 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {rule.ruleId}
                    </span>
                    <StatusBadge status={rule.severity} />
                  </div>

                  <h3 className="text-sm font-bold text-white">
                    {rule.name}
                  </h3>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {rule.description}
                  </p>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-850 space-y-1.5 text-xs text-slate-400">
                    <div className="font-mono text-[11px] text-slate-300">
                      <strong>Threshold Config:</strong>{' '}
                      {JSON.stringify(rule.thresholdConfig)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                      <span>Total Triggers: <strong className="text-white">{rule.triggerCount || 0}</strong></span>
                      <span>Last Triggered: <strong className="text-slate-300">{rule.lastTriggeredAt || 'Never'}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* INCIDENT DETAILS & INVESTIGATION MODAL */}
      {/* ======================================================== */}
      {isIncidentModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="vault-card w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-700 p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                    {selectedIncident.id}
                  </span>
                  <StatusBadge status={selectedIncident.severity} />
                  <StatusBadge status={selectedIncident.status} />
                  {selectedIncident.ruleId && (
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {selectedIncident.ruleId}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-white">{selectedIncident.title}</h2>
              </div>

              <button
                onClick={() => setIsIncidentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Description & Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300">
              <div className="md:col-span-2 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Description</span>
                <p className="leading-relaxed">{selectedIncident.description}</p>
                {selectedIncident.resolutionSummary && (
                  <div className="p-2.5 bg-emerald-950/20 border border-emerald-500/30 rounded text-emerald-300 text-xs">
                    <strong>Resolution Summary:</strong> {selectedIncident.resolutionSummary}
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-800 md:pl-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Assigned Investigator</span>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={assigneeInput}
                      onChange={(e) => setAssigneeInput(e.target.value)}
                      placeholder="Assignee name..."
                      className="vault-input text-xs py-1 px-2 w-full"
                    />
                    <button
                      onClick={handleAssignIncident}
                      className="vault-btn vault-btn-outline text-xs px-2 py-1 shrink-0"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Correlation Key</span>
                  <span className="font-mono text-[10px] text-slate-400 break-all">{selectedIncident.correlationKey || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Status Change Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-xs font-bold text-slate-400 mr-2">Workflow Actions:</span>

              {selectedIncident.status === 'Open' && (
                <button
                  onClick={() => handleUpdateIncidentStatus('Investigating')}
                  className="vault-btn vault-btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  <Activity size={13} /> Start Investigation
                </button>
              )}

              {selectedIncident.status !== 'Resolved' && (
                <button
                  onClick={() => setIsResolving(true)}
                  className="vault-btn text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 rounded-lg"
                >
                  <CheckCircle2 size={13} /> Resolve Incident
                </button>
              )}

              {selectedIncident.status !== 'False Positive' && (
                <button
                  onClick={() => handleUpdateIncidentStatus('False Positive', 'Marked as false positive after review.')}
                  className="vault-btn vault-btn-outline text-xs px-3 py-1.5 flex items-center gap-1 text-slate-300"
                >
                  <XCircle size={13} /> Mark False Positive
                </button>
              )}

              {(selectedIncident.status === 'Resolved' || selectedIncident.status === 'False Positive') && (
                <button
                  onClick={() => handleUpdateIncidentStatus('Investigating')}
                  className="vault-btn vault-btn-outline text-xs px-3 py-1.5 flex items-center gap-1 text-blue-400"
                >
                  <RotateCcw size={13} /> Reopen Incident
                </button>
              )}
            </div>

            {/* Resolve Modal / Prompt */}
            {isResolving && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 uppercase">Confirm Incident Resolution</h4>
                <textarea
                  value={resolutionSummaryInput}
                  onChange={(e) => setResolutionSummaryInput(e.target.value)}
                  placeholder="Enter resolution summary explaining investigative steps and root cause remediation..."
                  className="vault-input text-xs w-full h-20"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsResolving(false)}
                    className="vault-btn vault-btn-outline text-xs px-3 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateIncidentStatus('Resolved', resolutionSummaryInput)}
                    className="vault-btn text-xs px-3 py-1 bg-emerald-600 text-white rounded-lg"
                  >
                    Confirm Resolution
                  </button>
                </div>
              </div>
            )}

            {/* Linked Security Events */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-400" />
                Linked Security Alerts ({selectedIncident.events?.length || 0})
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedIncident.events?.length === 0 ? (
                  <p className="text-xs text-slate-500">No linked security alerts recorded.</p>
                ) : (
                  selectedIncident.events?.map((evt) => (
                    <div key={evt.id} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={evt.severity} />
                          <span className="font-mono text-white font-bold">{evt.id}</span>
                          <span className="text-slate-400 font-mono text-[11px]">{evt.timestamp}</span>
                        </div>
                        <p className="text-slate-300 mt-1">{evt.message}</p>
                      </div>
                      <span className="font-mono text-cyan-400 shrink-0">{evt.user}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Investigation Notes & Timeline */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-400" />
                Investigation Notes & Activity Timeline
              </h3>

              {/* Notes Timeline List */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {selectedIncident.notes?.map((n) => (
                  <div key={n.id} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <UserCheck size={12} className="text-cyan-400" />
                        {n.author} ({n.authorRole})
                      </span>
                      <span className="text-slate-500 font-mono">{n.timestamp}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{n.note}</p>
                  </div>
                ))}
              </div>

              {/* Add Note Form */}
              <div className="flex items-start gap-2 pt-2">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Record an investigation finding or evidence note..."
                  className="vault-input text-xs flex-1 h-16"
                />
                <button
                  onClick={handleAddNote}
                  className="vault-btn vault-btn-primary text-xs px-4 py-2 shrink-0 h-16"
                >
                  Post Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
      />
    </div>
  );
};

export default SecurityActivity;
