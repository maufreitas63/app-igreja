/** Número do contrato SaaS: código da instância + sequência daquela igreja (IBN-001). */
export function formatBillingSaasContractNumber(
  instanceCode: string | null | undefined,
  sequence: number
) {
  const padded = String(Math.max(0, Number(sequence) || 0)).padStart(3, '0');
  const code = String(instanceCode ?? '')
    .trim()
    .toUpperCase();
  return code ? `${code}-${padded}` : padded;
}
