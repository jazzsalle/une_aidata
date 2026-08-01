# 데이터 모델

## 핵심 엔터티

- CurrentSituation
- Observation
- PriorityArea
- DisasterEvent
- DamageRecoveryRecord
- RiskKnowledge
- SpatialObject
- Evidence
- ProcedureStep
- SatelliteAsset
- FloodTrace
- AgentResponse
- MapAction
- SituationView
- ReportDraft

## 상태 enum

`actual | derived | scenario | mock | provisional`

## 핵심 관계

CurrentSituation → PriorityArea → SpatialObject/RiskKnowledge
CurrentSituation → Similar DisasterEvent → DamageRecovery/Evidence
SpatialObject/Event → SatelliteAsset/FloodTrace
CurrentSituation → ProcedureStep → ReportDraft
