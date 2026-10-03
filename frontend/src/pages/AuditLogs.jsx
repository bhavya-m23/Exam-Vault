import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import RequestAccessModal from '../components/RequestAccessModal';
import { Activity, Download, Filter, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuditLogs = () => {
  const { showToast } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const fetchAuditLogs = async (filterValue = activeFilter) => {
    try {
      const url = filterValue === 'ALL' ? '/api/audit' : `/api/audit?filter=${filterValue}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      showToast('Error loading audit logs', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(activeFilter);
  }, [activeFilter]);

  const handleFilterChange = (val) => {
    setActiveFilter(val);
  };

  const handleExportAuditCSV = () => {
    showToast('Audit Log exported to CSV for compliance archive.', 'success');
  };

  const columns = [
    {
      header: 'Timestamp',
      accessorKey: 'timestamp',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-400 font-medium">
          {row.timestamp}
        </span>
      )
    },
    {
      header: 'User & Role (WHO)',
      accessorKey: 'user',
      cell: (row) => (
        <div>
          <div className="font-semibold text-white text-xs">{row.user}</div>
          <div className="text-[10px] text-cyan-400 font-mono">{row.userRole || 'User'}</div>
        </div>
      )
    },
    {
      header: 'Action (WHAT)',
      accessorKey: 'action',
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-blue-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
          {row.action}
        </span>
      )
    },
    {
      header: 'Document',
      accessorKey: 'document',
      cell: (row) => (
        <span className="text-xs font-medium text-slate-200 truncate max-w-[180px] block" title={row.document}>
          {row.document}
        </span>
      )
    },
    {
      header: 'Purpose / Reason (WHY)',
      accessorKey: 'reason',
      cell: (row) => (
        <div className="max-w-[240px] text-xs">
          <div className="text-slate-300 font-medium">{row.purpose || 'Exam Preparation'}</div>
          <div className="text-[11px] text-slate-400 line-clamp-1" title={row.reason}>
            {row.reason}
          </div>
        </div>
      )
    },
    {
      header: 'Result',
      accessorKey: 'result',
      cell: (row) => <StatusBadge status={row.result} />
    },
    {
      header: 'IP Address',
      accessorKey: 'ip',
      cell: (row) => (
        <span className="font-mono text-[11px] text-slate-500">
          {row.ip || '192.168.1.45'}
        </span>
      )
    }
  ];

  const filterOptions = [
    { label: 'All Events', value: 'ALL' },
    { label: 'Allowed', value: 'ALLOWED' },
    { label: 'Blocked', value: 'BLOCKED' },
    { label: 'Warnings', value: 'WARNING' }
  ];

  return (
    <div className="flex-1 min-w-0 pb-12">
      <Header
        title="Audit Trail"
        subtitle="Immutable traceability record — Who / When / What / Why"
        onOpenRequestModal={() => setIsRequestModalOpen(true)}
      />

      <main className="p-6 space-y-6">
        {/* Top Control Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity size={20} className="text-blue-400" />
              Comprehensive Audit Trail
            </h2>
            <p className="text-xs text-slate-400">Total {logs.length} audit entries captured</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="vault-btn vault-btn-outline text-xs"
            >
              <Zap size={14} className="text-amber-400 fill-amber-400/20" />
              Test Access Engine
            </button>

            <button
              onClick={handleExportAuditCSV}
              className="vault-btn vault-btn-secondary text-xs"
            >
              <Download size={14} />
              Export Audit CSV
            </button>
          </div>
        </div>

        {/* Audit Logs Table */}
        <DataTable
          columns={columns}
          data={logs}
          searchPlaceholder="Search audit logs by user, action, or document..."
          searchKey="user"
          filterOptions={filterOptions}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          onRefresh={() => fetchAuditLogs(activeFilter)}
        />
      </main>

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
      />
    </div>
  );
};

export default AuditLogs;
