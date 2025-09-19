import type { SgNode } from "@codemod.com/jssg-types/main";

export interface ImportInfo {
  source: string;
  specifier: string;
  node: SgNode;
}

/**
 * Generic utility to get variable aliases for any source variable
 * Supports const, let, and var declarations with various patterns
 * @param rootNode - The root AST node to search in
 * @param sourceVar - The source variable name (e.g., "api", "Polaris", "React")
 * @param destructuredProps - Optional array of properties that create direct aliases when destructured
 * @returns Set of all aliases for the source variable
 *
 * @example
 * // For API aliases with various declaration types:
 * // const myApi = api; let anotherApi = api; var thirdApi = api;
 * // const { smartGrid } = api; let { smartGrid: grid } = api; var { smartGrid: varGrid } = api;
 * // const a = 1, aliasedApi = api, b = 2;
 * const apiAliases = getVariableAliases(rootNode, "api", ["smartGrid"]);
 *
 * // For Polaris aliases: const MyPolaris = Polaris; let altPolaris = Polaris;
 * const polarisAliases = getVariableAliases(rootNode, "Polaris");
 */
export function getVariableAliases(
  rootNode: SgNode,
  sourceVar: string,
  destructuredProps: string[] = []
): Set<string> {
  const aliases = new Set<string>([sourceVar]);

  // All declaration types to search for
  const declarationTypes = ["const", "let", "var"];

  // Pattern 1: [const|let|var] myVar = sourceVar
  for (const declType of declarationTypes) {
    const directAliases = rootNode.findAll({
      rule: { pattern: `${declType} $VAR = ${sourceVar}` },
    });

    for (const alias of directAliases) {
      const varName = alias.getMatch("VAR")?.text();
      if (varName) {
        aliases.add(varName);
      }
    }

    // Also handle multiple declarations: [const|let|var] a = x, myVar = sourceVar, c = z
    const multipleDeclarations = rootNode.findAll({
      rule: { pattern: `${declType} $$$VARS` },
    });

    for (const decl of multipleDeclarations) {
      const varsText = decl.getMatch("VARS")?.text();
      if (varsText && varsText.includes(`= ${sourceVar}`)) {
        // Parse multiple variable declarations
        const assignments = varsText.split(",");
        for (const assignment of assignments) {
          const trimmed = assignment.trim();
          if (trimmed.includes(`= ${sourceVar}`)) {
            const varMatch = trimmed.match(/^(\w+)\s*=/);
            if (varMatch) {
              aliases.add(varMatch[1]);
            }
          }
        }
      }
    }
  }

  // Pattern 2: [const|let|var] { prop } = sourceVar (for specified destructured properties)
  for (const prop of destructuredProps) {
    for (const declType of declarationTypes) {
      // Simple destructuring: { prop } = sourceVar
      const simpleDestructuring = rootNode.findAll({
        rule: { pattern: `${declType} { ${prop} } = ${sourceVar}` },
      });

      if (simpleDestructuring.length > 0) {
        aliases.add(prop);
      }

      // Renamed destructuring: { prop: alias } = sourceVar
      const renamedDestructuring = rootNode.findAll({
        rule: { pattern: `${declType} { ${prop}: $ALIAS } = ${sourceVar}` },
      });

      for (const destructure of renamedDestructuring) {
        const aliasName = destructure.getMatch("ALIAS")?.text();
        if (aliasName) {
          aliases.add(aliasName);
        }
      }

      // Mixed destructuring: { prop, prop2: alias, ... } = sourceVar
      const mixedDestructuring = rootNode.findAll({
        rule: { pattern: `${declType} { $$$PROPS } = ${sourceVar}` },
      });

      for (const destructure of mixedDestructuring) {
        const propsText = destructure.getMatch("PROPS")?.text();
        if (propsText && propsText.includes(prop)) {
          // Parse the destructuring to find aliases
          const propPattern = new RegExp(`\\b${prop}:\\s*(\\w+)`, "g");
          let match;
          while ((match = propPattern.exec(propsText)) !== null) {
            aliases.add(match[1]);
          }

          // Also check for simple property name
          if (new RegExp(`\\b${prop}\\b(?!:)`).test(propsText)) {
            aliases.add(prop);
          }
        }
      }
    }
  }

  return aliases;
}

/**
 * Get all possible aliases for the 'api' variable including destructured 'smartGrid'
 * This is a convenience wrapper for common Shopify POS API usage patterns
 * @param rootNode - The root AST node to search in
 * @returns Set of all aliases for the api variable
 *
 * @example
 * const apiAliases = getApiAliases(rootNode);
 * // Returns Set(["api", "smartGrid"]) if code has: const { smartGrid } = api;
 */
export function getApiAliases(rootNode: SgNode): Set<string> {
  return getVariableAliases(rootNode, "api", ["smartGrid"]);
}

