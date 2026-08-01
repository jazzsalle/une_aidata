import type { SatelliteEvidenceSet } from '../contracts';
import { seed } from '../seeds';

export interface SatelliteEvidenceSetProvider { list(): Promise<SatelliteEvidenceSet[]>; get(evidenceSetId:string): Promise<SatelliteEvidenceSet|null>; }

export class StaticSeedSatelliteEvidenceSetProvider implements SatelliteEvidenceSetProvider {
  async list(){ return seed.satelliteEvidenceSets.sets as unknown as SatelliteEvidenceSet[]; }
  async get(evidenceSetId:string){ return (seed.satelliteEvidenceSets.sets as unknown as SatelliteEvidenceSet[]).find(item=>item.evidence_set_id===evidenceSetId)??null; }
}

export class ThreeDLabsSatelliteEvidenceSetProvider implements SatelliteEvidenceSetProvider {
  async list():Promise<SatelliteEvidenceSet[]>{ throw new Error('THREEDLABS_PROVIDER_NOT_CONFIGURED'); }
  async get(_evidenceSetId:string):Promise<SatelliteEvidenceSet|null>{ throw new Error('THREEDLABS_PROVIDER_NOT_CONFIGURED'); }
}
