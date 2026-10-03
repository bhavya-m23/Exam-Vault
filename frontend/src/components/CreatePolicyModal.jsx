import React, { useState } from 'react';
import { X, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const CreatePolicyModal = ({ isOpen, onClose, documents = [], onSuccess }) => {
  const { currentUser, showToast } = useAuth();
  const [formData, setFormData] = useState({
    documentId: documents.length > 0 ? documents[0].id : '',
    allowedRoles: ['Exam Coordinator'],
    allowedActions: ['VIEW', 'DOWNLOAD'],
    purpose: 'Exam Preparation',
    startTime: '09:00',
    endTime: '18:00'
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const roleOptions = ["Administrator", "Exam Coordinator", "Course Instructor", "Exam Evaluator", "Staff"];
  const actionOptions = ["VIEW", "DOWNLOAD", "EDIT", "SHARE"];

  const toggleRole = (role) => {
    setFormData(prev => {
      const exists = prev.allowedRoles.includes(role);
      const updated = exists 
        ? prev.allowedRoles.filter(r => r !== role)
        : [...prev.allowedRoles, role];
      return { ...prev, allowedRoles: updated };
    });
  };

  const toggleAction = (action) => {
    setFormData(prev => {
      const exists = prev.allowedActions.includes(action);
      const updated = exists 
        ? prev.allowedActions.filter(a => a !== action)
        : [...prev.allowedActions, action];
      return { ...prev, allowedActions: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.documentId) {
      showToast('Select a document for this policy', 'warning');
      return;
    }
    if (formData.allowedRoles.length === 0) {
      showToast('Select at least one allowed role', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          user: currentUser ? currentUser.name : "Administrator",
          userRole: currentUser ? currentUser.role : "Administrator"
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Access policy ${data.policy.id} created successfully!`, 'success');
        onSuccess && onSuccess(data.policy);
        onClose();
      } else {
        showToast(data.message || 'Failed to create policy', 'danger');
      }
    } catch (err) {
      showToast('Backend connection error', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="vault-card w-full max-w-lg overflow-hidden border border-cyan-500/30 vault-glow-blue animate-in fade-in zoom-in duration-150">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <Lock size={18} />
            Create Context-Aware Access Policy
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Target Document *
            </label>
            <select
              value={formData.documentId}
              onChange={(e) => setFormData({ ...formData, documentId: e.target.value })}
              className="vault-input cursor-pointer"
              required
            >
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  [{d.id}] {d.name} ({d.subject})
                </option>
              ))}
            </select>
          </div>

          {/* Allowed Roles Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Allowed User Roles *
            </label>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map(role => {
                const isSelected = formData.allowedRoles.includes(role);
                return (
                  <button
                    type="button"
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allowed Actions */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Permitted Actions *
            </label>
            <div className="flex flex-wrap gap-2">
              {actionOptions.map(act => {
                const isSelected = formData.allowedActions.includes(act);
                return (
                  <button
                    type="button"
                    key={act}
                    onClick={() => toggleAction(act)}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-bold border transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {act}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Authorized Purpose
            </label>
            <select
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="vault-input cursor-pointer"
            >
              <option value="Exam Preparation">Exam Preparation</option>
              <option value="Internal Review">Internal Review</option>
              <option value="Evaluation">Evaluation</option>
              <option value="Secure Archival">Secure Archival</option>
            </select>
          </div>

          {/* Time Window */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Start Time (HH:MM)
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="vault-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                End Time (HH:MM)
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="vault-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="vault-btn vault-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="vault-btn vault-btn-primary">
              {loading ? 'Creating...' : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePolicyModal;
