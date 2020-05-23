"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment"));
const os_1 = require("os");
const path_1 = require("path");
/**
 * Checks if an rgb value is compliant with CSS-like syntax
 *
 * @function isValidRGB
 * @params {String} value - string to analyze
 * @returns {Boolean} True if valid rgb, false otherwise
 */
function isValidRGB(value) {
    if (!value || typeof value !== "string") {
        return false;
    }
    const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/);
    if (!rgb) {
        return false;
    }
    return rgb.slice(1, 4).every(v => Math.abs(Number(v)) <= 255);
}
exports.isValidRGB = isValidRGB;
/**
 * Converts a date to W3C Standard format
 *
 * @function dateToW3Cstring
 * @params date - The date to be parsed
 * @returns - The parsed string if the parameter is valid,
 * 	 undefined otherwise
 */
function dateToW3CString(date) {
    if (!(date instanceof Date)) {
        return "";
    }
    const parsedDate = moment_1.default(date).format();
    if (parsedDate === "Invalid date") {
        return undefined;
    }
    return parsedDate;
}
exports.dateToW3CString = dateToW3CString;
/**
 * Apply a filter to arg0 to remove hidden files names (starting with dot)
 *
 * @function removeHidden
 * @params {String[]} from - list of file names
 * @return {String[]}
 */
function removeHidden(from) {
    return from.filter(e => e.charAt(0) !== ".");
}
exports.removeHidden = removeHidden;
/**
 * Creates a buffer of translations in Apple .strings format
 *
 * @function generateStringFile
 * @params {Object} lang - structure containing related to ISO 3166 alpha-2 code for the language
 * @returns {Buffer} Buffer to be written in pass.strings for language in lang
 * @see https://apple.co/2M9LWVu - String Resources
 */
function generateStringFile(lang) {
    if (!Object.keys(lang).length) {
        return Buffer.from("", "utf8");
    }
    // Pass.strings format is the following one for each row:
    // "key" = "value";
    const strings = Object.keys(lang)
        .map(key => `"${key}" = "${lang[key].replace(/"/g, '\"')}";`);
    return Buffer.from(strings.join(os_1.EOL), "utf8");
}
exports.generateStringFile = generateStringFile;
function splitBufferBundle(origin) {
    return Object.keys(origin).reduce(([l10n, bundle], current) => {
        if (!current.includes(".lproj")) {
            return [l10n, { ...bundle, [current]: origin[current] }];
        }
        const pathComponents = current.split(path_1.sep);
        const lang = pathComponents[0];
        const file = pathComponents.slice(1).join("/");
        (l10n[lang] || (l10n[lang] = {}))[file] = origin[current];
        return [l10n, bundle];
    }, [{}, {}]);
}
exports.splitBufferBundle = splitBufferBundle;
function getAllFilesWithName(name, source, mode = "includes", forceLowerCase = false) {
    return source.filter(file => (forceLowerCase && file.toLowerCase() || file)[mode](name));
}
exports.getAllFilesWithName = getAllFilesWithName;
function hasFilesWithName(name, source, mode = "includes", forceLowerCase = false) {
    return source.some(file => (forceLowerCase && file.toLowerCase() || file)[mode](name));
}
exports.hasFilesWithName = hasFilesWithName;
function deletePersonalization(source, logosNames = []) {
    [...logosNames, "personalization.json"]
        .forEach(file => delete source[file]);
}
exports.deletePersonalization = deletePersonalization;
