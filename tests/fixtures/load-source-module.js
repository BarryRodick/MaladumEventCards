import {
    evaluateLoad,
    transformValue
} from './not-loaded.js';

export function useDependency(value) {
    return transformValue(value);
}

export const loadedValue = evaluateLoad();
export const topLevelThis = this;
