import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { getAuthToken } from './AuthContext';

export type ActionType = 'Irrigation' | 'Medication';

export interface TreeRecord {
  id: string;
  treeId: string;
  treeType: string;
  actionType: ActionType;
  details: string; // Amount for irrigation, Medication name for medication
  date: string;
  notes?: string;
}

export interface WateringScheduleEntry {
  date: string; // YYYY-MM-DD format
  shouldIrrigate: boolean;
  treeId?: string; // optional, if schedule is per tree
}

export interface MedicationScheduleEntry {
  date: string; // YYYY-MM-DD format
  shouldApply: boolean;
  medicationType: string;
  recommendedBrand: string;
}

interface TreeContextType {
  records: TreeRecord[];
  isLoadingRecords: boolean;
  addRecord: (record: Omit<TreeRecord, 'id'>) => Promise<void>;
  updateRecord: (id: string, record: Omit<TreeRecord, 'id'>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  wateringSchedule: WateringScheduleEntry[];
  setWateringSchedule: (schedule: WateringScheduleEntry[]) => void;
  wateringMonths: string[];
  refreshWateringMonths: () => Promise<string[]>;
  loadWateringSchedule: (month: string) => Promise<WateringScheduleEntry[]>;
  saveWateringSchedule: (schedule: WateringScheduleEntry[]) => Promise<void>;
  clearWateringScheduleMonth: (month: string) => Promise<void>;
  getMissedIrrigationDates: () => string[];
  medicationSchedule: MedicationScheduleEntry[];
  setMedicationSchedule: (schedule: MedicationScheduleEntry[]) => void;
  medicationMonths: string[];
  refreshMedicationMonths: () => Promise<string[]>;
  loadMedicationSchedule: (month: string) => Promise<MedicationScheduleEntry[]>;
  saveMedicationSchedule: (schedule: MedicationScheduleEntry[]) => Promise<void>;
  clearMedicationScheduleMonth: (month: string) => Promise<void>;
}

const TreeContext = createContext<TreeContextType | undefined>(undefined);

export const useTreeContext = () => {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error('useTreeContext must be used within a TreeProvider');
  }
  return context;
};

// Point the frontend to the backend running on the same host (works for localhost and LAN IP)
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ||
  "/api";

