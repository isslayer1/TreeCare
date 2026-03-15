import React, { useEffect, useMemo, useState } from 'react';
import { useTreeContext } from '../context/TreeContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { Leaf, Droplets, Activity, TrendingUp } from 'lucide-react';

export const Dashboard = () => {
  const { records, getMissedIrrigationDates, loadWateringSchedule, refreshWateringMonths, wateringMonths, isLoadingRecords, medicationSchedule, loadMedicationSchedule } = useTreeContext();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const currentMonth = useMemo(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  }, []);

  const monthOptions = useMemo(() => {
    const set = new Set([currentMonth, ...(wateringMonths || [])]);
    return Array.from(set).filter(Boolean).sort();
  }, [currentMonth, wateringMonths]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const months = await refreshWateringMonths();
      const options = Array.from(new Set([currentMonth, ...months])).filter(Boolean).sort();
      const initial = options.includes(currentMonth) ? currentMonth : options[options.length - 1] || currentMonth;
      setSelectedMonth(initial);
      await loadWateringSchedule(initial);
      await loadMedicationSchedule(initial);
      setIsLoading(false);
    })();
    // Run once on mount; avoid re-running whenever context callbacks change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthRecords = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return records.filter((r) => {
      if ((r.date || '').slice(0, 7) !== selectedMonth) return false;
      const recordDate = new Date(r.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() <= today.getTime();
    });
  }, [records, selectedMonth]);

  // Calculate stats
  const totalTrees = new Set(monthRecords.map(r => r.treeId)).size;
  const totalIrrigation = monthRecords.filter(r => r.actionType === 'Irrigation').length;
  const totalMedication = monthRecords.filter(r => r.actionType === 'Medication').length;
  
  // Get missed irrigation dates
  const missedIrrigationDates = getMissedIrrigationDates();
  
  // Prepare chart data
  const dataByDate = monthRecords.reduce((acc, curr) => {
    const date = curr.date;
    if (!acc[date]) {
      acc[date] = { date, irrigation: 0, medication: 0, missedIrrigation: 0, missedMedication: 0 };
    }
    if (curr.actionType === 'Irrigation') acc[date].irrigation += 1;
    if (curr.actionType === 'Medication') acc[date].medication += 1;
    return acc;
  }, {} as Record<string, { date: string; irrigation: number; medication: number; missedIrrigation: number; missedMedication: number }>);

  // Add missed irrigation dates to the chart data
  missedIrrigationDates
    .filter((date) => date.slice(0, 7) === selectedMonth)
    .forEach(date => {
    if (!dataByDate[date]) {
      dataByDate[date] = { date, irrigation: 0, medication: 0, missedIrrigation: 1, missedMedication: 0 };
    } else {
      dataByDate[date].missedIrrigation = 1;
    }
  });

  // Add missed medication dates to the chart data
  const now = new Date();
  const isAfter4PM = now.getHours() >= 16;
  medicationSchedule
    .filter(e => e.shouldApply)
    .filter(e => e.date.slice(0, 7) === selectedMonth)
    .filter(e => {
      const entryDate = new Date(e.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPast = entryDate < today;
      const isToday = entryDate.getTime() === today.getTime();
      return isPast || (isToday && isAfter4PM);
    })
    .filter(e => !records.some(r => r.date === e.date && r.actionType === 'Medication'))
    .forEach(e => {
      const date = e.date;
      if (!dataByDate[date]) {
        dataByDate[date] = { date, irrigation: 0, medication: 0, missedIrrigation: 0, missedMedication: 1 };
      } else {
        dataByDate[date].missedMedication = 1;
      }
    });

  const chartData = Object.values(dataByDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your orchard's health and activities.</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={async (e) => {
              const m = e.target.value;
              setSelectedMonth(m);
              setIsLoading(true);
              await loadWateringSchedule(m);
              setIsLoading(false);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-100">
            {isLoading ? 'Loading…' : `Month: ${selectedMonth || currentMonth}`}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Trees Managed" 
          value={isLoadingRecords ? '—' : totalTrees} 
          icon={<Leaf className="text-emerald-500" />} 
          trend="+5 this week"
        />
        <StatCard 
          title="Irrigation Events" 
          value={isLoadingRecords ? '—' : totalIrrigation} 
          icon={<Droplets className="text-blue-500" />} 
          trend="Avg 12/day"
        />
        <StatCard 
          title="Medication Applied" 
          value={isLoadingRecords ? '—' : totalMedication} 
          icon={<Activity className="text-purple-600" />} 
          trend="Last: 2 days ago"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
            <TrendingUp size={20} className="text-emerald-600" />
            <span>Activity Over Time</span>
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={256}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="date" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="irrigation" stroke="#3b82f6" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} name="Irrigation" />
                <Line type="monotone" dataKey="medication" stroke="#9333ea" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} name="Medication" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Activity Distribution</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={256}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="date" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Legend />
                <Bar dataKey="irrigation" stackId="activity" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Irrigation" />
                <Bar dataKey="missedIrrigation" stackId="activity" fill="#dc2626" name="Missed Irrigation" />
                <Bar dataKey="medication" stackId="activity" fill="#9333ea" name="Medication" />
                <Bar dataKey="missedMedication" stackId="activity" fill="#64748b" radius={[0, 0, 2, 2]} name="Missed Medication" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, trend }: { title: string; value: number | string; icon: React.ReactNode; trend: string }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
      </div>
      <div className="p-3 bg-gray-50 rounded-lg">
        {icon}
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">{trend}</span>
    </div>
  </div>
);