/**
 * Helper function to traverse a member expression chain like a linked list
 * and extract the full property path
 * @param node - The member expression node to traverse
 * @returns Array of property names from base to tip (e.g., ["api", "smartGrid", "presentModal"])
 */
function getMemberExpressionChain(node: SgNode): string[] {
  const chain: string[] = [];
  let current = node;

  // Traverse the member expression chain
  while (current && current.kind() === "member_expression") {
    // Get the property (right side of the dot)
    const property = current.field("property");
    if (property) {
      chain.unshift(property.text()); // Add to front since we're traversing backwards
    }

    // Move to the object (left side of the dot)
    current = current.field("object")!;
  }

  // Add the base object (identifier, this, function call, etc.)
  if (current) {
    const baseText = current.text();
    // Handle different base types
    if (baseText.endsWith("()")) {
      // Function call: getApi() -> "getApi"
      chain.unshift(baseText.slice(0, -2));
    } else if (baseText.endsWith("()?")) {
      // Optional function call: getApi()? -> "getApi"
      chain.unshift(baseText.slice(0, -3));
    } else if (baseText === "this") {
      // this.api.method -> ["this", "api", "method"]
      chain.unshift("this");
    } else {
      // Regular identifier: api -> "api"
      chain.unshift(baseText);
    }
  }

  return chain;
}

/**
 * Check if a member expression chain matches the expected pattern
 * @param chain - Array of property names from getMemberExpressionChain
 * @param objectAliases - Set of valid object aliases
 * @param property - The property name to find
 * @param method - Optional method name that must follow the property
 * @returns boolean indicating if the chain matches
 */
function matchesMemberPattern(
  chain: string[],
  objectAliases: Set<string>,
  property: string,
  method?: string
): boolean {
  if (chain.length < 1) return false;

  // Handle direct property usage (from destructuring)
  if (chain.length === 1) {
    const base = chain[0];
    return objectAliases.has(base) && base === property && !method;
  }

  if (chain.length === 2 && method) {
    // Direct method call: smartGrid.presentModal
    const [base, methodName] = chain;
    return (
      objectAliases.has(base) && base === property && methodName === method
    );
  }

  // Handle normal patterns: alias.property[.method]
  const expectedLength = method ? 3 : 2;
  if (chain.length !== expectedLength) return false;

  const [base, prop, methodName] = chain;

  // Check base object (handle this.alias pattern)
  let validBase = false;
  if (objectAliases.has(base)) {
    validBase = true;
  } else if (
    base === "this" &&
    chain.length > 1 &&
    objectAliases.has(chain[1])
  ) {
    // this.alias.property pattern
    validBase = true;
    // Adjust indices for this.alias pattern
    const adjustedProp = chain[2];
    const adjustedMethod = chain[3];
    return adjustedProp === property && (!method || adjustedMethod === method);
  } else {
    // Check for function calls that might return the object
    const funcCallBase = base.replace(/\?\?$/, ""); // Remove optional chaining
    if (
      funcCallBase.toLowerCase().includes("api") ||
      objectAliases.has(funcCallBase)
    ) {
      validBase = true;
    }
  }

  return validBase && prop === property && (!method || methodName === method);
}

/**
 * Generic utility to find member expressions with specific object and property
 * Uses proper AST traversal instead of string pattern matching
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
  rootNode: SgNode,
  objectAliases: Set<string>,
  property: string,
  method?: string
): SgNode[] {
  const usages: SgNode[] = [];

  // Find all member expressions and call expressions
  const memberExpressions = rootNode.findAll({
    rule: { kind: "member_expression" },
  });

  const callExpressions = rootNode.findAll({
    rule: { kind: "call_expression" },
  });

  // Check member expressions
  for (const node of memberExpressions) {
    const chain = getMemberExpressionChain(node);
    if (matchesMemberPattern(chain, objectAliases, property, method)) {
      usages.push(node);
    }
  }

  // Check call expressions (for method calls)
  if (method) {
    for (const node of callExpressions) {
      const callee = node.field("function");
      if (callee && callee.kind() === "member_expression") {
        const chain = getMemberExpressionChain(callee);
        if (matchesMemberPattern(chain, objectAliases, property, method)) {
          usages.push(node); // Return the call expression, not just the member expression
        }
      }
    }
  }

  // Handle direct identifier usage (from destructuring)
  if (!method) {
    const identifiers = rootNode.findAll({
      rule: { kind: "identifier" },
    });

    for (const identifier of identifiers) {
      const text = identifier.text();
      if (objectAliases.has(text) && text === property) {
        // Make sure it's not part of a larger member expression
        const parent = identifier.parent();
        if (parent && parent.kind() !== "member_expression") {
          usages.push(identifier);
        }
      }
    }
  }

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
export function getImports(
  rootNode: SgNode,
  packageName: string
): ImportInfo[] {
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
  rootNode: SgNode,
  packageName: string,
  importName: string
): SgNode[] {
  const nodes: SgNode[] = [];

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
