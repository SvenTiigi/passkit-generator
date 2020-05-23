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
const schema = __importStar(require("./schema"));
const debug_1 = __importDefault(require("debug"));
const fieldsDebug = debug_1.default("passkit:fields");
/**
 * Class to represent lower-level keys pass fields
 * @see https://apple.co/2wkUBdh
 */
const poolSymbol = Symbol("pool");
class FieldsArray extends Array {
    constructor(pool, ...args) {
        super(...args);
        this[poolSymbol] = pool;
    }
    /**
     * Like `Array.prototype.push` but will alter
     * also uniqueKeys set.
     */
    push(...fieldsData) {
        const validFields = fieldsData.reduce((acc, current) => {
            if (!(typeof current === "object") || !schema.isValid(current, "field")) {
                return acc;
            }
            if (this[poolSymbol].has(current.key)) {
                fieldsDebug(`Field with key "${current.key}" discarded: fields must be unique in pass scope.`);
            }
            else {
                this[poolSymbol].add(current.key);
                acc.push(current);
            }
            return acc;
        }, []);
        return Array.prototype.push.call(this, ...validFields);
    }
    /**
     * Like `Array.prototype.pop`, but will alter
     * also uniqueKeys set
     */
    pop() {
        const element = Array.prototype.pop.call(this);
        this[poolSymbol].delete(element.key);
        return element;
    }
    /**
     * Like `Array.prototype.splice` but will alter
     * also uniqueKeys set
     */
    splice(start, deleteCount, ...items) {
        const removeList = this.slice(start, deleteCount + start);
        removeList.forEach(item => this[poolSymbol].delete(item.key));
        return Array.prototype.splice.call(this, start, deleteCount, items);
    }
    get length() {
        return this.length;
    }
}
exports.default = FieldsArray;
