import type { SgRoot } from "codemod:ast-grep";
import type TS from "codemod:ast-grep/langs/typescript";

type ImportInfo = {
  importNodeText: string;
  localProviderNames: Set<string>;
};

function extractLocalNameFromSpecifier(specText: string): string | null {
  // Handles: "Provider" or "Provider as Alias"
  const trimmed = specText.trim();
  const m = /^Provider\s+as\s+([A-Za-z_$][\w$]*)$/.exec(trimmed);
  if (m) return m[1];
  if (/^Provider$/.test(trimmed)) return "Provider";
  return null;
}

function removeProviderFromImport(importText: string): string | null {
  // Removes Provider specifier from a named import of @shopify/app-bridge-react.
  // If no specifiers remain, returns null to indicate the import should be deleted.
  const importRegex = /(import\s*\{)([\s\S]*?)(\}\s*from\s*["']@shopify\/app-bridge-react["']\s*;?)/m;
  const match = importText.match(importRegex);
  if (!match) return importText;

  const open = match[1];
  const specGroup = match[2];
  const tail = match[3];

  // Split specifiers by commas (tolerate newlines and spaces)
  const parts = specGroup
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const kept = parts.filter((piece) => extractLocalNameFromSpecifier(piece) === null);

  if (kept.length === 0) {
    return null; // remove whole import
  }

  // Reconstruct with original style minimal: single-line joined by ", "
  return `${open} ${kept.join(", ")} ${tail}`;
}

async function transform(root: SgRoot<TS>): Promise<string> {
  const rootNode = root.root();

  // 1) Find all named import specifiers of Provider from @shopify/app-bridge-react
  const providerSpecifiers = rootNode.findAll({
    rule: {
      kind: "import_specifier",
      inside: {
        kind: "import_statement",
        has: {
          kind: "string",
          regex: "@shopify/app-bridge-react",
        },
      },
    },
  });

  // Build map from import_statement text -> info
  const importNodes = rootNode.findAll({
    rule: {
      kind: "import_statement",
      has: {
        kind: "string",
        regex: "@shopify/app-bridge-react",
      },
    },
  });

  const importTextToInfo = new Map<string, ImportInfo>();

  for (const imp of importNodes) {
    importTextToInfo.set(imp.text(), {
      importNodeText: imp.text(),
      localProviderNames: new Set<string>(),
    });
  }

  for (const spec of providerSpecifiers) {
    // Only count specifiers that actually import Provider (possibly with alias)
    const specText = spec.text();
    const localName = extractLocalNameFromSpecifier(specText);
    if (!localName) continue;

    // Attach to its containing import statement
    const imp = spec.closest({ rule: { kind: "import_statement" } });
    if (imp) {
      const info = importTextToInfo.get(imp.text());
      if (info) {
        info.localProviderNames.add(localName);
      }
    }
  }

  // 2) Remove Provider from the imports and collect local names used
  const importEdits = [] as { original: string; replacement: string }[];
  const allLocalProviderNames = new Set<string>();

  for (const [text, info] of importTextToInfo.entries()) {
    if (info.localProviderNames.size === 0) continue; // nothing to change in this import
    const replaced = removeProviderFromImport(text);
    if (replaced === null) {
      importEdits.push({ original: text, replacement: "" });
    } else if (replaced !== text) {
      importEdits.push({ original: text, replacement: replaced });
    }
    // Aggregate local provider names
    info.localProviderNames.forEach((n) => allLocalProviderNames.add(n));
  }

  // Apply import edits first
  let newSource = rootNode.text();
  for (const edit of importEdits) {
    // Replace the first occurrence only to avoid double replacements
    newSource = newSource.replace(edit.original, edit.replacement);
  }

  // Re-parse after import edits to perform JSX transformations reliably
  if (importEdits.length > 0) {
    const reRoot = root.fromSource(newSource);
    const reNode = reRoot.root();

    // 3) Unwrap <Provider>...</Provider> for each local name
    for (const localName of allLocalProviderNames) {
      // Full element with children: <Local ...> BODY </Local>
      const jsxNodes = reNode.findAll({
        rule: {
          pattern: `<${localName} $$$PROPS>$$$BODY</${localName}>`,
        },
      });

      const edits = jsxNodes.map((n) => {
        const body = n.getMatch("BODY")?.text() ?? "";
        return n.replace(body);
      });

      const afterUnwrap = reNode.commitEdits(edits);
      const reRoot2 = reRoot.fromSource(afterUnwrap);
      const reNode2 = reRoot2.root();

      // Self-closing variant: <Local ... /> -> remove
      const selfClosing = reNode2.findAll({
        rule: {
          pattern: `<${localName} $$$PROPS />`,
        },
      });
      const edits2 = selfClosing.map((n) => n.replace(""));
      newSource = reNode2.commitEdits(edits2);

      // Replace createElement(Local, props, child) -> child (only when exactly one child arg exists)
      const reRoot3 = reRoot2.fromSource(newSource);
      const reNode3 = reRoot3.root();
      const createCalls = reNode3.findAll({
        rule: {
          pattern: `React.createElement(${localName}, $$$ARGS)`,
        },
      });

      const edits3 = [] as string[];
      for (const call of createCalls) {
        // Try to capture three-arg form specifically
        const single = call.find({ rule: { pattern: `React.createElement(${localName}, $PROPS, $CHILD)` } });
        if (single) {
          const child = single.getMatch("CHILD")?.text() ?? "";
          edits3.push(single.replace(child));
        }
      }
      newSource = reNode3.commitEdits(edits3);
    }
  }

  return newSource;
}

export default transform;


