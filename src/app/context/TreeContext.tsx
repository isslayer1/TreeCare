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

// Mock initial data - Only Olives as requested
const initialData: TreeRecord[] = [
  { id: '1', treeId: 'T-101', treeType: 'Olive', actionType: 'Irrigation', details: '50L', date: '2023-10-01', notes: 'Routine check' },
  { id: '2', treeId: 'T-102', treeType: 'Olive', actionType: 'Medication', details: 'Fungicide X', date: '2023-10-02', notes: 'Spotted some spots' },
  { id: '3', treeId: 'T-101', treeType: 'Olive', actionType: 'Irrigation', details: '45L', date: '2023-10-05' },
  { id: '4', treeId: 'T-103', treeType: 'Olive', actionType: 'Irrigation', details: '60L', date: '2023-10-06' },
  { id: '5', treeId: 'T-102', treeType: 'Olive', actionType: 'Irrigation', details: '55L', date: '2023-10-07' },
];

export const TreeProvider = ({ children }: { children: ReactNode }) => {
  const [records, setRecords] = useState<TreeRecord[]>(initialData);
  const [wateringSchedule, setWateringSchedule] = useState<WateringScheduleEntry[]>([]);

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
    
    wateringSchedule.forEach(scheduleEntry => {
      if (scheduleEntry.shouldIrrigate) {
        // Check if there's an irrigation record for this date
        const hasIrrigation = records.some(
          record => record.actionType === 'Irrigation' && record.date === scheduleEntry.date
        );
        
        if (!hasIrrigation) {
          missedDates.push(scheduleEntry.date);
        }
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
      getMissedIrrigationDates 
    }}>
      {children}
    </TreeContext.Provider>
  );
};