import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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

interface TreeContextType {
  records: TreeRecord[];
  addRecord: (record: Omit<TreeRecord, 'id'>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  wateringSchedule: WateringScheduleEntry[];
  setWateringSchedule: (schedule: WateringScheduleEntry[]) => void;
  wateringMonths: string[];
  refreshWateringMonths: () => Promise<string[]>;
  loadWateringSchedule: (month: string) => Promise<WateringScheduleEntry[]>;
  saveWateringSchedule: (schedule: WateringScheduleEntry[]) => Promise<void>;
  clearWateringScheduleMonth: (month: string) => Promise<void>;
  getMissedIrrigationDates: () => string[];
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
  `http://${window.location.hostname}:8080/api`;

export const TreeProvider = ({ children }: { children: ReactNode }) => {
  const [records, setRecords] = useState<TreeRecord[]>([]);
  const [wateringSchedule, setWateringSchedule] = useState<WateringScheduleEntry[]>([]);
  const [wateringMonths, setWateringMonths] = useState<string[]>([]);

  const refreshWateringMonths = async (): Promise<string[]> => {
    try {
      const response = await fetch(`${API_BASE}/watering-schedule/months`);
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
      const response = await fetch(`${API_BASE}/watering-schedule?month=${encodeURIComponent(month)}`);
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
      const response = await fetch(`${API_BASE}/watering-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      if (!response.ok) throw new Error(`Failed to save watering schedule: ${response.status}`);
      await refreshWateringMonths();
    } catch (error) {
      console.error('Error saving watering schedule', error);
      throw error;
    }
  };

  const clearWateringScheduleMonth = async (month: string) => {
    try {
      const response = await fetch(`${API_BASE}/watering-schedule?month=${encodeURIComponent(month)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Failed to clear watering schedule: ${response.status}`);
      // If the currently selected schedule is this month, clear it from state too.
      setWateringSchedule((prev) => prev.filter((entry) => entry.date.slice(0, 7) !== month));
      await refreshWateringMonths();
    } catch (error) {
      console.error('Error clearing watering schedule month', error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await fetch(`${API_BASE}/records`);
        if (!response.ok) {
          throw new Error(`Failed to fetch records: ${response.status}`);
        }
        const data = await response.json();
        // Ensure we always store an array, never null/undefined
        if (Array.isArray(data)) {
          setRecords(data);
        } else {
          console.error('Unexpected records payload from API, expected array:', data);
        }
      } catch (error) {
        console.error('Error loading records from API', error);
      }
    };

    fetchRecords();
  }, []);

  const addRecord = async (record: Omit<TreeRecord, 'id'>) => {
    try {
      const response = await fetch(`${API_BASE}/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        throw new Error(`Failed to create record: ${response.status}`);
      }

      const created: TreeRecord = await response.json();
      setRecords((prev) => [created, ...prev]);
    } catch (error) {
      console.error('Error creating record via API', error);
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/records?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to delete record: ${response.status}`);
      }

      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Error deleting record via API', error);
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
      addRecord, 
      deleteRecord, 
      wateringSchedule, 
      setWateringSchedule,
      wateringMonths,
      refreshWateringMonths,
      loadWateringSchedule,
      saveWateringSchedule,
      clearWateringScheduleMonth,
      getMissedIrrigationDates 
    }}>
      {children}
    </TreeContext.Provider>
  );
};