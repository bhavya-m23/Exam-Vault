import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import UploadModal from '../components/UploadModal';
import RequestAccessModal from '../components/RequestAccessModal';
import { 
  FileText, 
  Upload, 
  ShieldCheck, 
  Eye, 
  CheckCircle2, 
  KeyRound,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Documents = () => {
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      showToast('Error loading documents from vault', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleVerifyIntegrity = async (doc, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/documents/${doc.id}/verify`, { method: 'POST' });
      const data = await res.json();
      if (data.verified) {
        showToast(`✓ INTEGRITY VERIFIED for ${doc.name}`, 'success');
      } else {
        showToast(`⚠ INTEGRITY WARNING: Fingerprint mismatch!`, 'danger');
      }
      fetchDocuments();
    } catch (err) {
      showToast('Error verifying integrity', 'danger');
    }
  };

  const columns = [
    {
      header: 'Document Name & ID',
      accessorKey: 'name',
      cell: (row) => (
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
            <FileText size={18} />
          </div>
          <div>
            <div 
              onClick={() => navigate(`/documents/${row.id}`)}
              className="font-bold text-white hover:text-blue-400 cursor-pointer transition-colors"
            >
              {row.name}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              ID: {row.id} • Version v{row.version}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Subject',
      accessorKey: 'subject',
      cell: (row) => (
        <span className="font-medium text-slate-200">{row.subject}</span>
      )
    },
    {
      header: 'Owner',
      accessorKey: 'owner',
      cell: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-200">{row.owner}</div>
          <div className="text-[10px] text-cyan-400 font-mono">{row.ownerRole || 'Faculty'}</div>
        </div>
      )
    },
    {
      header: 'Sensitivity',
      accessorKey: 'sensitivity',
      cell: (row) => <StatusBadge status={row.sensitivity} />
    },
    {
      header: 'SHA-256 Fingerprint',
      accessorKey: 'fingerprint',
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
          <KeyRound size={12} className={row.isTampered ? 'text-red-400' : 'text-cyan-400'} />
          <span className={row.isTampered ? 'text-red-400 font-bold' : ''}>
            {row.fingerprint ? `${row.fingerprint.substring(0, 8)}...${row.fingerprint.substring(row.fingerprint.length - 6)}` : 'sha256...'}
          </span>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.isTampered ? 'INTEGRITY_COMPROMISED' : row.status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/documents/${row.id}`)}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-blue-400 hover:text-blue-300 rounded border border-slate-800 transition-colors"
            title="View Details & Access Policy"
          >
            <Eye size={15} />
          </button>

          <button
            onClick={(e) => handleVerifyIntegrity(row, e)}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 rounded border border-slate-800 transition-colors"
            title="Verify SHA-256 Integrity"
          >
            <CheckCircle2 size={15} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex-1 min-w-0 pb-12">
      <Header
        title="Secure Document Vault"
        subtitle="Repository of SHA-256 sealed examination documents"
        onOpenRequestModal={() => setIsRequestModalOpen(true)}
      />

      <main className="p-6 space-y-6">
        {/* Top Control Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Protected Examination Documents</h2>
            <p className="text-xs text-slate-400">Total {documents.length} examination files active</p>
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
              onClick={() => setIsUploadModalOpen(true)}
              className="vault-btn vault-btn-primary text-xs"
            >
              <Upload size={14} />
              Upload Document
            </button>
          </div>
        </div>

        {/* Documents Table */}
        <DataTable
          columns={columns}
          data={documents}
          searchPlaceholder="Search by document name, subject, or owner..."
          searchKey="name"
          onRefresh={fetchDocuments}
        />
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchDocuments}
      />

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        documents={documents}
      />
    </div>
  );
};

export default Documents;
