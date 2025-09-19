import type { SgRoot, Edit, SgNode } from "codemod:ast-grep";
import type TS from "codemod:ast-grep/langs/typescript";
import {
  isPOSUIExtensionsFile,
  getApiAliases,
  isValidObjectReference,
} from "../../../utils/ast-utils.js";

/**
 * Transform api.smartGrid.presentModal() calls to api.action.presentModal()
 * Handles various patterns including aliases, destructuring, optional chaining, etc.
 * Only applies to files that import from POS UI Extensions packages.
 */
async function transform(root: SgRoot<TS>): Promise<string | null> {
  const rootNode = root.root();

  // Only transform files that import from POS UI Extensions (old or new packages)
  if (!isPOSUIExtensionsFile(rootNode as unknown as SgNode)) {
    return null;
  }

  const edits: Edit[] = [];

  const apiAliases = getApiAliases(rootNode as unknown as SgNode);

  const smartGridProps = rootNode
    .findAll({
      rule: {
        kind: "property_identifier",
      },
    })
    .filter((prop) => prop.text() === "smartGrid");

  for (const prop of smartGridProps) {
    if (!shouldTransformProperty(prop as unknown as SgNode, apiAliases)) {
      continue;
    }

    edits.push(prop.replace("action"));
  }

  return edits.length === 0 ? null : rootNode.commitEdits(edits);
}

/**
 * Determine if a smartGrid property should be transformed
 * Only transforms api.smartGrid.presentModal() patterns
 * @param prop - AST node
 * @param apiAliases - Set of valid API aliases
 */
function shouldTransformProperty(
  prop: SgNode,
  apiAliases: Set<string>
): boolean {
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
  return callExpr ? callExpr.kind() === "call_expression" : false;
}

export default transform;
