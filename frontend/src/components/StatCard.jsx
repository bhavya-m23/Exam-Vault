import React from 'react';
import { useNavigate } from 'react-router-dom';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = "blue", linkTo }) => {
  const navigate = useNavigate();

  const colorStyles = {
    blue: {
      border: 'hover:border-blue-500/50',
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]'
    },
    green: {
      border: 'hover:border-emerald-500/50',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
    },
    red: {
      border: 'hover:border-red-500/50',
      iconBg: 'bg-red-500/10 text-red-400 border-red-500/20',
      glow: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]'
    },
    amber: {
      border: 'hover:border-amber-500/50',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]'
    }
  };

  const style = colorStyles[color] || colorStyles.blue;

  return (
    <div
      onClick={() => linkTo && navigate(linkTo)}
      className={`vault-card p-5 cursor-pointer transition-all duration-200 border border-slate-800/80 ${style.border} ${style.glow}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold text-white mt-1.5 font-mono">{value}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-3.5 rounded-xl border ${style.iconBg} flex items-center justify-center`}>
            <Icon size={24} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
