"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../http");
const seeds_1 = require("../../seeds");
function GET() { return (0, http_1.envelope)(seeds_1.seed.currentSituations.situations, { provider: 'StaticSeedProvider', dataStatus: 'scenario' }); }
