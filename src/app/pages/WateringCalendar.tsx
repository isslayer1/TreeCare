import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Calendar, CheckCircle, XCircle, FileText, Download, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTreeContext, WateringScheduleEntry } from '../context/TreeContext';
import { Card } from '../components/ui/card';

export const WateringCalendar = () => {
  const { wateringSchedule, loadWateringSchedule, refreshWateringMonths, saveWateringSchedule, clearWateringScheduleMonth, wateringMonths } = useTreeContext();
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      setIsLoading(false);
    })();
    // We intentionally run this only once on mount so the month list
    // isn't re-fetched on every render when context callbacks change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseCSV = (text: string): WateringScheduleEntry[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const entries: WateringScheduleEntry[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',').map(col => col.trim());
      
      // Expected format: date,shouldIrrigate,treeId (optional)
      // Example: 2023-10-01,true,T-101 OR 2023-10-01,yes OR 2023-10-01,1
      if (columns.length >= 2) {
        const date = columns[0];
        const shouldIrrigateRaw = columns[1].toLowerCase();
        const shouldIrrigate = shouldIrrigateRaw === 'true' || 
                              shouldIrrigateRaw === 'yes' || 
                              shouldIrrigateRaw === '1';
        const treeId = columns[2] || undefined;
        
        entries.push({ date, shouldIrrigate, treeId });
      }
    }
    
    return entries;
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setUploadStatus('error');
      setErrorMessage('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const schedule = parseCSV(text);
        
        if (schedule.length === 0) {
          setUploadStatus('error');
          setErrorMessage('No valid data found in CSV');
          return;
        }

        // Save to database so it persists across refreshes.
        await saveWateringSchedule(schedule);

        // After saving, switch to the month of the uploaded file (assumes one month per CSV).
        const monthFromUpload = schedule[0]?.date?.slice(0, 7);
        if (monthFromUpload) {
          setSelectedMonth(monthFromUpload);
          await loadWateringSchedule(monthFromUpload);
        } else if (selectedMonth) {
          await loadWateringSchedule(selectedMonth);
        }

        setUploadStatus('success');
        setTimeout(() => setUploadStatus('idle'), 3000);
      } catch (error) {
        setUploadStatus('error');
        setErrorMessage('Error parsing or saving CSV file');
      }
    };
    
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const downloadSampleCSV = () => {
    const sampleData = `date,shouldIrrigate,treeId
2024-02-23,true,T-101
2024-02-24,false,T-101
2024-02-25,true,T-101
2024-02-26,true,T-102
2024-02-27,false,T-102
2024-02-28,true,T-103`;
    
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watering_schedule_sample.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <Calendar className="text-emerald-600" size={32} />
            <span>Watering Calendar</span>
          </h1>
          <p className="text-gray-500 mt-1">Upload your irrigation schedule to track missed waterings</p>
        </div>
      </div>

      {/* Month Selector */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-sm font-semibold text-gray-800">Month</div>
            <select
              value={selectedMonth}
              onChange={async (e) => {
                const m = e.target.value;
                setSelectedMonth(m);
                setIsLoading(true);
                await loadWateringSchedule(m);
                setIsLoading(false);
              }}
              className="w-full sm:w-56 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {isLoading && <span className="text-sm text-gray-500">Loading…</span>}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="text-xs text-gray-500">
              Uploading a new CSV for the same month will <span className="font-semibold">replace</span> its schedule.
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={async () => {
                if (!selectedMonth) return;
                const confirmed = window.confirm(`Clear all watering schedule entries for ${selectedMonth}?`);
                if (!confirmed) return;
                setIsLoading(true);
                try {
                  await clearWateringScheduleMonth(selectedMonth);
                  await loadWateringSchedule(selectedMonth);
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear this month</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Upload Section */}
      <Card className="p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Upload CSV Schedule</h2>
            <Button
              onClick={downloadSampleCSV}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Download size={16} />
              <span>Download Sample</span>
            </Button>
          </div>

          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
              dragActive 
                ? 'border-emerald-500 bg-emerald-50' 
                : uploadStatus === 'success'
                ? 'border-green-500 bg-green-50'
                : uploadStatus === 'error'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleChange}
              className="hidden"
            />

            <div className="space-y-4">
              {uploadStatus === 'success' ? (
                <>
                  <CheckCircle className="mx-auto text-green-600" size={48} />
                  <p className="text-green-700 font-medium">Schedule uploaded successfully!</p>
                  <p className="text-sm text-gray-600">{wateringSchedule.length} entries loaded</p>
                </>
              ) : uploadStatus === 'error' ? (
                <>
                  <XCircle className="mx-auto text-red-600" size={48} />
                  <p className="text-red-700 font-medium">{errorMessage}</p>
                  <Button onClick={handleButtonClick} variant="outline">
                    Try Again
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="mx-auto text-gray-400" size={48} />
                  <div>
                    <p className="text-lg font-medium text-gray-700">
                      Drag and drop your CSV file here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">or</p>
                  </div>
                  <Button onClick={handleButtonClick} className="bg-emerald-600 hover:bg-emerald-700">
                    <FileText size={16} className="mr-2" />
                    Browse Files
                  </Button>
                  <div className="text-xs text-gray-400 mt-4">
                    CSV Format: date,shouldIrrigate,treeId (optional)
                  </div>
                </>
              )}
            </div>
          </div>

          {/* CSV Format Guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
              <FileText size={16} />
              <span>CSV Format Guide</span>
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Required columns:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><code className="bg-blue-100 px-1 rounded">date</code> - Date in YYYY-MM-DD format (e.g., 2024-02-23)</li>
                <li><code className="bg-blue-100 px-1 rounded">shouldIrrigate</code> - true/false, yes/no, or 1/0</li>
                <li><code className="bg-blue-100 px-1 rounded">treeId</code> - (Optional) Tree identifier (e.g., T-101)</li>
              </ul>
              <p className="mt-2"><strong>Example row:</strong></p>
              <code className="block bg-blue-100 px-2 py-1 rounded mt-1">2024-02-23,true,T-101</code>
            </div>
          </div>
        </div>
      </Card>

      {/* Schedule Preview */}
      {wateringSchedule.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Schedule Preview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Should Irrigate</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Tree ID</th>
                </tr>
              </thead>
              <tbody>
                {wateringSchedule.slice(0, 10).map((entry, index) => (
                  <tr key={index} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">{entry.date}</td>
                    <td className="px-4 py-3">
                      {entry.shouldIrrigate ? (
                        <span className="flex items-center space-x-1 text-green-600">
                          <CheckCircle size={16} />
                          <span>Yes</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-gray-500">
                          <XCircle size={16} />
                          <span>No</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.treeId || 'All trees'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {wateringSchedule.length > 10 && (
              <p className="text-sm text-gray-500 mt-3 text-center">
                Showing 10 of {wateringSchedule.length} entries
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
