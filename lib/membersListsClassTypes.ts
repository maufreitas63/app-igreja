/** Integrante exibido na lista de membros/visitantes. */
export type MembersListsClassEntry = {
  id: string;
  full_name: string;
  short_name: string;
  family_id: string;
  relationship: string | null;
  phone: string | null;
  cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
};

export type MembersListsClassAudience = 'active_members' | 'inactive_members' | 'visitors';
