"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPublicObservations = fetchPublicObservations;
const env_1 = require("../env");
const kmaNowcast_1 = require("./kmaNowcast");
const hrfcoHydrology_1 = require("./hrfcoHydrology");
async function fetchPublicObservations(adminCode, referenceTime) {
    if ((0, env_1.dataMode)() === 'scenario')
        return { observations: [], warnings: ['POC_DATA_MODE=scenario'] };
    const warnings = [];
    const observations = [];
    try {
        const result = await (0, kmaNowcast_1.fetchKmaNowcast)(adminCode, referenceTime ? new Date(referenceTime) : new Date());
        observations.push(...result.observations);
        if (result.warning)
            warnings.push(result.warning);
    }
    catch (error) {
        warnings.push(`기상청 초단기실황 호출 실패: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    try {
        const result = await (0, hrfcoHydrology_1.fetchHrfcoHydrology)(adminCode, referenceTime ? new Date(referenceTime) : new Date());
        observations.push(...result.observations);
        if (result.warning)
            warnings.push(result.warning);
    }
    catch (error) {
        warnings.push(`홍수통제소 수위·유량 호출 실패: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return { observations, warnings };
}
