import type { SgRoot, Edit } from "codemod:ast-grep";
import type TS from "codemod:ast-grep/langs/typescript";

// Utilities for API alias detection and validation
function getApiAliases(rootNode: any): Set<string> {
  return getVariableAliases(rootNode, "api", ["smartGrid"]);
}

function getVariableAliases(
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

function isValidObjectReference(
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

/**
 * Transform api.smartGrid.presentModal() calls to api.action.presentModal()
 * Handles various patterns including aliases, destructuring, optional chaining, etc.
 */
async function transform(root: SgRoot<TS>): Promise<string | null> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  // Get all possible aliases for 'api' including destructured 'smartGrid'
  const apiAliases = getApiAliases(rootNode);

  // Find all 'smartGrid' property identifiers in the code
  const smartGridProps = rootNode
    .findAll({
      rule: {
        kind: "property_identifier",
      },
    })
    .filter((prop) => prop.text() === "smartGrid");

  for (const prop of smartGridProps) {
    if (!shouldTransformProperty(prop, apiAliases)) {
      continue;
    }

    // Replace "smartGrid" with "action"
    edits.push(prop.replace("action"));
  }

  return edits.length === 0 ? null : rootNode.commitEdits(edits);
}

/**
 * Determine if a smartGrid property should be transformed
 * Only transforms api.smartGrid.presentModal() patterns
 */
function shouldTransformProperty(prop: any, apiAliases: Set<string>): boolean {
  // Get the parent member expression (e.g., "api.smartGrid")
  const memberExpr = prop.parent();
  if (!memberExpr || memberExpr.kind() !== "member_expression") return false;

  // Check if the object is a valid API reference
  const objectNode = memberExpr.field("object");
  if (!objectNode) return false;

  const objectText = objectNode.text();
  if (!isValidObjectReference(objectText, apiAliases)) return false;

  // Get the outer member expression (e.g., "api.smartGrid.presentModal")
  const outerMemberExpr = memberExpr.parent();
  if (!outerMemberExpr || outerMemberExpr.kind() !== "member_expression") {
    return false;
  }

  // Only transform if the method is "presentModal"
  const property = outerMemberExpr.field("property");
  if (!property || property.text() !== "presentModal") return false;

  // Only transform if this is a function call (not just property access)
  const callExpr = outerMemberExpr.parent();
  return callExpr && callExpr.kind() === "call_expression";
}

export default transform;
