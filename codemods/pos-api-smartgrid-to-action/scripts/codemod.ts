import type { SgRoot, Edit } from "codemod:ast-grep";
import type TS from "codemod:ast-grep/langs/typescript";

async function transform(root: SgRoot<TS>): Promise<string | null> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  const smartGridProperties = rootNode
    .findAll({
      rule: {
        kind: "property_identifier",
      },
    })
    .filter((prop) => prop.text() === "smartGrid");

  const apiAliases = new Set<string>();
  apiAliases.add("api"); // Always include 'api'

  const aliasAssignments = rootNode.findAll({
    rule: { pattern: "const $VAR = api" },
  });

  for (const assignment of aliasAssignments) {
    const varName = assignment.getMatch("VAR")?.text();
    if (varName) {
      apiAliases.add(varName);
    }
  }

  for (const smartGridProp of smartGridProperties) {
    // Get the parent member expression (e.g., "api.smartGrid")
    const memberExpr = smartGridProp.parent();
    if (!memberExpr || memberExpr.kind() !== "member_expression") continue;

    // Check if the object of this member expression is 'api' or an alias
    const objectNode = memberExpr.field("object");
    if (!objectNode) continue;

    const objectText = objectNode.text();
    const isApiOrAlias =
      apiAliases.has(objectText) ||
      objectText === "api?" ||
      objectText.endsWith("()") ||
      objectText.endsWith("()?");

    if (!isApiOrAlias) continue;

    // Get the grandparent which should be the outer member expression (e.g., "api.smartGrid.presentModal")
    const outerMemberExpr = memberExpr.parent();
    if (!outerMemberExpr || outerMemberExpr.kind() !== "member_expression")
      continue;

    const property = outerMemberExpr.field("property");
    if (property && property.text() === "presentModal") {
      // Only transform if this is a function call (has call_expression as parent)
      const callExpr = outerMemberExpr.parent();
      if (callExpr && callExpr.kind() === "call_expression") {
        edits.push(smartGridProp.replace("action"));
      }
    }
  }

  if (edits.length === 0) {
    return null;
  }

  return rootNode.commitEdits(edits);
}

export default transform;
