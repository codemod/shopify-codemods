// Type definitions for AST-grep nodes (avoiding import issues)
export interface SgNode {
  text(): string;
  kind(): string;
  parent(): SgNode | null;
  field(name: string): SgNode | null;
  getMatch(name: string): SgNode | null;
  replace(text: string): any;
  findAll(config: { rule: any }): SgNode[];
}

export interface ImportInfo {
  source: string;
  specifier: string;
  node: any;
}

/**
 * Generic utility to get variable aliases for any source variable
 * @param rootNode - The root AST node to search in
 * @param sourceVar - The source variable name (e.g., "api", "Polaris", "React")
 * @param destructuredProps - Optional array of properties that create direct aliases when destructured
 * @returns Set of all aliases for the source variable
 *
 * @example
 * // For API aliases: const myApi = api; const { smartGrid } = api;
 * const apiAliases = getVariableAliases(rootNode, "api", ["smartGrid"]);
 *
 * // For Polaris aliases: const MyPolaris = Polaris;
 * const polarisAliases = getVariableAliases(rootNode, "Polaris");
 */
export function getVariableAliases(
  rootNode: any,
  sourceVar: string,
  destructuredProps: string[] = []
): Set<string> {
  const aliases = new Set<string>([sourceVar]);

  // Pattern 1: const myVar = sourceVar
  const directAliases = rootNode.findAll({
    rule: { pattern: `const $VAR = ${sourceVar}` },
  });

  for (const alias of directAliases) {
    const varName = alias.getMatch("VAR")?.text();
    if (varName) {
      aliases.add(varName);
    }
  }

  // Pattern 2: const { prop } = sourceVar (for specified destructured properties)
  for (const prop of destructuredProps) {
    const destructuring = rootNode.findAll({
      rule: { pattern: `const { ${prop} } = ${sourceVar}` },
    });

    if (destructuring.length > 0) {
      aliases.add(prop);
    }
  }

  return aliases;
}

/**
 * Legacy API-specific wrapper for backward compatibility
 * @deprecated Use getVariableAliases(rootNode, "api", ["smartGrid"]) instead
 */
export function getApiAliases(rootNode: any): Set<string> {
  return getVariableAliases(rootNode, "api", ["smartGrid"]);
}

/**
 * Generic utility to find member expressions with specific object and property
 * @param rootNode - The root AST node to search in
 * @param objectAliases - Set of valid object aliases
 * @param property - The property name to find (e.g., "smartGrid", "Button", "Modal")
 * @param method - Optional method name that must follow the property (e.g., "presentModal")
 * @returns Array of matching AST nodes
 *
 * @example
 * // Find api.smartGrid.presentModal() calls
 * const smartGridUsages = findMemberExpressions(rootNode, apiAliases, "smartGrid", "presentModal");
 *
 * // Find Polaris.Button usages
 * const buttonUsages = findMemberExpressions(rootNode, polarisAliases, "Button");
 */
export function findMemberExpressions(
  rootNode: any,
  objectAliases: Set<string>,
  property: string,
  method?: string
): any[] {
  const usages: any[] = [];
  const methodPattern = method ? `.${method}($$$ARGS)` : "";

  for (const alias of objectAliases) {
    if (alias === property) {
      // Special case: direct property usage (from destructuring)
      const directUsages = rootNode.findAll({
        rule: { pattern: `${alias}${methodPattern}` },
      });
      usages.push(...directUsages);
    } else {
      // Normal case: alias.property.method()
      const memberUsages = rootNode.findAll({
        rule: { pattern: `${alias}.${property}${methodPattern}` },
      });
      usages.push(...memberUsages);
    }
  }

  // Handle this.alias patterns
  const thisUsages = rootNode.findAll({
    rule: {
      pattern: `this.${
        Array.from(objectAliases)[0]
      }.${property}${methodPattern}`,
    },
  });
  usages.push(...thisUsages);

  // Handle optional chaining
  const optionalUsages = rootNode.findAll({
    rule: {
      pattern: `${Array.from(objectAliases)[0]}?.${property}${methodPattern}`,
    },
  });
  usages.push(...optionalUsages);

  // Handle function call patterns
  const functionCallUsages = rootNode.findAll({
    rule: { pattern: `$FUNC().${property}${methodPattern}` },
  });
  usages.push(...functionCallUsages);

  return usages;
}

/**
 * Get all imports from a specific package/module
 * @param rootNode - The root AST node to search in
 * @param packageName - The package name to search for (e.g., "@shopify/polaris", "react")
 * @returns Array of import information
 *
 * @example
 * // Find all Polaris imports
 * const polarisImports = getImports(rootNode, "@shopify/polaris");
 */
