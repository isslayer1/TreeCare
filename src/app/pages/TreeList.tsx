import React, { useMemo, useState } from 'react';
import { useTreeContext } from '../context/TreeContext';
import { Search, Filter, Trash2, Pencil, Droplets, Syringe, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router';

export const TreeList = () => {
  const { records, deleteRecord, isLoadingRecords } = useTreeContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const formatDisplayDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = String(parsed.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    records.forEach((record) => {
      const date = new Date(record.date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(month);
    });
    return ['All', ...Array.from(months).sort()];
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      // Only search by treeId since type is always Olive
      const matchesSearch = record.treeId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'All' || record.actionType === filterType;
      const matchesMonth = selectedMonth === 'All' || record.date.startsWith(selectedMonth);
      return matchesSearch && matchesFilter && matchesMonth;
    });
  }, [records, searchTerm, filterType, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Examine Data</h1>
          <p className="text-gray-500 mt-1">View and manage all recorded olive tree activities.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
           <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Tree ID..."
              className="pl-10 pr-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
            <select
              className="pl-10 pr-8 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none bg-white"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="All">All Actions</option>
              <option value="Irrigation">Irrigation</option>
              <option value="Medication">Medication</option>
            </select>
          </div>
          <div className="relative">
            <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
            <select
              className="pl-10 pr-8 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none bg-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month === 'All' ? 'All Months' : month}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="px-6 py-4">Tree ID</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoadingRecords ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-48" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4" />
                  </tr>
                ))
              ) : paginatedRecords.length > 0 ? (
                paginatedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{record.treeId}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {record.actionType === 'Irrigation' ? (
                          <Droplets className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Syringe className="w-4 h-4 text-purple-600" />
                        )}
                        <span className={clsx(
                          "text-sm font-medium",
                          record.actionType === 'Irrigation' ? "text-blue-700" : "text-purple-700"
                        )}>
                          {record.actionType}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={record.details}>
                      {record.details}
                      {record.notes && <span className="block text-xs text-gray-400 mt-1 truncate">{record.notes}</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {formatDisplayDate(record.date)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/add?edit=${record.id}`)}
                          className="text-gray-400 hover:text-emerald-600 transition-colors p-2 rounded-full hover:bg-emerald-50"
                          title="Edit Record"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteRecord(record.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <Search className="w-8 h-8 text-gray-300" />
                       <p>No records found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between text-sm text-gray-500 gap-2">
          <span>
            Showing {paginatedRecords.length} of {filteredRecords.length} records
          </span>
          <div className="flex gap-2 items-center">
            <button
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
            <button
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};