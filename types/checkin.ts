export interface FamilyGuardianInfo {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
}

export interface RoomInscribedChild {
  id: string;
  fullName: string;
  birthDate: string;
  ageYears: number;
  selfieUrl?: string | null;
  medicalFoodAlerts?: string | null;
  additionalCareNotes?: string | null;
  specialNeeds?: string | null;
  specialNeedsNotes?: string | null;
  familyId: string;
  checkinStatus: 'pending' | 'in_room' | 'released';
  checkinTime?: string | null;
  guardians: FamilyGuardianInfo[];
}
