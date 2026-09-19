export const CATEGORIA_ATENDIMENTO = {
  TODOS: 'TODOS',
  PRIMEIRA_VIA: '1_VIA',
  SEGUNDA_VIA: '2_VIA'
} as const;

export type CategoriaAtendimento = typeof CATEGORIA_ATENDIMENTO[keyof typeof CATEGORIA_ATENDIMENTO];

export const TIPO_ATENDIMENTO = {
  PRIMEIRA_VIA: '1_VIA',
  SEGUNDA_VIA: '2_VIA'
} as const;

export type TipoAtendimento = typeof TIPO_ATENDIMENTO[keyof typeof TIPO_ATENDIMENTO];

export type AppointmentType = 'first_issue' | 'second_issue' | '1_VIA' | '2_VIA';

export interface RequiredDocument {
  id: string;
  service_id: string;
  appointment_type: AppointmentType;
  document_name: string;
  description: string | null;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
