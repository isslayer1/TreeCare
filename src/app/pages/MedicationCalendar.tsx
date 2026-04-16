import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Calendar, CheckCircle, XCircle, FileText, Download, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTreeContext, MedicationScheduleEntry } from '../context/TreeContext';
import { Card } from '../components/ui/card';
import { Calendar as UICalendar } from '../components/ui/calendar';

export const MedicationCalendar = () => {
  const { medicationSchedule, setMedicationSchedule, loadMedicationSchedule, refreshMedicationMonths, saveMedicationSchedule, clearMedicationScheduleMonth, medicationMonths } = useTreeContext();
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPreviewMonth, setCurrentPreviewMonth] = useState<string>('');

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

  useEffect(() => {
    setCurrentPreviewMonth(selectedMonth);
  }, [selectedMonth]);

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
        await saveMedicationSchedule(schedule);

        // After saving, switch to the month of the uploaded file (assumes one month per CSV).
        const monthFromUpload = schedule[0]?.date?.slice(0, 7);
        if (monthFromUpload) {
          setSelectedMonth(monthFromUpload);
          await loadMedicationSchedule(monthFromUpload);
        } else if (selectedMonth) {
          await loadMedicationSchedule(selectedMonth);
        }

        setUploadStatus('success');
        setTimeout(() => setUploadStatus('idle'), 3000);
      } catch (error: any) {
        setUploadStatus('error');
        setErrorMessage(
          typeof error?.message === 'string' ? error.message : 'Error parsing or saving CSV file'
        );
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
    setCurrentPreviewMonth(month);
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


  const handleClear = async () => {
    if (!selectedMonth) return;
    try {
      await clearMedicationScheduleMonth(selectedMonth);
    } catch (error) {
      setErrorMessage('Failed to clear schedule');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <Calendar className="text-emerald-600" size={32} />
            <span>Medication Calendar</span>
          </h1>
          <p className="text-gray-500 mt-1">Upload your medication schedule to track applications</p>
        </div>
      </div>

      {/* Month Selector */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-sm font-semibold text-gray-800">Month</div>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
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
              onClick={handleClear}
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
                  <p className="text-sm text-gray-600">{medicationSchedule.length} entries loaded</p>
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
                    CSV Format: date,shouldApply,medicationType,recommendedBrand
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
                <li><code className="bg-blue-100 px-1 rounded">date</code> - Date in YYYY-MM-DD format (e.g., 2024-03-15)</li>
                <li><code className="bg-blue-100 px-1 rounded">shouldApply</code> - true/false, yes/no, or 1/0</li>
                <li><code className="bg-blue-100 px-1 rounded">medicationType</code> - Type of medication (e.g., Pesticide)</li>
                <li><code className="bg-blue-100 px-1 rounded">recommendedBrand</code> - (Optional) Brand name</li>
              </ul>
              <p className="mt-2"><strong>Example row:</strong></p>
              <code className="block bg-blue-100 px-2 py-1 rounded mt-1">2024-03-15,true,Pesticide,BrandA</code>
            </div>
          </div>
        </div>
      </Card>

      {/* Schedule Preview */}
      {medicationSchedule.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Schedule Preview</h2>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-semibold text-gray-800">Preview Month:</label>
            <select
              value={currentPreviewMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {isLoading && <span className="text-sm text-gray-500">Loading…</span>}
          </div>
          <div className="flex justify-center">
            <UICalendar
              month={currentPreviewMonth ? new Date(currentPreviewMonth + '-01') : undefined}
              onMonthChange={async (month) => {
                const m = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
                await handleMonthChange(m);
              }}
              modifiers={{
                medication: medicationSchedule.filter(e => e.shouldApply).map(e => new Date(e.date))
              }}
              modifiersClassNames={{
                medication: 'bg-purple-200 text-purple-800 font-semibold'
              }}
              className="rounded-md border"
            />
          </div>
        </Card>
      )}
    </div>
  );
};