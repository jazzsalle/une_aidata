import type { Observation } from '../contracts';
import { dataMode, env } from '../env';
import { fetchKmaNowcast } from './kmaNowcast';
import { fetchHrfcoHydrology } from './hrfcoHydrology';

export async function fetchPublicObservations(adminCode: string, referenceTime?: string): Promise<{ observations: Observation[]; warnings: string[] }> {
  if (dataMode() === 'scenario') return { observations: [], warnings: ['POC_DATA_MODE=scenario'] };
  const warnings: string[] = [];
  const observations: Observation[] = [];
  try {
    const result = await fetchKmaNowcast(adminCode, referenceTime ? new Date(referenceTime) : new Date());
    observations.push(...result.observations);
    if (result.warning) warnings.push(result.warning);
  } catch (error) {
    warnings.push(`기상청 초단기실황 호출 실패: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  try {
    const result = await fetchHrfcoHydrology(adminCode, referenceTime ? new Date(referenceTime) : new Date());
    observations.push(...result.observations);
    if (result.warning) warnings.push(result.warning);
  } catch (error) {
    warnings.push(`홍수통제소 수위·유량 호출 실패: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  return { observations, warnings };
}
