import type { SgRoot } from "codemod:ast-grep";
import type TS from "codemod:ast-grep/langs/typescript";

const META_TAG = '<meta name="shopify-api-key" content="%SHOPIFY_API_KEY%" />';
const SCRIPT_TAG = '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>';

function ensureHeadHasTags(headText: string): string {
  const hasMeta = /<meta\s+name=["']shopify-api-key["']/.test(headText);
  const hasScript = /<script[^>]*shopifycloud\/app-bridge\.js/.test(headText);
  let updated = headText;
  if (!hasMeta) {
    // Insert meta before first closing tag content if possible
    updated = updated.replace(/(<Head[^>]*>)/, `$1\n${META_TAG}`);
  }
  if (!hasScript) {
    updated = updated.replace(/(<Head[^>]*>)/, `$1\n${SCRIPT_TAG}`);
  }
  return updated;
}

async function transform(root: SgRoot<TS>): Promise<string> {
  const rootNode = root.root();

  // Ensure there's an import from next/head when we insert Head
  const program = rootNode;
  let source = program.text();

  // Find JSX <Head> elements
  const headElements = rootNode.findAll({
    rule: {
      kind: "jsx_element",
      has: { kind: "jsx_identifier", regex: "^Head$" },
    },
  });

  if (headElements.length > 0) {
    // Inject into all Head instances
    let newSource = source;
    for (const head of headElements) {
      const before = head.text();
      const after = ensureHeadHasTags(before);
      if (after !== before) {
        newSource = newSource.replace(before, after);
      }
    }
    // Make sure there is an import of Head from next/head if we used Head
    if (newSource !== source) {
      source = newSource;
      const reRoot = root.fromSource(source);
      const reNode = reRoot.root();
      const hasHeadImport = reNode.find({
        rule: {
          kind: "import_statement",
          has: { kind: "string", regex: "^next/head$" },
        },
      });

      if (!hasHeadImport) {
        // Insert import at top
        source = `import Head from "next/head";\n${source}`;
      }
    }
    return source;
  }

  // If no Head elements but file imports next/head as Head and uses it self-closing or similar
  // Try to add one into the main component return if we detect React component
  const rootWithHeadImport = rootNode.find({
    rule: {
      kind: "import_statement",
      has: { kind: "string", regex: "^next/head$" },
    },
  });

  if (rootWithHeadImport) {
    // Attempt to find a top-level return of JSX and prepend Head inside the top JSX fragment
    const returns = rootNode.findAll({
      rule: { pattern: "return (<$$$JSX>)" },
    });
    for (const ret of returns) {
      const jsx = ret.getMatch("JSX")?.text() ?? "";
      if (!jsx) continue;
      if (/<Head[\s>]/.test(jsx)) continue; // already has Head
      const headBlock = `<Head>\n  ${META_TAG}\n  ${SCRIPT_TAG}\n</Head>`;
      const injected = jsx.replace(/^(<[^>]+>)/, `$1\n  ${headBlock}`);
      if (injected !== jsx) {
        return rootNode.text().replace(jsx, injected);
      }
    }
  }

  return rootNode.text();
}

export default transform;


