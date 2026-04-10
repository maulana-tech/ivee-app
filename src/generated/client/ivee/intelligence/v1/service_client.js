// @ts-nocheck
export class IntelligenceServiceClient {
    constructor(baseURL, options) { }
}
export class ApiError extends Error {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "statusCode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "body", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
}
export var ThreatLevel;
(function (ThreatLevel) {
    ThreatLevel[ThreatLevel["UNKNOWN"] = 0] = "UNKNOWN";
    ThreatLevel[ThreatLevel["LOW"] = 1] = "LOW";
    ThreatLevel[ThreatLevel["MODERATE"] = 2] = "MODERATE";
    ThreatLevel[ThreatLevel["HIGH"] = 3] = "HIGH";
    ThreatLevel[ThreatLevel["SEVERE"] = 4] = "SEVERE";
})(ThreatLevel || (ThreatLevel = {}));
