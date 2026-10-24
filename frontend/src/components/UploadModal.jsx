import React, { useState, useRef } from 'react';
import { X, Upload, ShieldCheck, FileText, KeyRound, Paperclip, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UploadModal = ({ isOpen, onClose, onSuccess }) => {
  const { currentUser, showToast } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    sensitivity: 'High',
    content: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.name) {
        setFormData(prev => ({ ...prev, name: file.name }));
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name && !selectedFile) {
      showToast('Please provide a Document Name or choose a file to upload.', 'warning');
      return;
    }
    if (!formData.subject) {
      showToast('Please specify the Subject / Course.', 'warning');
      return;
    }

    setLoading(true);
    try {
      let res;

      if (selectedFile) {
        // Multipart binary file upload
        const bodyFormData = new FormData();
        bodyFormData.append('file', selectedFile);
        bodyFormData.append('name', formData.name || selectedFile.name);
        bodyFormData.append('subject', formData.subject);
        bodyFormData.append('sensitivity', formData.sensitivity);

        res = await fetch('/api/documents', {
          method: 'POST',
          // Notice: fetch automatically sets the multipart boundary header with FormData
          body: bodyFormData
        });
      } else {
        // JSON body simulation
        res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            owner: currentUser ? currentUser.name : "Dr. Priya Sharma",
            ownerRole: currentUser ? currentUser.role : "Exam Coordinator"
          })
        });
      }

      const data = await res.json();
      if (res.ok) {
        showToast(`Document secured successfully. SHA-256 fingerprint generated: ${data.document.fingerprint.substring(0, 10)}...`, 'success');
        onSuccess && onSuccess(data.document);
        onClose();
        setFormData({ name: '', subject: '', sensitivity: 'High', content: '' });
        setSelectedFile(null);
      } else {
        showToast(data.message || 'Failed to upload document', 'danger');
      }
    } catch (err) {
      showToast('Backend connection error', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="vault-card w-full max-w-lg overflow-hidden border border-blue-500/30 vault-glow-blue animate-in fade-in zoom-in duration-150">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-base">
            <Upload size={18} />
            Secure Document Upload & Sealing
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File Picker Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Examination File (PDF, DOCX, XLSX, TXT, PNG, JPG)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg"
              className="hidden"
              id="vault-file-upload-input"
            />
            {!selectedFile ? (
              <label
                htmlFor="vault-file-upload-input"
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl bg-slate-900/60 cursor-pointer transition-colors group"
              >
                <div className="p-2.5 rounded-full bg-blue-500/10 text-cyan-400 group-hover:scale-105 transition-transform mb-2">
                  <Paperclip size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Click to select file or drag into vault
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Supported formats: PDF, DOCX, XLSX, TXT (Max 10 MB)
                </span>
              </label>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{selectedFile.name}</div>
                    <div className="text-[10px] text-cyan-300 font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Binary'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-slate-400 hover:text-red-400 p-1.5 transition-colors"
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Document Title / Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Systems - Final Exam.pdf"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="vault-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Subject / Course *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Computer Science"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="vault-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Sensitivity Level
              </label>
              <select
                value={formData.sensitivity}
                onChange={(e) => setFormData({ ...formData, sensitivity: e.target.value })}
                className="vault-input cursor-pointer"
              >
                <option value="Critical">Critical (Highest Restricted)</option>
                <option value="High">High Confidential</option>
                <option value="Medium">Medium Evaluation</option>
              </select>
            </div>
          </div>

          {!selectedFile && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Document Text Content (Mock Payload Simulation)
              </label>
              <textarea
                rows={2}
                placeholder="Enter exam question text or mock contents if no binary file selected..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="vault-input resize-none"
              />
            </div>
          )}

          {/* SHA-256 Info Box */}
          <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-2.5">
            <KeyRound size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-cyan-300">Automated SHA-256 Cryptographic Sealing:</span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Upon submission, Node.js <code className="text-cyan-300 font-mono">crypto</code> will generate an immutable digest fingerprint, store the binary payload in the persistent vault, and initialize the active access policy.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="vault-btn vault-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="vault-btn vault-btn-primary">
              {loading ? 'Securing & Storing...' : 'Secure & Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