export function getImports(rootNode: any, packageName: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // Pattern 1: import specifier from "package"
  const defaultImports = rootNode.findAll({
    rule: { pattern: `import $SPEC from "${packageName}"` },
  });

  for (const importNode of defaultImports) {
    const spec = importNode.getMatch("SPEC");
    if (spec) {
      imports.push({
        source: packageName,
        specifier: spec.text(),
        node: importNode,
      });
    }
  }

  // Pattern 2: import { namedImports } from "package"
  const namedImports = rootNode.findAll({
    rule: { pattern: `import { $$$SPECS } from "${packageName}"` },
  });

  for (const importNode of namedImports) {
    const specs = importNode.getMatch("SPECS");
    if (specs) {
      imports.push({
        source: packageName,
        specifier: `{ ${specs.text()} }`,
        node: importNode,
      });
    }
  }

  // Pattern 3: import * as alias from "package"
  const namespaceImports = rootNode.findAll({
    rule: { pattern: `import * as $ALIAS from "${packageName}"` },
  });

  for (const importNode of namespaceImports) {
    const alias = importNode.getMatch("ALIAS");
    if (alias) {
      imports.push({
        source: packageName,
        specifier: `* as ${alias.text()}`,
        node: importNode,
      });
    }
  }

  // Pattern 4: import "package" (side-effect only)
  const sideEffectImports = rootNode.findAll({
    rule: { pattern: `import "${packageName}"` },
  });

  for (const importNode of sideEffectImports) {
    imports.push({
      source: packageName,
      specifier: "",
      node: importNode,
    });
  }

  return imports;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getImports(rootNode, packageName) instead
 */
export function getImportSources(
  rootNode: any,
  packageName: string
): ImportInfo[] {
  return getImports(rootNode, packageName);
}

/**
 * Get specific named imports from a package
 * @param rootNode - The root AST node to search in
 * @param packageName - The package name to search for
 * @param importName - The specific import name to find
 * @returns Array of nodes that import the specific name
 *
 * @example
 * // Find all imports of 'Button' from '@shopify/polaris'
 * const buttonImports = getNamedImports(rootNode, "@shopify/polaris", "Button");
 */
export function getNamedImports(
  rootNode: any,
  packageName: string,
  importName: string
): any[] {
  const nodes: any[] = [];

  // Pattern: import { importName } from "package" or import { importName, ... } from "package"
  const imports = rootNode.findAll({
    rule: { pattern: `import { $$$SPECS } from "${packageName}"` },
  });

  for (const importNode of imports) {
    const specs = importNode.getMatch("SPECS");
    if (specs && specs.text().includes(importName)) {
      nodes.push(importNode);
    }
  }

  return nodes;
}

/**
 * Check if an object reference is valid based on a set of aliases
 * Handles complex patterns like this.api, api(), api?.method, getApi(), etc.
 * @param objectText - The text of the object being checked
 * @param aliases - Set of valid aliases
 * @returns boolean indicating if the object is valid
 *
 * @example
 * const apiAliases = new Set(['api', 'myApi']);
 * isValidObjectReference('api', apiAliases); // true
 * isValidObjectReference('this.api', apiAliases); // true
 * isValidObjectReference('getApi()', apiAliases); // true
 * isValidObjectReference('getApi()?.', apiAliases); // true
 * isValidObjectReference('someOther', apiAliases); // false
 */
export function isValidObjectReference(
  objectText: string,
  aliases: Set<string>
): boolean {
  // Direct alias match
  if (aliases.has(objectText)) return true;

  // Optional chaining pattern (api?)
  const optionalBase = objectText.replace(/\?$/, "");
  if (aliases.has(optionalBase)) return true;

  // Function call patterns: getApi(), api(), getApi()?, etc.
  const functionCallBase = objectText.replace(/\(\)\??$/, "");
  if (aliases.has(functionCallBase)) return true;

  // Check if function call returns an API (any function ending with 'api' or known patterns)
  if (objectText.endsWith("()") || objectText.endsWith("()?")) {
    const funcName = objectText.replace(/\(\)\??$/, "");
    // Common patterns like getApi, fetchApi, etc.
    if (funcName.toLowerCase().includes("api")) return true;
  }

  // this.alias pattern (including optional chaining)
  for (const alias of aliases) {
    if (
      objectText === `this.${alias}` ||
      objectText.startsWith(`this.${alias}.`)
    ) {
      return true;
    }
    // Handle this?.alias? patterns
    if (objectText === `this?.${alias}?` || objectText === `this?.${alias}`) {
      return true;
    }
  }

  return false;
}
