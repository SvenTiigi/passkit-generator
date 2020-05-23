"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pass_1 = require("./pass");
const messages_1 = __importDefault(require("./messages"));
const parser_1 = require("./parser");
const utils_1 = require("./utils");
const abstract_1 = require("./abstract");
/**
 * Creates a new Pass instance.
 *
 * @param options Options to be used to create the instance or an Abstract Model reference
 * @param additionalBuffers More buffers (with file name) to be added on runtime (if you are downloading some files from the web)
 * @param abstractMissingData Additional data for abstract models, that might vary from pass to pass.
 */
async function createPass(options, additionalBuffers, abstractMissingData) {
    if (!(options && (options instanceof abstract_1.AbstractModel || Object.keys(options).length))) {
        throw new Error(messages_1.default("CP_NO_OPTS"));
    }
    try {
        if (options instanceof abstract_1.AbstractModel) {
            let certificates;
            if (!(options.certificates && options.certificates.signerCert && options.certificates.signerKey) && abstractMissingData.certificates) {
                certificates = Object.assign(options.certificates, await parser_1.readCertificatesFromOptions(abstractMissingData.certificates));
            }
            else {
                certificates = options.certificates;
            }
            if (additionalBuffers) {
                const [additionalL10n, additionalBundle] = utils_1.splitBufferBundle(additionalBuffers);
                Object.assign(options.bundle["l10nBundle"], additionalL10n);
                Object.assign(options.bundle["bundle"], additionalBundle);
            }
            return new pass_1.Pass({
                model: options.bundle,
                certificates: certificates,
                overrides: {
                    ...(options.overrides || {}),
                    ...(abstractMissingData && abstractMissingData.overrides || {})
                }
            });
        }
        else {
            const [bundle, certificates] = await Promise.all([
                parser_1.getModelContents(options.model),
                parser_1.readCertificatesFromOptions(options.certificates)
            ]);
            if (additionalBuffers) {
                const [additionalL10n, additionalBundle] = utils_1.splitBufferBundle(additionalBuffers);
                Object.assign(bundle["l10nBundle"], additionalL10n);
                Object.assign(bundle["bundle"], additionalBundle);
            }
            return new pass_1.Pass({
                model: bundle,
                certificates,
                overrides: options.overrides
            });
        }
    }
    catch (err) {
        throw new Error(messages_1.default("CP_INIT_ERROR", "pass", err));
    }
}
exports.createPass = createPass;
