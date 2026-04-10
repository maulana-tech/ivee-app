// @ts-nocheck
export class EconomicServiceClient {
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
