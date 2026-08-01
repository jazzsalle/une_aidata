"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = env;
exports.dataMode = dataMode;
const runtime = globalThis;
function env(name) {
    const value = runtime.process?.env?.[name];
    return value?.trim() || undefined;
}
function dataMode() {
    const mode = env('POC_DATA_MODE');
    return mode === 'live' || mode === 'scenario' ? mode : 'hybrid';
}
