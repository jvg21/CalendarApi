export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin';
  created_at: string;
}

export interface Instance {
  id: string;
  name: string;
  email: string;
  phone?: string;
  business_hours: BusinessHours;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  start_time: string; // "09:00"
  end_time: string;   // "18:00"
  break_start?: string; // "12:00"
  break_end?: string;   // "13:00"
}

export interface Calendar {
  id: string;
  instance_id: string;
  google_calendar_id: string;
  name: string;
  description?: string;
  priority: number; // 1 = highest priority
  color?: string;
  is_active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  instance_id: string;
  name: string;
  description?: string;
  duration: number; // minutes
  buffer_before: number; // minutes
  buffer_after: number; // minutes
  price?: number;
  is_active: boolean;
  created_at: string;
}
export interface Appointment {
  id: string;
  instance_id: string;
  calendar_id: string;
  service_id: string;
  google_event_id: string;
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime?: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  
  // NOVOS CAMPOS ADICIONADOS
  flow_id?: number;
  agent_id?: number;
  user_id?: number;
  
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentRequest {
  instance_id: string;
  service_id: string;
  start_datetime: string;
  end_datetime?: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  description?: string;
  calendar_id?: string;
  
  // NOVOS CAMPOS ADICIONADOS
  flow_id?: number;
  agent_id?: number;
  user_id?: number;
}

export interface AvailabilityRequest {
  instance_id: string;
  service_id: string;
  start_date: string;
  end_date: string;
  calendar_ids?: string[];
}

export interface TimeSlot {
  start_datetime: string;
  end_datetime: string;
  calendar_id: string;
  calendar_name: string;
  priority: number;
}

export interface PreferenceOptions {
  strategy: 'earliest' | 'latest' | 'least_fragmented' | 'priority_calendar';
  preferred_times?: string[]; // ["09:00", "14:00"]
  avoid_times?: string[];
  max_suggestions?: number;
}
// Interfaces para o novo método checkSpecificSlot
export interface SlotCheckRequest {
  instance_id: string;
  service_id: string;
  start_datetime: string;
  calendar_ids?: string[]; // Opcional - se não fornecido, usa todos os calendários
}

export interface SlotCheckResponse {
  available: boolean;
  service_name: string;
  start_datetime: string;
  end_datetime: string;
  calendar_id: string;
  calendar_name: string;
  conflict_reason?: string;
}