import { envelope } from '../../../http';
import { seed } from '../../../seeds';
export function GET(){return envelope(seed.similarityWeightProfiles,{provider:'MockSimilarityPolicyProvider',dataStatus:'mock',warnings:['시연용 가중치 Profile이며 실제 T3Q 운영 가중치가 아닙니다.']});}
