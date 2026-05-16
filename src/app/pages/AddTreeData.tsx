import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTreeContext } from '../context/TreeContext';
import { ActionType, TreeRecord } from '../context/TreeContext';
import { Droplets, Syringe, Calendar as CalendarIcon, Check, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

type FormData = Omit<TreeRecord, 'id'>;

export const AddTreeData = () => {
  const { records, addRecord, updateRecord } = useTreeContext();
  const { control, register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    defaultValues: {
      date: '',
    },
  });
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editRecordId = searchParams.get('edit');

  const recordToEdit = useMemo(
    () => records.find((record) => record.id === editRecordId),
    [records, editRecordId]
  );
  const isEditing = Boolean(recordToEdit);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const formatDateForDisplay = (date: Date) => {
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const parseDisplayDateToIso = (value?: string | null) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!match) {
      return null;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = 2000 + Number(match[3]);
    const parsed = new Date(year, month - 1, day);

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }

    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  };

  const parseDisplayDateToDate = (value: string) => {
    const iso = parseDisplayDateToIso(value);
    if (!iso) {
      return undefined;
    }

    const parsed = new Date(`${iso}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  useEffect(() => {
    if (!recordToEdit) {
      reset({
        treeId: '',
        actionType: undefined,
        date: '',
        details: '',
        notes: '',
      });
      return;
    }

    const parsedDate = new Date(`${recordToEdit.date}T00:00:00`);
    reset({
      treeId: recordToEdit.treeId,
      actionType: recordToEdit.actionType,
      date: Number.isNaN(parsedDate.getTime()) ? '' : formatDateForDisplay(parsedDate),
      details: recordToEdit.details,
      notes: recordToEdit.notes || '',
    });
  }, [recordToEdit, reset]);

  const onSubmit = async (data: FormData) => {
    // Automatically set treeType to 'Olive'
    try {
      const normalizedDate = parseDisplayDateToIso(data.date);
      if (!normalizedDate) {
        toast.error('Date must be in DD/MM/YY format.');
        return;
      }

      if (isEditing && recordToEdit) {
        await updateRecord(recordToEdit.id, { ...data, date: normalizedDate, treeType: 'Olive' });
        navigate('/list');
      } else {
        await addRecord({ ...data, date: normalizedDate, treeType: 'Olive' });
      }
      setSuccess(true);
      if (!isEditing) {
        reset();
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      toast.error('Unable to save entry. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{isEditing ? 'Edit Activity' : 'Record New Activity'}</h1>
        <p className="text-gray-500">{isEditing ? 'Update the selected olive tree entry.' : 'Log irrigation or medication details for your olive trees.'}</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {isEditing ? 'Edit Entry Form' : 'New Entry Form'}
          </h2>
          <span className="text-sm text-emerald-600 font-medium">Step 1 of 1</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-6">
          {success && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <Check className="w-5 h-5 flex-shrink-0" />
              <p>Entry successfully recorded!</p>
            </div>
          )}

          {/* Tree ID - Full Width */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tree ID</label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. T-105"
                className={clsx(
                  "w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors",
                  errors.treeId ? "border-red-300 bg-red-50" : "border-gray-300"
                )}
                {...register("treeId", {
                  required: "Tree ID is required",
                  validate: (value) => value.trim().length > 0 || "Tree ID is required",
                })}
              />
              {errors.treeId && <AlertCircle className="w-4 h-4 text-red-500 absolute right-3 top-3" />}
            </div>
            {errors.treeId && <p className="text-xs text-red-500 mt-1">{errors.treeId.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Action Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Action Type</label>
              <div className="grid grid-cols-2 gap-4">
                <label className="cursor-pointer relative">
                  <input
                    type="radio"
                    value="Irrigation"
                    className="peer sr-only"
                    {...register("actionType", { required: "Required" })}
                  />
                  <div className="p-4 rounded-lg border-2 border-gray-200 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 hover:bg-gray-50 transition-all flex flex-col items-center justify-center text-center gap-2 h-full">
                    <Droplets className="w-6 h-6 text-blue-500" />
                    <span className="font-medium text-gray-700">Irrigation</span>
                  </div>
                </label>
                <label className="cursor-pointer relative">
                  <input
                    type="radio"
                    value="Medication"
                    className="peer sr-only"
                    {...register("actionType", { required: "Required" })}
                  />
                  <div className="p-4 rounded-lg border-2 border-gray-200 peer-checked:border-purple-600 peer-checked:bg-purple-50 hover:bg-gray-50 transition-all flex flex-col items-center justify-center text-center gap-2 h-full">
                    <Syringe className="w-6 h-6 text-purple-600" />
                    <span className="font-medium text-gray-700">Medication</span>
                  </div>
                </label>
              </div>
              {errors.actionType && <p className="text-xs text-red-500 mt-1">{errors.actionType.message}</p>}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date</label>
              <Controller
                control={control}
                name="date"
                rules={{
                  required: 'Date is required',
                  validate: (value) => {
                    const normalizedDate = parseDisplayDateToIso(value);
                    if (!normalizedDate) return 'Date must be selected from the calendar';
                    if (normalizedDate > todayStr) return 'Date cannot be in the future';
                    return true;
                  },
                }}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={clsx(
                          'w-full px-4 py-2.5 rounded-lg border text-left transition-colors flex items-center justify-between',
                          field.value ? 'border-gray-300 text-gray-900' : 'border-gray-300 text-gray-400',
                          errors.date ? 'border-red-300 bg-red-50' : 'focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
                        )}
                      >
                        <span>{field.value || 'Select a date'}</span>
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseDisplayDateToDate(field.value)}
                        onSelect={(date) => {
                          if (!date) return;
                          field.onChange(formatDateForDisplay(date));
                        }}
                        disabled={(date) => date > today}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Details (Amount/Medication Name)</label>
            <textarea
              placeholder="e.g. 50L water or 'Fungicide X' dosage"
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
              {...register("details", {
                required: "Details are required",
                validate: (value) => value.trim().length > 0 || "Details are required",
              })}
            ></textarea>
            {errors.details && <p className="text-xs text-red-500 mt-1">{errors.details.message}</p>}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Additional Notes (Optional)</label>
            <textarea
              placeholder="Any observations..."
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
              {...register("notes")}
            ></textarea>
          </div>

          <div className="pt-4 flex items-center justify-end gap-4">
             <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  navigate('/list');
                  return;
                }
                reset();
              }}
              className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isEditing ? 'Cancel' : 'Reset'}
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all focus:ring-4 focus:ring-emerald-200"
            >
              {isEditing ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};