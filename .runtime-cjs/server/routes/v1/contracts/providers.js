"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_js_1 = require("../../../http.js");
const seeds_js_1 = require("../../../seeds.js");
const domainProviders_js_1 = require("../../../providers/domainProviders.js");
function GET() { return (0, http_js_1.envelope)({ contract: seeds_js_1.seed.providerContracts, selections: (0, domainProviders_js_1.providerSelections)() }, { provider: 'ProviderContractRegistry', dataStatus: 'mock' }); }
