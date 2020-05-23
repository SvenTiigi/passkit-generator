"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./parser");
const messages_1 = __importDefault(require("./messages"));
const abmCertificates = Symbol("certificates");
const abmModel = Symbol("model");
const abmOverrides = Symbol("overrides");
/**
 * Creates an abstract model to keep data
 * in memory for future passes creation
 * @param options
 */
async function createAbstractModel(options) {
    if (!(options && Object.keys(options).length)) {
        throw new Error(messages_1.default("CP_NO_OPTS"));
    }
    try {
        const [bundle, certificates] = await Promise.all([
            parser_1.getModelContents(options.model),
            parser_1.readCertificatesFromOptions(options.certificates)
        ]);
        return new AbstractModel({
            bundle,
            certificates,
            overrides: options.overrides
        });
    }
    catch (err) {
        console.log(err);
        throw new Error(messages_1.default("CP_INIT_ERROR", "abstract model", err));
    }
}
exports.createAbstractModel = createAbstractModel;
class AbstractModel {
    constructor(options) {
        this[abmModel] = options.bundle;
        this[abmCertificates] = options.certificates,
            this[abmOverrides] = options.overrides;
    }
    get certificates() {
        return this[abmCertificates];
    }
    get bundle() {
        return this[abmModel];
    }
    get overrides() {
        return this[abmOverrides];
    }
}
exports.AbstractModel = AbstractModel;
