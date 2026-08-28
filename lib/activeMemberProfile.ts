/** Perfil visível no app: sem data de desligamento da membresia. */
export const isProfileVisibleInApp = (membershipOut: string | null | undefined) => {
  if (membershipOut == null) {
    return true;
  }

  return String(membershipOut).trim() === '';
};

type ActiveMembershipQuery = {
  is: (column: 'membership_out', value: null) => ActiveMembershipQuery;
};

/** Filtro PostgREST: `.is('membership_out', null)` em consultas a `profiles`. */
export const withActiveMembershipProfileFilter = <Q extends ActiveMembershipQuery>(query: Q): Q =>
  query.is('membership_out', null) as Q;
