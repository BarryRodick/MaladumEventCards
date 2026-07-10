const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const identifierPattern = /^[A-Za-z_$][\w$]*$/;
const identifierSource = '[A-Za-z_$][\\w$]*';
const whitespaceSource = '[ \\t\\r\\n]';
const namedOrNamespaceSource = `(?:\\{[^}]*\\}|\\*${whitespaceSource}+as${whitespaceSource}+${identifierSource})`;
const importBindingsSource = `(?:${identifierSource}(?:${whitespaceSource}*,${whitespaceSource}*${namedOrNamespaceSource})?|${namedOrNamespaceSource})`;
const moduleSpecifierSource = '[\"\'][^\"\'\\r\\n]+[\"\']';
const staticImportPattern = new RegExp(
    `^[ \\t]*import(?:${whitespaceSource}+${moduleSpecifierSource}|${whitespaceSource}+${importBindingsSource}${whitespaceSource}+from${whitespaceSource}+${moduleSpecifierSource})[ \\t]*;?[ \\t]*(?:\\/\\/[^\\r\\n]*)?(?:\\r?\\n|$)`,
    'gm'
);
const exportedFunctionPattern = /^([ \t]*)export[ \t]+function[ \t]+([A-Za-z_$][\w$]*)/gm;
const exportedConstPattern = /^([ \t]*)export[ \t]+const[ \t]+([A-Za-z_$][\w$]*)/gm;
const remainingModuleSyntaxPattern = /^[ \t]*(?:import|export)\b/m;

function resolveRepositoryModule(relativeModulePath) {
    if (typeof relativeModulePath !== 'string' || relativeModulePath.length === 0) {
        throw new TypeError('Module path must be a non-empty repository-relative string.');
    }
    if (path.isAbsolute(relativeModulePath)) {
        throw new Error('Module path must be relative to the repository.');
    }

    const sourcePath = path.resolve(repositoryRoot, relativeModulePath);
    const repositoryRelativePath = path.relative(repositoryRoot, sourcePath);
    if (repositoryRelativePath === '..' || repositoryRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(repositoryRelativePath)) {
        throw new Error('Module path must stay within the repository.');
    }

    return sourcePath;
}

function transformSource(source) {
    const exportedNames = new Set();
    let transformed = source.replace(staticImportPattern, '');

    transformed = transformed.replace(exportedFunctionPattern, (match, indentation, name) => {
        exportedNames.add(name);
        return `${indentation}function ${name}`;
    });
    transformed = transformed.replace(exportedConstPattern, (match, indentation, name) => {
        exportedNames.add(name);
        return `${indentation}const ${name}`;
    });

    const unsupportedSyntax = transformed.match(remainingModuleSyntaxPattern);
    if (unsupportedSyntax) {
        const line = transformed.slice(unsupportedSyntax.index).split(/\r?\n/, 1)[0].trim();
        throw new Error(`Unsupported module syntax remains: ${line}`);
    }

    return { transformed, exportedNames };
}

function validateRequestedExports(exportNames, exportedNames) {
    if (!Array.isArray(exportNames)) {
        throw new TypeError('The exports option must be an array of exported symbol names.');
    }

    const seenNames = new Set();
    exportNames.forEach(name => {
        if (typeof name !== 'string' || !identifierPattern.test(name)) {
            throw new TypeError(`Invalid requested export name: ${String(name)}`);
        }
        if (seenNames.has(name)) {
            throw new Error(`Requested export is duplicated: ${name}`);
        }
        if (!exportedNames.has(name)) {
            throw new Error(`Requested export was not found: ${name}`);
        }
        seenNames.add(name);
    });
}

function validateDependencies(dependencies) {
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
        throw new TypeError('The dependencies option must be an object.');
    }

    Object.keys(dependencies).forEach(name => {
        if (!identifierPattern.test(name)) {
            throw new TypeError(`Invalid dependency name: ${name}`);
        }
    });
}

function loadSourceModule(relativeModulePath, {
    dependencies = {},
    exports: exportNames
} = {}) {
    try {
        const sourcePath = resolveRepositoryModule(relativeModulePath);
        const source = fs.readFileSync(sourcePath, 'utf8');
        const { transformed, exportedNames } = transformSource(source);

        validateRequestedExports(exportNames, exportedNames);
        validateDependencies(dependencies);

        const dependencyNames = Object.keys(dependencies);
        const returnedExports = exportNames
            .map(name => `${JSON.stringify(name)}: ${name}`)
            .join(', ');
        const factory = new Function(
            ...dependencyNames,
            `'use strict';\n${transformed}\nreturn { ${returnedExports} };`
        );

        return factory(...dependencyNames.map(name => dependencies[name]));
    } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        const error = new Error(
            `Failed to load source module "${String(relativeModulePath)}": ${detail}`
        );
        error.cause = cause;
        throw error;
    }
}

module.exports = { loadSourceModule };
