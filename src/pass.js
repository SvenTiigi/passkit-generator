"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const node_forge_1 = __importDefault(require("node-forge"));
const debug_1 = __importDefault(require("debug"));
const stream_1 = require("stream");
const yazl_1 = require("yazl");
const schema = __importStar(require("./schema"));
const messages_1 = __importDefault(require("./messages"));
const fieldsArray_1 = __importDefault(require("./fieldsArray"));
const utils_1 = require("./utils");
const barcodeDebug = debug_1.default("passkit:barcode");
const genericDebug = debug_1.default("passkit:generic");
const transitType = Symbol("transitType");
const passProps = Symbol("_props");
const propsSchemaMap = new Map([
    ["barcodes", "barcode"],
    ["barcode", "barcode"],
    ["beacons", "beaconsDict"],
    ["locations", "locationsDict"],
    ["nfc", "nfcDict"]
]);
class Pass {
    constructor(options) {
        this[_a] = {};
        this.fieldsKeys = new Set();
        this[_b] = "";
        this.l10nTranslations = {};
        if (!schema.isValid(options, "instance")) {
            throw new Error(messages_1.default("REQUIR_VALID_FAILED"));
        }
        this.Certificates = options.certificates;
        this.l10nBundles = options.model.l10nBundle;
        this.bundle = { ...options.model.bundle };
        try {
            this.passCore = JSON.parse(this.bundle["pass.json"].toString("utf8"));
        }
        catch (err) {
            throw new Error(messages_1.default("PASSFILE_VALIDATION_FAILED"));
        }
        // Parsing the options and extracting only the valid ones.
        const validOverrides = schema.getValidated(options.overrides || {}, "supportedOptions");
        if (validOverrides === null) {
            throw new Error(messages_1.default("OVV_KEYS_BADFORMAT"));
        }
        this.type = Object.keys(this.passCore)
            .find(key => /(boardingPass|eventTicket|coupon|generic|storeCard)/.test(key));
        if (!this.type) {
            throw new Error(messages_1.default("NO_PASS_TYPE"));
        }
        // Parsing and validating pass.json keys
        const passCoreKeys = Object.keys(this.passCore);
        const validatedPassKeys = passCoreKeys.reduce((acc, current) => {
            if (this.type === current) {
                // We want to exclude type keys (eventTicket,
                // boardingPass, ecc.) and their content
                return acc;
            }
            if (!propsSchemaMap.has(current)) {
                // If the property is unknown (we don't care if
                // it is valid or not for Wallet), we return
                // directly the content
                return { ...acc, [current]: this.passCore[current] };
            }
            const currentSchema = propsSchemaMap.get(current);
            if (Array.isArray(this.passCore[current])) {
                const valid = getValidInArray(currentSchema, this.passCore[current]);
                return { ...acc, [current]: valid };
            }
            else {
                return {
                    ...acc,
                    [current]: schema.isValid(this.passCore[current], currentSchema) && this.passCore[current] || undefined
                };
            }
        }, {});
        this[passProps] = {
            ...(validatedPassKeys || {}),
            ...(validOverrides || {})
        };
        if (this.type === "boardingPass" && this.passCore[this.type]["transitType"]) {
            // We might want to generate a boarding pass without setting manually
            // in the code the transit type but right in the model;
            this[transitType] = this.passCore[this.type]["transitType"];
        }
        this._fields = ["primaryFields", "secondaryFields", "auxiliaryFields", "backFields", "headerFields"];
        this._fields.forEach(fieldName => {
            this[fieldName] = new fieldsArray_1.default(this.fieldsKeys, ...(this.passCore[this.type][fieldName] || [])
                .filter(field => schema.isValid(field, "field")));
        });
    }
    /**
     * Generates the pass Stream
     *
     * @method generate
     * @return A Stream of the generated pass.
     */
    generate() {
        // Editing Pass.json
        this.bundle["pass.json"] = this._patch(this.bundle["pass.json"]);
        /**
         * Checking Personalization, as this is available only with NFC
         * @see https://apple.co/2SHfb22
         */
        const currentBundleFiles = Object.keys(this.bundle);
        if (!this[passProps].nfc && currentBundleFiles.includes("personalization.json")) {
            genericDebug(messages_1.default("PRS_REMOVED"));
            utils_1.deletePersonalization(this.bundle, utils_1.getAllFilesWithName("personalizationLogo", currentBundleFiles, "startsWith"));
        }
        const finalBundle = { ...this.bundle };
        /**
         * Iterating through languages and generating pass.string file
         */
        Object.keys(this.l10nTranslations).forEach(lang => {
            const strings = utils_1.generateStringFile(this.l10nTranslations[lang]);
            const langInBundles = `${lang}.lproj`;
            if (strings.length) {
                /**
                 * if there's already a buffer of the same folder and called
                 * `pass.strings`, we'll merge the two buffers. We'll create
                 * it otherwise.
                 */
                if (!this.l10nBundles[langInBundles]) {
                    this.l10nBundles[langInBundles] = {};
                }
                this.l10nBundles[langInBundles]["pass.strings"] = Buffer.concat([
                    this.l10nBundles[langInBundles]["pass.strings"] || Buffer.alloc(0),
                    strings
                ]);
            }
            if (!(this.l10nBundles[langInBundles] && Object.keys(this.l10nBundles[langInBundles]).length)) {
                return;
            }
            /**
             * Assigning all the localization files to the final bundle
             * by mapping the buffer to the pass-relative file path;
             *
             * We are replacing the slashes to avoid Windows slashes
             * composition.
             */
            Object.assign(finalBundle, ...Object.keys(this.l10nBundles[langInBundles])
                .map(fileName => {
                const fullPath = path_1.default.join(langInBundles, fileName).replace(/\\/, "/");
                return { [fullPath]: this.l10nBundles[langInBundles][fileName] };
            }));
        });
        /*
        * Parsing the buffers, pushing them into the archive
        * and returning the compiled manifest
        */
        const archive = new yazl_1.ZipFile();
        const manifest = Object.keys(finalBundle).reduce((acc, current) => {
            let hashFlow = node_forge_1.default.md.sha1.create();
            hashFlow.update(finalBundle[current].toString("binary"));
            archive.addBuffer(finalBundle[current], current);
            acc[current] = hashFlow.digest().toHex();
            return acc;
        }, {});
        const signatureBuffer = this._sign(manifest);
        archive.addBuffer(signatureBuffer, "signature");
        archive.addBuffer(Buffer.from(JSON.stringify(manifest)), "manifest.json");
        const passStream = new stream_1.Stream.PassThrough();
        archive.outputStream.pipe(passStream);
        archive.end();
        return passStream;
    }
    /**
     * Adds traslated strings object to the list of translation to be inserted into the pass
     *
     * @method localize
     * @params lang - the ISO 3166 alpha-2 code for the language
     * @params translations - key/value pairs where key is the
     * 		placeholder in pass.json localizable strings
     * 		and value the real translated string.
     * @returns {this}
     *
     * @see https://apple.co/2KOv0OW - Passes support localization
     */
    localize(lang, translations) {
        if (lang && typeof lang === "string" && (typeof translations === "object" || translations === undefined)) {
            this.l10nTranslations[lang] = translations || {};
        }
        return this;
    }
    /**
     * Sets expirationDate property to a W3C-formatted date
     *
     * @method expiration
     * @params date
     * @returns {this}
     */
    expiration(date) {
        if (date === null) {
            delete this[passProps]["expirationDate"];
            return this;
        }
        const parsedDate = processDate("expirationDate", date);
        if (parsedDate) {
            this[passProps]["expirationDate"] = parsedDate;
        }
        return this;
    }
    /**
     * Sets voided property to true
     *
     * @method void
     * @return {this}
     */
    void() {
        this[passProps]["voided"] = true;
        return this;
    }
    beacons(...data) {
        if (data[0] === null) {
            delete this[passProps]["beacons"];
            return this;
        }
        const valid = processRelevancySet("beacons", data);
        if (valid.length) {
            this[passProps]["beacons"] = valid;
        }
        return this;
    }
    locations(...data) {
        if (data[0] === null) {
            delete this[passProps]["locations"];
            return this;
        }
        const valid = processRelevancySet("locations", data);
        if (valid.length) {
            this[passProps]["locations"] = valid;
        }
        return this;
    }
    /**
     * Sets current pass' relevancy through a date
     * @param data
     * @returns {Pass}
     */
    relevantDate(date) {
        if (date === null) {
            delete this[passProps]["relevantDate"];
            return this;
        }
        const parsedDate = processDate("relevantDate", date);
        if (parsedDate) {
            this[passProps]["relevantDate"] = parsedDate;
        }
        return this;
    }
    barcodes(...data) {
        if (data[0] === null) {
            delete this[passProps]["barcodes"];
            return this;
        }
        if (typeof data[0] === "string") {
            const autogen = barcodesFromUncompleteData(data[0]);
            if (!autogen.length) {
                barcodeDebug(messages_1.default("BRC_AUTC_MISSING_DATA"));
                return this;
            }
            this[passProps]["barcodes"] = autogen;
            return this;
        }
        else {
            /**
             * Stripping from the array not-object elements
             * and the ones that does not pass validation.
             * Validation assign default value to missing parameters (if any).
             */
            const validBarcodes = data.reduce((acc, current) => {
                if (!(current && current instanceof Object)) {
                    return acc;
                }
                const validated = schema.getValidated(current, "barcode");
                if (!(validated && validated instanceof Object && Object.keys(validated).length)) {
                    return acc;
                }
                return [...acc, validated];
            }, []);
            if (validBarcodes.length) {
                this[passProps]["barcodes"] = validBarcodes;
            }
            return this;
        }
    }
    /**
     * Given an index <= the amount of already set "barcodes",
     * this let you choose which structure to use for retrocompatibility
     * property "barcode".
     *
     * @method barcode
     * @params format - the format to be used
     * @return {this}
     */
    barcode(chosenFormat) {
        const { barcodes } = this[passProps];
        if (chosenFormat === null) {
            delete this[passProps]["barcode"];
            return this;
        }
        if (typeof chosenFormat !== "string") {
            barcodeDebug(messages_1.default("BRC_FORMATTYPE_UNMATCH"));
            return this;
        }
        if (chosenFormat === "PKBarcodeFormatCode128") {
            barcodeDebug(messages_1.default("BRC_BW_FORMAT_UNSUPPORTED"));
            return this;
        }
        if (!(barcodes && barcodes.length)) {
            barcodeDebug(messages_1.default("BRC_NO_POOL"));
            return this;
        }
        // Checking which object among barcodes has the same format of the specified one.
        const index = barcodes.findIndex(b => b.format.toLowerCase().includes(chosenFormat.toLowerCase()));
        if (index === -1) {
            barcodeDebug(messages_1.default("BRC_NOT_SUPPORTED"));
            return this;
        }
        this[passProps]["barcode"] = barcodes[index];
        return this;
    }
    /**
     * Sets nfc fields in properties
     *
     * @method nfc
     * @params data - the data to be pushed in the pass
     * @returns {this}
     * @see https://apple.co/2wTxiaC
     */
    nfc(data) {
        if (data === null) {
            delete this[passProps]["nfc"];
            return this;
        }
        if (!(data && typeof data === "object" && !Array.isArray(data) && schema.isValid(data, "nfcDict"))) {
            genericDebug(messages_1.default("NFC_INVALID"));
            return this;
        }
        this[passProps]["nfc"] = data;
        return this;
    }
    /**
     * Allows to get the current inserted props;
     * will return all props from valid overrides,
     * template's pass.json and methods-inserted ones;
     *
     * @returns The properties will be inserted in the pass.
     */
    get props() {
        return this[passProps];
    }
    /**
     * Generates the PKCS #7 cryptografic signature for the manifest file.
     *
     * @method _sign
     * @params {Object} manifest - Manifest content.
     * @returns {Buffer}
     */
    _sign(manifest) {
        const signature = node_forge_1.default.pkcs7.createSignedData();
        signature.content = node_forge_1.default.util.createBuffer(JSON.stringify(manifest), "utf8");
        signature.addCertificate(this.Certificates.wwdr);
        signature.addCertificate(this.Certificates.signerCert);
        /**
         * authenticatedAttributes belong to PKCS#9 standard.
         * It requires at least 2 values:
         * • content-type (which is a PKCS#7 oid) and
         * • message-digest oid.
         *
         * Wallet requires a signingTime.
         */
        signature.addSigner({
            key: this.Certificates.signerKey,
            certificate: this.Certificates.signerCert,
            digestAlgorithm: node_forge_1.default.pki.oids.sha1,
            authenticatedAttributes: [{
                    type: node_forge_1.default.pki.oids.contentType,
                    value: node_forge_1.default.pki.oids.data
                }, {
                    type: node_forge_1.default.pki.oids.messageDigest,
                }, {
                    type: node_forge_1.default.pki.oids.signingTime,
                }]
        });
        /**
         * We are creating a detached signature because we don't need the signed content.
         * Detached signature is a property of PKCS#7 cryptography standard.
         */
        signature.sign({ detached: true });
        /**
         * Signature here is an ASN.1 valid structure (DER-compliant).
         * Generating a non-detached signature, would have pushed inside signature.contentInfo
         * (which has type 16, or "SEQUENCE", and is an array) a Context-Specific element, with the
         * signed content as value.
         *
         * In fact the previous approach was to generating a detached signature and the pull away the generated
         * content.
         *
         * That's what happens when you copy a fu****g line without understanding what it does.
         * Well, nevermind, it was funny to study BER, DER, CER, ASN.1 and PKCS#7. You can learn a lot
         * of beautiful things. ¯\_(ツ)_/¯
         */
        return Buffer.from(node_forge_1.default.asn1.toDer(signature.toAsn1()).getBytes(), "binary");
    }
    /**
     * Edits the buffer of pass.json based on the passed options.
     *
     * @method _patch
     * @params {Buffer} passBuffer - Buffer of the contents of pass.json
     * @returns {Promise<Buffer>} Edited pass.json buffer or Object containing error.
     */
    _patch(passCoreBuffer) {
        const passFile = JSON.parse(passCoreBuffer.toString());
        if (Object.keys(this[passProps]).length) {
            /*
             * We filter the existing (in passFile) and non-valid keys from
             * the below array keys that accept rgb values
             * and then delete it from the passFile.
             */
            const passColors = ["backgroundColor", "foregroundColor", "labelColor"];
            passColors.filter(v => this[passProps][v] && !utils_1.isValidRGB(this[passProps][v]))
                .forEach(v => delete this[passProps][v]);
            Object.assign(passFile, this[passProps]);
        }
        this._fields.forEach(field => {
            passFile[this.type][field] = this[field];
        });
        if (this.type === "boardingPass" && !this[transitType]) {
            throw new Error(messages_1.default("TRSTYPE_REQUIRED"));
        }
        if (this.type !== "generic") {
			passFile[this.type]["transitType"] = this[transitType];
		} else {
			delete passFile[this.type]["transitType"];
		}
        return Buffer.from(JSON.stringify(passFile));
    }
    set transitType(value) {
        if (!schema.isValid(value, "transitType")) {
            genericDebug(messages_1.default("TRSTYPE_NOT_VALID", value));
            this[transitType] = this[transitType] || "";
            return;
        }
        this[transitType] = value;
    }
    get transitType() {
        return this[transitType];
    }
}
exports.Pass = Pass;
_a = passProps, _b = transitType;
/**
 * Automatically generates barcodes for all the types given common info
 *
 * @method barcodesFromUncompleteData
 * @params message - the content to be placed inside "message" field
 * @return Array of barcodeDict compliant
 */
function barcodesFromUncompleteData(message) {
    if (!(message && typeof message === "string")) {
        return [];
    }
    return [
        "PKBarcodeFormatQR",
        "PKBarcodeFormatPDF417",
        "PKBarcodeFormatAztec",
        "PKBarcodeFormatCode128"
    ].map(format => schema.getValidated({ format, message }, "barcode"));
}
function processRelevancySet(key, data) {
    return getValidInArray(`${key}Dict`, data);
}
function getValidInArray(schemaName, contents) {
    return contents.filter(current => Object.keys(current).length && schema.isValid(current, schemaName));
}
function processDate(key, date) {
    if (!(date instanceof Date)) {
        return null;
    }
    const dateParse = utils_1.dateToW3CString(date);
    if (!dateParse) {
        genericDebug(messages_1.default("DATE_FORMAT_UNMATCH", key));
        return null;
    }
    return dateParse;
}
