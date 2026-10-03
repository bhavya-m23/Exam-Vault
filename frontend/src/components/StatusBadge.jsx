import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, Clock, Lock } from 'lucide-react';

export const StatusBadge = ({ status }) => {
  if (!status) return null;

  const normalized = String(status).toUpperCase();

  switch (normalized) {
    case 'ALLOWED':
    case 'VERIFIED':
    case 'PROTECTED':
    case 'ACTIVE':
    case 'INTEGRITY_VERIFIED':
      return (
        <span className="badge badge-allowed">
          <CheckCircle2 size={12} />
          {status}
        </span>
      );

    case 'BLOCKED':
    case 'INTEGRITY_COMPROMISED':
    case 'UNAUTHORIZED':
      return (
        <span className="badge badge-blocked">
          <XCircle size={12} />
          {status}
        </span>
      );

    case 'WARNING':
    case 'MEDIUM':
    case 'SUSPICIOUS':
      return (
        <span className="badge badge-warning">
          <AlertTriangle size={12} />
          {status}
        </span>
      );

    case 'CRITICAL':
    case 'HIGH':
      return (
        <span className="badge badge-critical">
          <ShieldAlert size={12} />
          {status}
        </span>
      );

    case 'LOW':
    case 'REVIEWED':
    case 'RESOLVED':
      return (
        <span className="badge badge-info">
          <ShieldCheck size={12} />
          {status}
        </span>
      );

    default:
      return (
        <span className="badge badge-info">
          {status}
        </span>
      );
  }
};

export default StatusBadge;
