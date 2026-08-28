/** Teto do plano conta membros + congregados ativos. -1 = ilimitado. */
export function planCoversActiveUsers(maxMembers: number, activeUsers: number): boolean {
  if (maxMembers < 0) {
    return true;
  }
  return activeUsers <= maxMembers;
}

export function formatPlanUserCap(maxMembers: number): string {
  if (maxMembers < 0) {
    return 'Usuários ativos ilimitados (membros + congregados)';
  }
  return `Até ${maxMembers.toLocaleString('pt-BR')} usuários ativos (membros + congregados)`;
}

export function planTooSmallMessage(maxMembers: number, activeUsers: number): string {
  return `Indisponível: a igreja tem ${activeUsers.toLocaleString('pt-BR')} usuários ativos; este plano comporta até ${maxMembers.toLocaleString('pt-BR')}.`;
}