export const TreeProvider = ({ children }: { children: ReactNode }) => {
  const [records, setRecords] = useState<TreeRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [wateringSchedule, setWateringSchedule] = useState<WateringScheduleEntry[]>([]);
  const [wateringMonths, setWateringMonths] = useState<string[]>([]);
  const [medicationSchedule, setMedicationSchedule] = useState<MedicationScheduleEntry[]>([]);
  const [medicationMonths, setMedicationMonths] = useState<string[]>([]);

  const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const token = getAuthToken();
    const headers = new Headers(init?.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
    return response;
  };

  const refreshWateringMonths = async (): Promise<string[]> => {
    try {
      const response = await apiFetch(`/watering-schedule/months`);
      if (!response.ok) throw new Error(`Failed to fetch watering months: ${response.status}`);
      const months = (await response.json()) as string[];
      const normalized = Array.isArray(months) ? months.filter(Boolean).sort() : [];
      setWateringMonths(normalized);
      return normalized;
    } catch (error) {
      console.error('Error loading watering schedule months', error);
      setWateringMonths([]);
      return [];
    }
  };

  const loadWateringSchedule = async (month: string): Promise<WateringScheduleEntry[]> => {
    try {
      const response = await apiFetch(`/watering-schedule?month=${encodeURIComponent(month)}`);
      if (!response.ok) throw new Error(`Failed to fetch watering schedule: ${response.status}`);
      const entries = (await response.json()) as WateringScheduleEntry[];
      const normalized = Array.isArray(entries) ? entries : [];
      setWateringSchedule(normalized);
      return normalized;
    } catch (error) {
      console.error('Error loading watering schedule', error);
      setWateringSchedule([]);
      return [];
    }
  };

  const saveWateringSchedule = async (schedule: WateringScheduleEntry[]) => {
    try {
      const response = await apiFetch(`/watering-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Failed to save watering schedule (${response.status})`;
        throw new Error(message);
      }
      await refreshWateringMonths();
    } catch (error) {
      console.error('Error saving watering schedule', error);
      toast.error('Failed to save watering schedule');
      throw error;
    }
  };

  const clearWateringScheduleMonth = async (month: string) => {
    try {
      const response = await apiFetch(`/watering-schedule?month=${encodeURIComponent(month)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Failed to clear watering schedule (${response.status})`;
        throw new Error(message);
      }
      // If the currently selected schedule is this month, clear it from state too.
      setWateringSchedule((prev) => prev.filter((entry) => entry.date.slice(0, 7) !== month));
      await refreshWateringMonths();
      toast.success('Schedule cleared');
    } catch (error) {
      console.error('Error clearing watering schedule month', error);
      toast.error('Failed to clear schedule');
      throw error;
    }
  };

  const refreshMedicationMonths = async (): Promise<string[]> => {
    try {
      const response = await apiFetch(`/medication-schedule/months`);
      if (!response.ok) throw new Error(`Failed to fetch medication months: ${response.status}`);
      const months = (await response.json()) as string[];
      const normalized = Array.isArray(months) ? months.filter(Boolean).sort() : [];
      setMedicationMonths(normalized);
      return normalized;
    } catch (error) {
      console.error('Error fetching medication months', error);
      toast.error('Failed to load medication months');
      throw error;
    }
  };

  const loadMedicationSchedule = async (month: string): Promise<MedicationScheduleEntry[]> => {
    try {
      const response = await apiFetch(`/medication-schedule?month=${encodeURIComponent(month)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Failed to fetch medication schedule (${response.status})`;
        throw new Error(message);
      }
      const schedule = (await response.json()) as MedicationScheduleEntry[];
      const normalized = Array.isArray(schedule) ? schedule : [];
      setMedicationSchedule(normalized);
      return normalized;
    } catch (error) {
      console.error('Error loading medication schedule', error);
      toast.error('Failed to load medication schedule');
      throw error;
    }
  };

  const saveMedicationSchedule = async (schedule: MedicationScheduleEntry[]): Promise<void> => {
    try {
      const response = await apiFetch(`/medication-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Failed to save medication schedule (${response.status})`;
        throw new Error(message);
      }
      const result = await response.json();
      toast.success(`Medication schedule saved (${result.inserted} entries)`);
      await refreshMedicationMonths();
    } catch (error) {
      console.error('Error saving medication schedule', error);
      toast.error('Failed to save medication schedule');
      throw error;
    }
  };

  const clearMedicationScheduleMonth = async (month: string): Promise<void> => {
    try {
      const response = await apiFetch(`/medication-schedule?month=${encodeURIComponent(month)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Failed to clear medication schedule (${response.status})`;
        throw new Error(message);
      }
      // If the currently selected schedule is this month, clear it from state too.
      setMedicationSchedule((prev) => prev.filter((entry) => entry.date.slice(0, 7) !== month));
      await refreshMedicationMonths();
      toast.success('Medication schedule cleared');
    } catch (error) {
      console.error('Error clearing medication schedule month', error);
      toast.error('Failed to clear medication schedule');
      throw error;
    }
  };

  useEffect(() => {
    const fetchRecords = async () => {
      setIsLoadingRecords(true);
      try {
        const response = await apiFetch(`/records`);
        if (!response.ok) {
          throw new Error(`Failed to fetch records: ${response.status}`);
        }
        const data = await response.json();
        // Ensure we always store an array, never null/undefined
        if (Array.isArray(data)) {
          setRecords(data);
        } else {
          console.error('Unexpected records payload from API, expected array:', data);
          toast.error('Unexpected response when loading records');
        }
      } catch (error) {
        console.error('Error loading records from API', error);
        toast.error('Unable to load records. Please check your connection.');
      } finally {
        setIsLoadingRecords(false);
      }
    };

    fetchRecords();
    // Run once for provider mount; provider itself only mounts on authenticated routes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addRecord = async (record: Omit<TreeRecord, 'id'>) => {
    try {
      const response = await apiFetch(`/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Failed to create record (${response.status})`;
        throw new Error(message);
      }

      const created: TreeRecord = await response.json();
      setRecords((prev) => [created, ...prev]);
      toast.success('Record saved');
    } catch (error) {
      console.error('Error creating record via API', error);
      toast.error('Failed to save record');
      throw error;
    }
  };

  const updateRecord = async (id: string, record: Omit<TreeRecord, 'id'>) => {
    try {
      const response = await apiFetch(`/records/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Failed to update record (${response.status})`;
        throw new Error(message);
      }

      const updated: TreeRecord = await response.json();
      setRecords((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
      toast.success('Record updated');
    } catch (error) {
      console.error('Error updating record via API', error);
      toast.error('Failed to update record');
      throw error;
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const response = await apiFetch(`/records/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Failed to delete record (${response.status})`;
        throw new Error(message);
      }

      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success('Record deleted');
    } catch (error) {
      console.error('Error deleting record via API', error);
      toast.error('Failed to delete record');
      throw error;
    }
  };

  const getMissedIrrigationDates = (): string[] => {
    const missedDates: string[] = [];
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Treat the "end of day" as 16:00 local time.
    // Before 16:00, today's irrigation should not be considered missed yet.
    const endOfDayCutoff = new Date(today);
    endOfDayCutoff.setHours(16, 0, 0, 0);

    wateringSchedule.forEach(scheduleEntry => {
      if (!scheduleEntry.shouldIrrigate) return;

      const scheduleDate = new Date(scheduleEntry.date);
      scheduleDate.setHours(0, 0, 0, 0);

      const isBeforeToday = scheduleDate.getTime() < today.getTime();
      const isToday = scheduleDate.getTime() === today.getTime();

      // Past days are always eligible; today becomes eligible only after 16:00; future days never.
      const eligibleToBeMissed =
        isBeforeToday || (isToday && now.getTime() >= endOfDayCutoff.getTime());

      if (!eligibleToBeMissed) return;

      // Check if there's an irrigation record for this date
      const hasIrrigation = records.some(
        record => record.actionType === 'Irrigation' && record.date === scheduleEntry.date
      );
      
      if (!hasIrrigation) {
        missedDates.push(scheduleEntry.date);
      }
    });
    
    return missedDates;
  };

  return (
    <TreeContext.Provider value={{ 
      records, 
      isLoadingRecords,
      addRecord, 
      updateRecord,
      deleteRecord, 
      wateringSchedule, 
      setWateringSchedule,
      wateringMonths,
      refreshWateringMonths,
      loadWateringSchedule,
      saveWateringSchedule,
      clearWateringScheduleMonth,
      getMissedIrrigationDates,
      medicationSchedule,
      setMedicationSchedule,
      medicationMonths,
      refreshMedicationMonths,
      loadMedicationSchedule,
      saveMedicationSchedule,
      clearMedicationScheduleMonth
    }}>
      {children}
    </TreeContext.Provider>
  );
};