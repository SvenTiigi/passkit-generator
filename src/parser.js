"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const node_forge_1 = __importDefault(require("node-forge"));
const messages_1 = __importDefault(require("./messages"));
const schema_1 = require("./schema");
const utils_1 = require("./utils");
const util_1 = require("util");
const fs_1 = require("fs");
const debug_1 = __importDefault(require("debug"));
const prsDebug = debug_1.default("Personalization");
const readDir = util_1.promisify(fs_1.readdir);
const readFile = util_1.promisify(fs_1.readFile);
/**
 * Performs checks on the passed model to
 * determine how to parse it
 * @param model
 */
async function getModelContents(model) {
    const isModelValid = (model && (typeof model === "string" || (typeof model === "object" &&
        Object.keys(model).length)));
    if (!isModelValid) {
        throw new Error(messages_1.default("MODEL_NOT_VALID"));
    }
    let modelContents;
    if (typeof model === "string") {
        modelContents = await getModelFolderContents(model);
    }
    else {
        modelContents = getModelBufferContents(model);
    }
    const modelFiles = Object.keys(modelContents.bundle);
    const isModelInitialized = (modelFiles.includes("pass.json") &&
        utils_1.hasFilesWithName("icon", modelFiles, "startsWith"));
    if (!isModelInitialized) {
        throw new Error(messages_1.default("MODEL_UNINITIALIZED", "parse result"));
    }
    // ======================= //
    // *** Personalization *** //
    // ======================= //
    const personalizationJsonFile = "personalization.json";
    if (!modelFiles.includes(personalizationJsonFile)) {
        return modelContents;
    }
    const logoFullNames = utils_1.getAllFilesWithName("personalizationLogo", modelFiles, "startsWith");
    if (!(logoFullNames.length && modelContents.bundle[personalizationJsonFile].length)) {
        utils_1.deletePersonalization(modelContents.bundle, logoFullNames);
        return modelContents;
    }
    try {
        const parsedPersonalization = JSON.parse(modelContents.bundle[personalizationJsonFile].toString("utf8"));
        const isPersonalizationValid = schema_1.isValid(parsedPersonalization, "personalizationDict");
        if (!isPersonalizationValid) {
            [...logoFullNames, personalizationJsonFile]
                .forEach(file => delete modelContents.bundle[file]);
            return modelContents;
        }
    }
    catch (err) {
        prsDebug(messages_1.default("PRS_INVALID", err));
        utils_1.deletePersonalization(modelContents.bundle, logoFullNames);
    }
    return modelContents;
}
exports.getModelContents = getModelContents;
/**
 * Reads and model contents and creates a splitted
 * bundles-object.
 * @param model
 */
async function getModelFolderContents(model) {
    try {
        const modelPath = `${model}${!path.extname(model) && ".pass" || ""}`;
        const modelFilesList = await readDir(modelPath);
        // No dot-starting files, manifest and signature
        const filteredFiles = utils_1.removeHidden(modelFilesList)
            .filter(f => !/(manifest|signature)/i.test(f) && /.+$/.test(path.parse(f).ext));
        const isModelInitialized = (filteredFiles.length &&
            utils_1.hasFilesWithName("icon", filteredFiles, "startsWith"));
        // Icon is required to proceed
        if (!isModelInitialized) {
            throw new Error(messages_1.default("MODEL_UNINITIALIZED", path.parse(model).name));
        }
        // Splitting files from localization folders
        const rawBundle = filteredFiles.filter(entry => !entry.includes(".lproj"));
        const l10nFolders = filteredFiles.filter(entry => entry.includes(".lproj"));
        const bundleBuffers = rawBundle.map(file => readFile(path.resolve(modelPath, file)));
        const buffers = await Promise.all(bundleBuffers);
        const bundle = Object.assign({}, ...rawBundle.map((fileName, index) => ({ [fileName]: buffers[index] })));
        // Reading concurrently localizations folder
        // and their files and their buffers
        const L10N_FilesListByFolder = await Promise.all(l10nFolders.map(folderPath => {
            // Reading current folder
            const currentLangPath = path.join(modelPath, folderPath);
            return readDir(currentLangPath)
                .then(files => {
                // Transforming files path to a model-relative path
                const validFiles = utils_1.removeHidden(files)
                    .map(file => path.join(currentLangPath, file));
                // Getting all the buffers from file paths
                return Promise.all([
                    ...validFiles.map(file => readFile(file).catch(() => Buffer.alloc(0)))
                ]).then(buffers => 
                // Assigning each file path to its buffer
                // and discarding the empty ones
                validFiles.reduce((acc, file, index) => {
                    if (!buffers[index].length) {
                        return acc;
                    }
                    const fileComponents = file.split(path.sep);
                    const fileName = fileComponents[fileComponents.length - 1];
                    return { ...acc, [fileName]: buffers[index] };
                }, {}));
            });
        }));
        const l10nBundle = Object.assign({}, ...L10N_FilesListByFolder
            .map((folder, index) => ({ [l10nFolders[index]]: folder })));
        return {
            bundle,
            l10nBundle
        };
    }
    catch (err) {
        if (err.code && err.code === "ENOENT") {
            if (err.syscall === "open") {
                // file opening failed
                throw new Error(messages_1.default("MODELF_NOT_FOUND", err.path));
            }
            else if (err.syscall === "scandir") {
                // directory reading failed
                const pathContents = err.path.split(/(\/|\\\?)/);
                throw new Error(messages_1.default("MODELF_FILE_NOT_FOUND", pathContents[pathContents.length - 1]));
            }
        }
        throw err;
    }
}
exports.getModelFolderContents = getModelFolderContents;
/**
 * Analyzes the passed buffer model and splits it to
 * return buffers and localization files buffers.
 * @param model
 */
