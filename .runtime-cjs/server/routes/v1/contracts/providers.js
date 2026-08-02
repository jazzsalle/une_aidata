"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../http");
const seeds_1 = require("../../../seeds");
const domainProviders_1 = require("../../../providers/domainProviders");
function GET() { return (0, http_1.envelope)({ contract: seeds_1.seed.providerContracts, selections: (0, domainProviders_1.providerSelections)() }, { provider: 'ProviderContractRegistry', dataStatus: 'mock' }); }
