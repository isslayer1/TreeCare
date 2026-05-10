import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTreeContext } from '../context/TreeContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { Leaf, Droplets, Activity, TrendingUp, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

export const Dashboard = () => {
  const { records, getMissedIrrigationDates, loadWateringSchedule, refreshWateringMonths, wateringMonths, isLoadingRecords, medicationSchedule, medicationMonths, loadMedicationSchedule, refreshMedicationMonths } = useTreeContext();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const currentMonth = useMemo(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  }, []);

  const recordMonths = useMemo(() => {
    const months = new Set<string>();
    records.forEach((record) => {
      if (typeof record.date !== 'string' || record.date.length < 7) return;
      months.add(record.date.slice(0, 7));
    });
    return Array.from(months).sort();
  }, [records]);

  const monthOptions = useMemo(() => {
    const set = new Set([currentMonth, ...recordMonths, ...(wateringMonths || []), ...(medicationMonths || [])]);
    return Array.from(set).filter(Boolean).sort();
  }, [currentMonth, medicationMonths, recordMonths, wateringMonths]);

  const handleMonthChange = async (month: string) => {
    setSelectedMonth(month);
    setIsLoading(true);
    try {
      await Promise.all([
        loadWateringSchedule(month),
        loadMedicationSchedule(month),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const [waterMonths, medMonths] = await Promise.all([
        refreshWateringMonths(),
        refreshMedicationMonths(),
      ]);
      const options = Array.from(new Set([currentMonth, ...recordMonths, ...waterMonths, ...medMonths])).filter(Boolean).sort();
      const initial = options.includes(currentMonth) ? currentMonth : options[options.length - 1] || currentMonth;
      setSelectedMonth(initial);
      await Promise.all([
        loadWateringSchedule(initial),
        loadMedicationSchedule(initial),
      ]);
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

  const missedMedicationDates = useMemo(() => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isAfter4PM = now.getHours() >= 16;

    return medicationSchedule
      .filter((entry) => entry.shouldApply)
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        const isPast = entryDate.getTime() < today.getTime();
        const isToday = entryDate.getTime() === today.getTime();
        return isPast || (isToday && isAfter4PM);
      })
      .filter((entry) => !records.some((record) => record.date === entry.date && record.actionType === 'Medication'))
      .map((entry) => entry.date);
  }, [medicationSchedule, records]);
  
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
  missedMedicationDates
    .filter((date) => date.slice(0, 7) === selectedMonth)
    .forEach((date) => {
      if (!dataByDate[date]) {
        dataByDate[date] = { date, irrigation: 0, medication: 0, missedIrrigation: 0, missedMedication: 1 };
      } else {
        dataByDate[date].missedMedication = 1;
      }
    });

  const chartData = Object.values(dataByDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const irrigationRecordsForMonth = useMemo(
    () => monthRecords.filter((record) => record.actionType === 'Irrigation'),
    [monthRecords],
  );

  const medicationRecordsForMonth = useMemo(
    () => monthRecords.filter((record) => record.actionType === 'Medication'),
    [monthRecords],
  );

  const missedIrrigationForMonth = useMemo(
    () => missedIrrigationDates.filter((date) => date.slice(0, 7) === selectedMonth).sort(),
    [missedIrrigationDates, selectedMonth],
  );

  const missedMedicationForMonth = useMemo(
    () => missedMedicationDates.filter((date) => date.slice(0, 7) === selectedMonth).sort(),
    [missedMedicationDates, selectedMonth],
  );

  const generatePdfReport = async () => {
    if (!reportRef.current || !selectedMonth) return;

    setIsGeneratingReport(true);

    const generateFallbackPdf = () => {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 12;
      let y = 14;

      const ensureSpace = (needed = 7) => {
        if (y + needed > pageHeight - 12) {
          pdf.addPage();
          y = 14;
        }
      };

      const addLine = (text: string, fontSize = 10, extra = 6) => {
        ensureSpace(extra);
        pdf.setFontSize(fontSize);
        pdf.text(text, marginX, y);
        y += extra;
      };

      const addSectionTitle = (title: string) => {
        ensureSpace(8);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, marginX, y);
        pdf.setFont('helvetica', 'normal');
        y += 7;
      };

      addSectionTitle('TreeCare Monthly Report');
      addLine(`Month: ${selectedMonth}`);
      addLine(`Generated on: ${new Date().toLocaleString()}`);

      y += 2;
      addSectionTitle('Summary');
      addLine(`Trees Managed: ${totalTrees}`);
      addLine(`Irrigation Events: ${totalIrrigation}`);
      addLine(`Medication Events: ${totalMedication}`);

      y += 2;
      addSectionTitle('Activity Trend (Date | Irrigation | Medication | Missed Irrigation | Missed Medication)');
      if (chartData.length === 0) {
        addLine('No activity for this month.');
      } else {
        chartData.forEach((row) => {
          addLine(`${formatDisplayDate(row.date)} | ${row.irrigation} | ${row.medication} | ${row.missedIrrigation} | ${row.missedMedication}`, 9, 5);
        });
      }

      y += 2;
      addSectionTitle(`Irrigation Records (${selectedMonth})`);
      if (irrigationRecordsForMonth.length === 0) {
        addLine('No irrigation records for this month.');
      } else {
        irrigationRecordsForMonth.forEach((record) => {
          addLine(`${formatDisplayDate(record.date)} | ${record.treeId} | ${record.details} | ${record.notes || '-'}`, 9, 5);
        });
      }
      addLine(`Missed irrigation dates: ${missedIrrigationForMonth.length ? missedIrrigationForMonth.join(', ') : 'None'}`, 9, 5);

      y += 2;
      addSectionTitle(`Medication Records (${selectedMonth})`);
      if (medicationRecordsForMonth.length === 0) {
        addLine('No medication records for this month.');
      } else {
        medicationRecordsForMonth.forEach((record) => {
          addLine(`${formatDisplayDate(record.date)} | ${record.treeId} | ${record.details} | ${record.notes || '-'}`, 9, 5);
        });
      }
      addLine(`Missed medication dates: ${missedMedicationForMonth.length ? missedMedicationForMonth.join(', ') : 'None'}`, 9, 5);

      addLine('Note: Graph image rendering was skipped due browser canvas capture limitations.', 8, 5);
      pdf.save(`treecare-monthly-report-${selectedMonth}.pdf`);
    };

    try {
      // Give charts a moment to settle before capture.
      await new Promise((resolve) => setTimeout(resolve, 200));

      const canvas = await html2canvas(reportRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      const imgWidth = printableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let positionY = margin;

      pdf.addImage(imgData, 'PNG', margin, positionY, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= printableHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        positionY = margin - (imgHeight - heightLeft);
        pdf.addImage(imgData, 'PNG', margin, positionY, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= printableHeight;
      }

      pdf.save(`treecare-monthly-report-${selectedMonth}.pdf`);
      toast.success(`PDF report generated for ${selectedMonth}`);
    } catch (error: any) {
      console.error('Failed to generate visual PDF report', error);
      try {
        generateFallbackPdf();
        toast.success(`PDF report generated for ${selectedMonth} (fallback mode)`);
      } catch (fallbackError) {
        console.error('Failed to generate fallback PDF report', fallbackError);
        const reason = typeof error?.message === 'string' ? `: ${error.message}` : '';
        toast.error(`Failed to generate PDF report${reason}`);
      }
    } finally {
      setIsGeneratingReport(false);
    }
  };

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
            onChange={(e) => handleMonthChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={generatePdfReport}
            disabled={isGeneratingReport || isLoading || !selectedMonth}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            <span>{isGeneratingReport ? 'Generating PDF…' : 'Generate PDF Report'}</span>
          </button>
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
                <XAxis dataKey="date" tickFormatter={formatDisplayDate} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                  labelFormatter={formatDisplayDate}
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
                <XAxis dataKey="date" tickFormatter={formatDisplayDate} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} labelFormatter={formatDisplayDate} />
                <Legend />
                <Bar dataKey="irrigation" stackId="activity" fill="#10b981" radius={[2, 2, 0, 0]} name="Irrigation" />
                <Bar dataKey="missedIrrigation" stackId="activity" fill="#f87171" name="Missed Irrigation" />
                <Bar dataKey="medication" stackId="activity" fill="#8b5cf6" name="Medication" />
                <Bar dataKey="missedMedication" stackId="activity" fill="#94a3b8" radius={[0, 0, 2, 2]} name="Missed Medication" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hidden report surface for PDF generation */}
      <div className="fixed left-0 top-0 opacity-0 pointer-events-none -z-10">
        <div ref={reportRef} className="w-[1000px] bg-white text-gray-900 p-10 space-y-8">
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-3xl font-bold">TreeCare Monthly Report</h2>
            <p className="text-gray-600 mt-1">Month: {selectedMonth}</p>
            <p className="text-gray-500 text-sm mt-1">Generated on: {new Date().toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-xs uppercase text-gray-500">Trees Managed</div>
              <div className="text-2xl font-semibold mt-1">{totalTrees}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-xs uppercase text-gray-500">Irrigation Events</div>
              <div className="text-2xl font-semibold mt-1">{totalIrrigation}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-xs uppercase text-gray-500">Medication Events</div>
              <div className="text-2xl font-semibold mt-1">{totalMedication}</div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Activity Over Time</h3>
            <LineChart width={920} height={280} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={formatDisplayDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={formatDisplayDate} />
              <Legend />
              <Line type="monotone" dataKey="irrigation" stroke="#3b82f6" strokeWidth={2} name="Irrigation" dot={false} />
              <Line type="monotone" dataKey="medication" stroke="#9333ea" strokeWidth={2} name="Medication" dot={false} />
            </LineChart>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Activity Distribution</h3>
            <BarChart width={920} height={280} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={formatDisplayDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={formatDisplayDate} />
              <Legend />
              <Bar dataKey="irrigation" stackId="activity" fill="#10b981" name="Irrigation" />
              <Bar dataKey="missedIrrigation" stackId="activity" fill="#f87171" name="Missed Irrigation" />
              <Bar dataKey="medication" stackId="activity" fill="#8b5cf6" name="Medication" />
              <Bar dataKey="missedMedication" stackId="activity" fill="#94a3b8" name="Missed Medication" />
            </BarChart>
          </div>

          <section>
            <h3 className="text-lg font-semibold mb-3">Irrigation Data ({selectedMonth})</h3>
            <div className="mb-3 text-sm text-gray-700">Completed irrigation records: {irrigationRecordsForMonth.length}</div>
            <table className="w-full text-sm border border-gray-200 border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1 text-left">Date</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Tree ID</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Details</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {irrigationRecordsForMonth.length === 0 && (
                  <tr>
                    <td className="border border-gray-200 px-2 py-1" colSpan={4}>No irrigation records for this month.</td>
                  </tr>
                )}
                {irrigationRecordsForMonth.map((record) => (
                  <tr key={record.id}>
                    <td className="border border-gray-200 px-2 py-1">{formatDisplayDate(record.date)}</td>
                    <td className="border border-gray-200 px-2 py-1">{record.treeId}</td>
                    <td className="border border-gray-200 px-2 py-1">{record.details}</td>
                    <td className="border border-gray-200 px-2 py-1">{record.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3">
              <div className="text-sm font-semibold">Missed irrigation dates: {missedIrrigationForMonth.length}</div>
              <div className="text-sm text-gray-700">{missedIrrigationForMonth.length ? missedIrrigationForMonth.join(', ') : 'None'}</div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Medication Data ({selectedMonth})</h3>
            <div className="mb-3 text-sm text-gray-700">Completed medication records: {medicationRecordsForMonth.length}</div>
            <table className="w-full text-sm border border-gray-200 border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1 text-left">Date</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Tree ID</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Medication</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {medicationRecordsForMonth.length === 0 && (
                  <tr>
                    <td className="border border-gray-200 px-2 py-1" colSpan={4}>No medication records for this month.</td>
                  </tr>
                )}
                {medicationRecordsForMonth.map((record) => (
                  <tr key={record.id}>
                    <td className="border border-gray-200 px-2 py-1">{formatDisplayDate(record.date)}</td>
                    <td className="border border-gray-200 px-2 py-1">{record.treeId}</td>
                    <td className="border border-gray-200 px-2 py-1">{record.details}</td>
                    <td className="border border-gray-200 px-2 py-1">{record.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3">
              <div className="text-sm font-semibold">Missed medication dates: {missedMedicationForMonth.length}</div>
              <div className="text-sm text-gray-700">{missedMedicationForMonth.length ? missedMedicationForMonth.join(', ') : 'None'}</div>
            </div>
          </section>
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