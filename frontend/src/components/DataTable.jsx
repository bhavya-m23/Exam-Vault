import React, { useState } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';

export const DataTable = ({
  columns,
  data,
  searchPlaceholder = "Search records...",
  searchKey = "name",
  filterOptions = [],
  activeFilter = "ALL",
  onFilterChange,
  emptyMessage = "No matching records found.",
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter data based on search and active filter tab
  const filteredData = data.filter((item) => {
    const matchesSearch = searchKey
      ? String(item[searchKey] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.document || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(item.user || '').toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    return matchesSearch;
  });

  return (
    <div className="vault-card overflow-hidden">
      {/* Table Header Bar with Search & Filter Tabs */}
      <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="vault-input pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          {filterOptions.length > 0 && (
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onFilterChange && onFilterChange(opt.value)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    activeFilter === opt.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="vault-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={col.className || ''}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row, rowIdx) => (
                <tr key={row.id || rowIdx} className="transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={col.className || ''}>
                      {col.cell ? col.cell(row) : row[col.accessorKey]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Filter size={24} className="text-slate-600 stroke-[1.5]" />
                    <p className="text-sm font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between items-center">
        <span>Showing {filteredData.length} of {data.length} records</span>
        <span className="font-mono">ExamVault Audit Engine</span>
      </div>
    </div>
  );
};

export default DataTable;
