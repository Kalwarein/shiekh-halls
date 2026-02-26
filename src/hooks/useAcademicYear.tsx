import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AcademicYear {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AcademicYearContextType {
  academicYears: AcademicYear[];
  activeYear: AcademicYear | null;
  selectedYearId: string | null;
  setSelectedYearId: (id: string) => void;
  isLoading: boolean;
  createYear: (name: string) => Promise<void>;
  setActiveYear: (id: string) => Promise<void>;
  updateYear: (id: string, name: string) => Promise<void>;
  deleteYear: (id: string) => Promise<void>;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export const useAcademicYear = () => {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error('useAcademicYear must be used within AcademicYearProvider');
  }
  return context;
};

export const AcademicYearProvider = ({ children }: { children: ReactNode }) => {
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: academicYears = [], isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .order('name', { ascending: false });
      if (error) throw error;
      return data as AcademicYear[];
    },
  });

  const activeYear = academicYears.find(y => y.is_active) || null;

  // Auto-select active year
  useEffect(() => {
    if (!selectedYearId && activeYear) {
      setSelectedYearId(activeYear.id);
    }
  }, [activeYear, selectedYearId]);

  const createYear = async (name: string) => {
    const { error } = await supabase
      .from('academic_years')
      .insert({ name });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['academic-years'] });
  };

  const setActiveYearFn = async (id: string) => {
    // Deactivate all first
    await supabase.from('academic_years').update({ is_active: false }).neq('id', '');
    // Activate selected
    const { error } = await supabase
      .from('academic_years')
      .update({ is_active: true })
      .eq('id', id);
    if (error) throw error;
    setSelectedYearId(id);
    queryClient.invalidateQueries({ queryKey: ['academic-years'] });
  };

  const updateYear = async (id: string, name: string) => {
    const { error } = await supabase
      .from('academic_years')
      .update({ name })
      .eq('id', id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['academic-years'] });
  };

  const deleteYear = async (id: string) => {
    const { error } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['academic-years'] });
  };

  return (
    <AcademicYearContext.Provider
      value={{
        academicYears,
        activeYear,
        selectedYearId,
        setSelectedYearId,
        isLoading,
        createYear,
        setActiveYear: setActiveYearFn,
        updateYear,
        deleteYear,
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
};