function getModelBufferContents(model) {
    const rawBundle = utils_1.removeHidden(Object.keys(model)).reduce((acc, current) => {
        // Checking if current file is one of the autogenerated ones or if its
        // content is not available
        if (/(manifest|signature)/.test(current) || !model[current]) {
            return acc;
        }
        return { ...acc, [current]: model[current] };
    }, {});
    const bundleKeys = Object.keys(rawBundle);
    const isModelInitialized = (bundleKeys.length &&
        utils_1.hasFilesWithName("icon", bundleKeys, "startsWith"));
    // Icon is required to proceed
    if (!isModelInitialized) {
        throw new Error(messages_1.default("MODEL_UNINITIALIZED", "Buffers"));
    }
    // separing localization folders from bundle files
    const [l10nBundle, bundle] = utils_1.splitBufferBundle(rawBundle);
    return {
        bundle,
        l10nBundle
    };
}
exports.getModelBufferContents = getModelBufferContents;
async function readCertificatesFromOptions(options) {
    if (!(options && Object.keys(options).length && schema_1.isValid(options, "certificatesSchema"))) {
        throw new Error(messages_1.default("CP_NO_CERTS"));
    }
    // if the signerKey is an object, we want to get
    // all the real contents and don't care of passphrase
    const flattenedDocs = Object.assign({}, options, {
        signerKey: (options.signerKey && typeof options.signerKey === "string" &&
            options.signerKey || (options.signerKey &&
            options.signerKey.keyFile))
    });
    // We read the contents
    const rawContentsPromises = Object.keys(flattenedDocs)
        .map(key => {
        const content = flattenedDocs[key];
        if (!!path.parse(content).ext) {
            // The content is a path to the document
            return readFile(path.resolve(content), { encoding: "utf8" });
        }
        else {
            // Content is the real document content
            return Promise.resolve(content);
        }
    });
    try {
        const parsedContents = await Promise.all(rawContentsPromises);
        const pemParsedContents = parsedContents.map((file, index) => {
            const certName = Object.keys(options)[index];
            const pem = parsePEM(certName, file, typeof options.signerKey === "object"
                ? options.signerKey.passphrase
                : undefined);
            if (!pem) {
                throw new Error(messages_1.default("INVALID_CERTS", certName));
            }
            return { [certName]: pem };
        });
        return Object.assign({}, ...pemParsedContents);
    }
    catch (err) {
        if (!err.path) {
            throw err;
        }
        throw new Error(messages_1.default("INVALID_CERT_PATH", path.parse(err.path).base));
    }
}
exports.readCertificatesFromOptions = readCertificatesFromOptions;
/**
 * Parses the PEM-formatted passed text (certificates)
 *
 * @param element - Text content of .pem files
 * @param passphrase - passphrase for the key
 * @returns The parsed certificate or key in node forge format
 */
function parsePEM(pemName, element, passphrase) {
    if (pemName === "signerKey" && passphrase) {
        return node_forge_1.default.pki.decryptRsaPrivateKey(element, String(passphrase));
    }
    else {
        return node_forge_1.default.pki.certificateFromPem(element);
    }
}
