"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const joi_1 = __importDefault(require("@hapi/joi"));
const debug_1 = __importDefault(require("debug"));
const schemaDebug = debug_1.default("Schema");
// ************************************ //
// * JOI Schemas + Related Interfaces * //
// ************************************ //
const certificatesSchema = joi_1.default.object().keys({
    wwdr: joi_1.default.alternatives(joi_1.default.binary(), joi_1.default.string()).required(),
    signerCert: joi_1.default.alternatives(joi_1.default.binary(), joi_1.default.string()).required(),
    signerKey: joi_1.default.alternatives().try(joi_1.default.object().keys({
        keyFile: joi_1.default.alternatives(joi_1.default.binary(), joi_1.default.string()).required(),
        passphrase: joi_1.default.string().required(),
    }), joi_1.default.alternatives(joi_1.default.binary(), joi_1.default.string())).required()
}).required();
const instance = joi_1.default.object().keys({
    model: joi_1.default.alternatives(joi_1.default.object(), joi_1.default.string()).required(),
    certificates: joi_1.default.object(),
    overrides: joi_1.default.object(),
});
const supportedOptions = joi_1.default.object().keys({
    serialNumber: joi_1.default.string(),
    description: joi_1.default.string(),
    organizationName: joi_1.default.string(),
    passTypeIdentifier: joi_1.default.string(),
    teamIdentifier: joi_1.default.string(),
    appLaunchURL: joi_1.default.string(),
    associatedStoreIdentifiers: joi_1.default.array().items(joi_1.default.number()),
    userInfo: joi_1.default.alternatives(joi_1.default.object().unknown(), joi_1.default.array()),
    // parsing url as set of words and nums followed by dots, optional port and any possible path after
    webServiceURL: joi_1.default.string().regex(/https?:\/\/(?:[a-z0-9]+\.?)+(?::\d{2,})?(?:\/[\S]+)*/),
    authenticationToken: joi_1.default.string().min(16),
    sharingProhibited: joi_1.default.boolean(),
    backgroundColor: joi_1.default.string().min(10).max(16),
    foregroundColor: joi_1.default.string().min(10).max(16),
    labelColor: joi_1.default.string().min(10).max(16),
    groupingIdentifier: joi_1.default.string(),
    suppressStripShine: joi_1.default.boolean(),
    logoText: joi_1.default.string(),
    maxDistance: joi_1.default.number().positive(),
}).with("webServiceURL", "authenticationToken");
const currencyAmount = joi_1.default.object().keys({
    currencyCode: joi_1.default.string().required(),
    amount: joi_1.default.string().required(),
});
const personNameComponents = joi_1.default.object().keys({
    givenName: joi_1.default.string().required(),
    familyName: joi_1.default.string().required()
});
const seat = joi_1.default.object().keys({
    seatSection: joi_1.default.string(),
    seatRow: joi_1.default.string(),
    seatNumber: joi_1.default.string(),
    seatIdentifier: joi_1.default.string(),
    seatType: joi_1.default.string(),
    seatDescription: joi_1.default.string()
});
const location = joi_1.default.object().keys({
    latitude: joi_1.default.number().required(),
    longitude: joi_1.default.number().required()
});
const semantics = joi_1.default.object().keys({
    // All
    totalPrice: currencyAmount,
    // boarding Passes and Events
    duration: joi_1.default.number(),
    seats: joi_1.default.array().items(seat),
    silenceRequested: joi_1.default.boolean(),
    // all boarding passes
    departureLocation: location,
    destinationLocation: location,
    destinationLocationDescription: location,
    transitProvider: joi_1.default.string(),
    vehicleName: joi_1.default.string(),
    vehicleType: joi_1.default.string(),
    originalDepartureDate: joi_1.default.string(),
    currentDepartureDate: joi_1.default.string(),
    originalArrivalDate: joi_1.default.string(),
    currentArrivalDate: joi_1.default.string(),
    originalBoardingDate: joi_1.default.string(),
    currentBoardingDate: joi_1.default.string(),
    boardingGroup: joi_1.default.string(),
    boardingSequenceNumber: joi_1.default.string(),
    confirmationNumber: joi_1.default.string(),
    transitStatus: joi_1.default.string(),
    transitStatuReason: joi_1.default.string(),
    passengetName: personNameComponents,
    membershipProgramName: joi_1.default.string(),
    membershipProgramNumber: joi_1.default.string(),
    priorityStatus: joi_1.default.string(),
    securityScreening: joi_1.default.string(),
    // Airline Boarding Passes
    flightCode: joi_1.default.string(),
    airlineCode: joi_1.default.string(),
    flightNumber: joi_1.default.number(),
    departureAirportCode: joi_1.default.string(),
    departureAirportName: joi_1.default.string(),
    destinationTerminal: joi_1.default.string(),
    destinationGate: joi_1.default.string(),
    // Train and Other Rail Boarding Passes
    departurePlatform: joi_1.default.string(),
    departureStationName: joi_1.default.string(),
    destinationPlatform: joi_1.default.string(),
    destinationStationName: joi_1.default.string(),
    carNumber: joi_1.default.string(),
    // All Event Tickets
    eventName: joi_1.default.string(),
    venueName: joi_1.default.string(),
    venueLocation: location,
    venueEntrance: joi_1.default.string(),
    venuePhoneNumber: joi_1.default.string(),
    venueRoom: joi_1.default.string(),
    eventType: joi_1.default.string().regex(/(PKEventTypeGeneric|PKEventTypeLivePerformance|PKEventTypeMovie|PKEventTypeSports|PKEventTypeConference|PKEventTypeConvention|PKEventTypeWorkshop|PKEventTypeSocialGathering)/),
    eventStartDate: joi_1.default.string(),
    eventEndDate: joi_1.default.string(),
    artistIDs: joi_1.default.string(),
    performerNames: joi_1.default.array().items(joi_1.default.string()),
    genre: joi_1.default.string(),
    // Sport Event Tickets
    leagueName: joi_1.default.string(),
    leagueAbbreviation: joi_1.default.string(),
    homeTeamLocation: joi_1.default.string(),
    homeTeamName: joi_1.default.string(),
    homeTeamAbbreviation: joi_1.default.string(),
    awayTeamLocation: joi_1.default.string(),
    awayTeamName: joi_1.default.string(),
    awayTeamAbbreviation: joi_1.default.string(),
    sportName: joi_1.default.string(),
    // Store Card Passes
    balance: currencyAmount
});
const barcode = joi_1.default.object().keys({
    altText: joi_1.default.string(),
    messageEncoding: joi_1.default.string().default("iso-8859-1"),
    format: joi_1.default.string().required().regex(/(PKBarcodeFormatQR|PKBarcodeFormatPDF417|PKBarcodeFormatAztec|PKBarcodeFormatCode128)/, "barcodeType"),
    message: joi_1.default.string().required()
});
const field = joi_1.default.object().keys({
    attributedValue: joi_1.default.alternatives(joi_1.default.string().allow(""), joi_1.default.number(), joi_1.default.date().iso()),
    changeMessage: joi_1.default.string(),
    dataDetectorType: joi_1.default.array().items(joi_1.default.string().regex(/(PKDataDetectorTypePhoneNumber|PKDataDetectorTypeLink|PKDataDetectorTypeAddress|PKDataDetectorTypeCalendarEvent)/, "dataDetectorType")),
    label: joi_1.default.string().allow(""),
    textAlignment: joi_1.default.string().regex(/(PKTextAlignmentLeft|PKTextAlignmentCenter|PKTextAlignmentRight|PKTextAlignmentNatural)/, "graphic-alignment"),
    key: joi_1.default.string().required(),
    value: joi_1.default.alternatives(joi_1.default.string().allow(""), joi_1.default.number(), joi_1.default.date().iso()).required(),
    semantics,
    // date fields formatters, all optionals
    dateStyle: joi_1.default.string().regex(/(PKDateStyleNone|PKDateStyleShort|PKDateStyleMedium|PKDateStyleLong|PKDateStyleFull)/, "date style"),
    ignoreTimeZone: joi_1.default.boolean(),
    isRelative: joi_1.default.boolean(),
    timeStyle: joi_1.default.string().regex(/(PKDateStyleNone|PKDateStyleShort|PKDateStyleMedium|PKDateStyleLong|PKDateStyleFull)/, "date style"),
    // number fields formatters, all optionals
    currencyCode: joi_1.default.string()
        .when("value", {
        is: joi_1.default.number(),
        otherwise: joi_1.default.string().forbidden()
    }),
    numberStyle: joi_1.default.string()
        .regex(/(PKNumberStyleDecimal|PKNumberStylePercent|PKNumberStyleScientific|PKNumberStyleSpellOut)/)
        .when("value", {
        is: joi_1.default.number(),
        otherwise: joi_1.default.string().forbidden()
    }),
});
const beaconsDict = joi_1.default.object().keys({
    major: joi_1.default.number().integer().positive().max(65535).greater(joi_1.default.ref("minor")),
    minor: joi_1.default.number().integer().min(0).max(65535),
    proximityUUID: joi_1.default.string().required(),
    relevantText: joi_1.default.string()
});
const locationsDict = joi_1.default.object().keys({
    altitude: joi_1.default.number(),
    latitude: joi_1.default.number().required(),
    longitude: joi_1.default.number().required(),
    relevantText: joi_1.default.string()
});
const passDict = joi_1.default.object().keys({
    auxiliaryFields: joi_1.default.array().items(joi_1.default.object().keys({
        row: joi_1.default.number().max(1).min(0)
    }).concat(field)),
    backFields: joi_1.default.array().items(field),
    headerFields: joi_1.default.array().items(field),
    primaryFields: joi_1.default.array().items(field),
    secondaryFields: joi_1.default.array().items(field)
});
const transitType = joi_1.default.string().regex(/(PKTransitTypeAir|PKTransitTypeBoat|PKTransitTypeBus|PKTransitTypeGeneric|PKTransitTypeTrain)/);
const nfcDict = joi_1.default.object().keys({
    message: joi_1.default.string().required().max(64),
    encryptionPublicKey: joi_1.default.string()
});
const personalizationDict = joi_1.default.object().keys({
    requiredPersonalizationFields: joi_1.default.array()
        .items("PKPassPersonalizationFieldName", "PKPassPersonalizationFieldPostalCode", "PKPassPersonalizationFieldEmailAddress", "PKPassPersonalizationFieldPhoneNumber")
        .required(),
    description: joi_1.default.string().required(),
    termsAndConditions: joi_1.default.string(),
});
// --------- UTILITIES ---------- //
const schemas = {
    instance,
    certificatesSchema,
    barcode,
    field,
    passDict,
    beaconsDict,
    locationsDict,
    transitType,
    nfcDict,
    supportedOptions,
    personalizationDict
};
function resolveSchemaName(name) {
    return schemas[name] || undefined;
}
/**
 * Checks if the passed options are compliant with the indicated schema
 * @param {any} opts - options to be checks
 * @param {string} schemaName - the indicated schema (will be converted)
 * @returns {boolean} - result of the check
 */
function isValid(opts, schemaName) {
    const resolvedSchema = resolveSchemaName(schemaName);
    if (!resolvedSchema) {
        schemaDebug(`validation failed due to missing or mispelled schema name`);
        return false;
    }
    const validation = resolvedSchema.validate(opts);
    if (validation.error) {
        schemaDebug(`validation failed due to error: ${validation.error.message}`);
    }
    return !validation.error;
}
exports.isValid = isValid;
/**
 * Executes the validation in verbose mode, exposing the value or an empty object
 * @param {object} opts - to be validated
 * @param {*} schemaName - selected schema
 * @returns {object} the filtered value or empty object
 */
function getValidated(opts, schemaName) {
    const resolvedSchema = resolveSchemaName(schemaName);
    if (!resolvedSchema) {
        schemaDebug(`validation failed due to missing or mispelled schema name`);
        return null;
    }
    const validation = resolvedSchema.validate(opts, { stripUnknown: true });
    if (validation.error) {
        schemaDebug(`Validation failed in getValidated due to error: ${validation.error.message}`);
        return null;
    }
    return validation.value;
}
exports.getValidated = getValidated;
