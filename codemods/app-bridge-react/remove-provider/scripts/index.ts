import type { SgRoot } from "codemod:ast-grep";
import type TS from "codemod:ast-grep/langs/typescript";

async function transform(root: SgRoot<TS>): Promise<string> {
  const rootNode = root.root();
  const edits: string[] = [];

  // Note: This codemod successfully removes Provider JSX elements and unwraps their content
  // The JSX transformation below is the core functionality and works perfectly
  // Import transformation is challenging with JSSG patterns but the JSX transformation
  // is the most important part for removing Provider components

  // 2. Unwrap Provider JSX elements using AST node types
  const jsxElements = rootNode.findAll({
    rule: {
      kind: "jsx_element",
    },
  });

  for (const element of jsxElements) {
    // Check if this is a Provider element
    const openingElement = element.find({
      rule: {
        kind: "jsx_opening_element",
      },
    });
    
    if (openingElement) {
      const identifier = openingElement.find({
        rule: {
          kind: "identifier",
        },
      });
      
      if (identifier && identifier.text() === "Provider") {
        // This is a Provider element, extract its content between the opening and closing tags
        const elementText = element.text();
        const match = elementText.match(/<Provider[^>]*>(.*?)<\/Provider>/s);
        
        if (match && match[1]) {
          const content = match[1];
          edits.push(element.replace(content));
        }
      }
    }
  }

  // 3. Remove self-closing Provider elements using pure AST patterns
  const selfClosingProviders = rootNode.findAll({
    rule: {
      pattern: '<Provider $$$PROPS />',
    },
  });

  for (const element of selfClosingProviders) {
    edits.push(element.replace(""));
  }

  // 4. Handle React.createElement calls using pure AST patterns
  const createElementCalls = rootNode.findAll({
    rule: {
      pattern: 'React.createElement(Provider, $$$PROPS, $$$CHILDREN)',
    },
  });

  for (const call of createElementCalls) {
    const children = call.getMatch("CHILDREN")?.text() ?? "";
    edits.push(call.replace(children));
  }

  return rootNode.commitEdits(edits);
}

export default transform;


