export type ScalesClassScaleType = {
  id: string;
  code: string;
  name: string;
};

export type ScalesClassScheduleEntry = {
  id: string;
  scaleId: string;
  scaleCode: string;
  scaleName: string;
  serviceDate: string;
  volunteerId: string;
  volunteerName: string;
  volunteerPhone: string | null;
};

export type ScalesClassVolunteerEntry = {
  id: string;
  name: string;
  phone: string | null;
};

export type ScalesClassView = 'picker' | 'roster' | 'parking';

export type ProfilePhoneRow = {
  full_name: string | null;
  phone: string | null;
  family_id?: string | null;
  codigo_membro?: string | null;
};
