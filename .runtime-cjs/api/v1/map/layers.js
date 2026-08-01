"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const http_1 = require("../../../server/http");
const seeds_1 = require("../../../server/seeds");
function GET() { return (0, http_1.envelope)(seeds_1.seed.layers.layers, { provider: 'LayerCatalogSeedProvider', dataStatus: 'provisional' }); }
