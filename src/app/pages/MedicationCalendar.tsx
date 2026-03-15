import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Calendar, CheckCircle, XCircle, FileText, Download, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTreeContext, MedicationScheduleEntry } from '../context/TreeContext';
import { Card } from '../components/ui/card';

export const MedicationCalendar = () => {
  const { medicationSchedule, setMedicationSchedule, loadMedicationSchedule, refreshMedicationMonths, saveMedicationSchedule, clearMedicationScheduleMonth, medicationMonths } = useTreeContext();
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
    const set = new Set([currentMonth, ...(medicationMonths || [])]);
    return Array.from(set).filter(Boolean).sort();
  }, [currentMonth, medicationMonths]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const months = await refreshMedicationMonths();
        const options = Array.from(new Set([currentMonth, ...months])).filter(Boolean).sort();
        const initial = options.includes(currentMonth) ? currentMonth : options[options.length - 1] || currentMonth;
        setSelectedMonth(initial);
        await loadMedicationSchedule(initial);
      } catch (error) {
        console.error('Error loading medication calendar data:', error);
        setErrorMessage('Failed to load calendar data');
      } finally {
        setIsLoading(false);
      }
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

  const parseCSV = (text: string): MedicationScheduleEntry[] => {
    const lines = text
      .split('\n')
      .map((line) => line.replace(/\r/g, '').trim())
      .filter((line) => line);

    const entries: MedicationScheduleEntry[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const columns = line.split(',').map((col) => col.trim());

      // Expected format: date,shouldApply,medicationType,recommendedBrand
      // Example: 2023-10-01,true,Pesticide,BrandA
      if (columns.length >= 4) {
        const date = columns[0];
        const shouldApplyRaw = columns[1].toLowerCase();
        const shouldApply =
          shouldApplyRaw === 'true' ||
          shouldApplyRaw === 'yes' ||
          shouldApplyRaw === '1';
        const medicationType = columns[2];
        const recommendedBrand = columns[3];

        entries.push({ date, shouldApply, medicationType, recommendedBrand });
      }
    }

    return entries;
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setUploadStatus('error');
          setErrorMessage('No valid entries found in CSV');
          return;
        }
        setUploadStatus('success');
        setErrorMessage('');
        // Set the parsed schedule in context
        setMedicationSchedule(parsed);
      } catch (error) {
        setUploadStatus('error');
        setErrorMessage('Failed to parse CSV');
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
    const csvContent = `Date,ShouldApply,MedicationType,RecommendedBrand
2023-10-01,true,Pesticide,BrandA
2023-10-02,false,,`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medication_schedule_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMonthChange = async (month: string) => {
    setSelectedMonth(month);
    setIsLoading(true);
    try {
      await loadMedicationSchedule(month);
    } catch (error) {
      console.error('Error loading medication schedule for month:', error);
      setErrorMessage('Failed to load schedule for selected month');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (medicationSchedule.length === 0) {
      setErrorMessage('No schedule to save');
      return;
    }
    try {
      await saveMedicationSchedule(medicationSchedule);
      setUploadStatus('success');
      setErrorMessage('');
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage('Failed to save schedule');
    }
  };

  const handleClear = async () => {
    if (!selectedMonth) return;
    try {
      await clearMedicationScheduleMonth(selectedMonth);
    } catch (error) {
      setErrorMessage('Failed to clear schedule');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Medication Calendar</h1>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <label htmlFor="month-select" className="font-medium">Select Month:</label>
          <select
            id="month-select"
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="border rounded px-3 py-1"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <Button onClick={downloadSampleCSV} variant="outline" className="mr-2">
            <Download className="h-4 w-4 mr-2" />
            Download Sample CSV
          </Button>
          <Button onClick={handleClear} variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Month
          </Button>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg mb-2">Drag and drop your CSV file here</p>
          <p className="text-sm text-gray-500 mb-4">or</p>
          <Button onClick={handleButtonClick} variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Select File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleChange}
            className="hidden"
          />
          <div className="text-xs text-gray-400 mt-4">
            CSV Format: Date,ShouldApply,MedicationType,RecommendedBrand
          </div>
        </div>

        {/* CSV Format Guide */}
        <Card className="mt-6 p-4 bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">CSV Format Guide</h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div>
              <strong>Columns (in order):</strong>
              <ol className="list-decimal list-inside mt-1 ml-4 space-y-1">
                <li><strong>Date</strong> - Format: YYYY-MM-DD (e.g., 2024-03-15)</li>
                <li><strong>ShouldApply</strong> - true/false, yes/no, or 1/0</li>
                <li><strong>MedicationType</strong> - Type of medication (e.g., Pesticide, Fungicide)</li>
                <li><strong>RecommendedBrand</strong> - Brand name or leave empty</li>
              </ol>
            </div>
            <div>
              <strong>Example:</strong>
              <pre className="bg-white p-2 rounded mt-1 text-xs overflow-x-auto">
{`Date,ShouldApply,MedicationType,RecommendedBrand
2024-03-15,true,Pesticide,BrandA`}</pre>
            </div>
          </div>
        </Card>

        {uploadStatus === 'success' && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <CheckCircle className="h-5 w-5 text-green-500 inline mr-2" />
            CSV uploaded successfully. Preview below.
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <XCircle className="h-5 w-5 text-red-500 inline mr-2" />
            {errorMessage}
          </div>
        )}

        <div className="mt-4">
          <Button onClick={handleSave} disabled={medicationSchedule.length === 0}>
            Save Schedule
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Schedule Preview</h2>
        <div className="flex items-center gap-4 mb-4">
          <label htmlFor="preview-month-select" className="font-medium">Examine Data for Month:</label>
          <select
            id="preview-month-select"
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="border rounded px-3 py-1"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <p>Loading...</p>
        ) : medicationSchedule.length === 0 ? (
          <p>No schedule for this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2">Date</th>
                  <th className="border border-gray-300 px-4 py-2">Should Apply</th>
                  <th className="border border-gray-300 px-4 py-2">Medication Type</th>
                  <th className="border border-gray-300 px-4 py-2">Recommended Brand</th>
                </tr>
              </thead>
              <tbody>
                {medicationSchedule.map((entry, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-4 py-2">{entry.date}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      {entry.shouldApply ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">{entry.medicationType}</td>
                    <td className="border border-gray-300 px-4 py-2">{entry.recommendedBrand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};