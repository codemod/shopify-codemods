import type { SgRoot } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";

async function transform(root: SgRoot<JS>): Promise<string> {
  const rootNode = root.root();
  const edits: string[] = [];

  // 1. Handle import statements - remove Provider from @shopify/app-bridge-react imports
  const importStatements = rootNode.findAll({
    rule: {
      kind: "import_statement",
    },
  });

  for (const importStmt of importStatements) {
    const importText = importStmt.text();
    
    // Check if this is an import from @shopify/app-bridge-react that includes Provider
    if (importText.includes("@shopify/app-bridge-react") && importText.includes("Provider")) {
      // Find the named imports
      const namedImports = importStmt.find({
        rule: {
          kind: "named_imports",
        },
      });
      
      if (namedImports) {
        // Get all import specifiers
        const specifiers = namedImports.findAll({
          rule: {
            kind: "import_specifier",
          },
        });
        
        // Filter out Provider and Provider aliases, keep the rest
        const nonProviderSpecifiers = specifiers.filter(spec => {
          // Check for direct Provider import
          const identifier = spec.find({
            rule: {
              kind: "identifier",
            },
          });
          
          // Check for aliased Provider import (Provider as Something)
          const importSpecifier = spec.find({
            rule: {
              kind: "import_specifier",
            },
          });
          
          if (identifier && identifier.text() === "Provider") {
            return false; // Remove this specifier
          }
          
          // Check if this is an aliased Provider import
          if (importSpecifier) {
            const specText = spec.text();
            if (specText.startsWith("Provider as ")) {
              return false; // Remove this aliased Provider specifier
            }
          }
          
          return true; // Keep this specifier
        });
        
        if (nonProviderSpecifiers.length === 0) {
          // If no other imports, remove the entire import statement
          edits.push(importStmt.replace(""));
        } else {
          // Reconstruct the import with remaining specifiers
          const remainingImports = nonProviderSpecifiers.map(spec => spec.text()).join(", ");
          const newImport = importText.replace(/\{[^}]*\}/, `{ ${remainingImports} }`);
          edits.push(importStmt.replace(newImport));
        }
      }
    }
  }

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
          const content = match[1].trim();
          edits.push(element.replace(content));
        }
      } else if (identifier) {
        // Check if this might be an aliased Provider (we need to check the import statements)
        // For now, we'll use a more flexible approach and check if the element text matches Provider patterns
        const elementText = element.text();
        const providerMatch = elementText.match(/<(\w+)[^>]*>(.*?)<\/\1>/s);
        
        if (providerMatch) {
          const tagName = providerMatch[1];
          const content = providerMatch[2];
          
          // Check if this tag name corresponds to a Provider alias by looking at imports
          const isProviderAlias = importStatements.some(importStmt => {
            const importText = importStmt.text();
            if (importText.includes("@shopify/app-bridge-react") && importText.includes("Provider")) {
              // Check if this import has an alias that matches our tag name
              return importText.includes(`Provider as ${tagName}`);
            }
            return false;
          });
          
          if (isProviderAlias) {
            edits.push(element.replace(content.trim()));
          }
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


