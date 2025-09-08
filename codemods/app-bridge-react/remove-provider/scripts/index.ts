import type { SgRoot } from "codemod:ast-grep";
import type TS from "codemod:ast-grep/langs/typescript";

const META_TAG = '<meta name="shopify-api-key" content="%SHOPIFY_API_KEY%" />';
const SCRIPT_TAG = '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>';

function extractLocalProviderNames(importText: string): Set<string> {
  const names = new Set<string>();
  const brace = importText.match(/\{([\s\S]*?)\}/m);
  if (!brace) return names;
  const group = brace[1];
  const parts = group.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    // Matches: Provider or Provider as Alias
    const aliasMatch = /^Provider\s+as\s+([A-Za-z_$][\w$]*)$/.exec(part);
    if (aliasMatch) {
      names.add(aliasMatch[1]);
      continue;
    }
    if (/^Provider$/.test(part)) {
      names.add("Provider");
    }
  }
  return names;
}

function rewriteImportRemovingProvider(importText: string): string | null {
  // Remove Provider from named specifiers while preserving original whitespace style inside braces.
  const brace = importText.match(/\{([\s\S]*?)\}/m);
  if (!brace) return importText;
  const full = brace[0];
  const group = brace[1];

  // Remove entries of the form "Provider" or "Provider as Alias" with optional surrounding comma/whitespace
  let newGroup = group
    // remove when followed by comma
    .replace(/(^|,)\s*Provider(\s+as\s+[A-Za-z_$][\w$]*)?\s*(?=,)/g, (m, p1) => p1)
    // remove when at end
    .replace(/(^|,)\s*Provider(\s+as\s+[A-Za-z_$][\w$]*)?\s*$/g, (m, p1) => p1)
    // cleanup duplicate commas
    .replace(/,,+/g, ",")
    // trim stray commas/whitespace at ends
    .replace(/^\s*,\s*/, "")
    .replace(/\s*,\s*$/, "")
    ;

  // If nothing left in named import
  if (newGroup.trim().length === 0) {
    // Case: import Default, { Provider } from '...'
    let rewritten = importText.replace(/,\s*\{[\s\S]*?\}/m, "");
    if (rewritten === importText) {
      // Case: import { Provider } from '...' -> remove whole import
      return null;
    }
    return rewritten;
  }

  // Replace the braces content preserving original spaces around braces
  const newFull = full.replace(group, newGroup);
  return importText.replace(full, newFull);
}

function injectTagsIntoNextHead(source: string): string {
  const hasMeta = /<meta\s+name=["']shopify-api-key["']/.test(source);
  const hasScript = /<script[^>]*shopifycloud\/app-bridge\.js/.test(source);
  if (hasMeta && hasScript) return source;
  // Add to the first <Head> occurrence if present
  if (/<Head[\s>]/.test(source)) {
    return source.replace(/(<Head[^>]*>)/, (_m, p1) => {
      let additions = "";
      if (!hasMeta) additions += `\n${META_TAG}`;
      if (!hasScript) additions += `\n${SCRIPT_TAG}`;
      return `${p1}${additions}`;
    });
  }
  return source;
}

async function transform(root: SgRoot<TS>): Promise<string> {
  const rootNode = root.root();

  // Gather import edits and local Provider aliases using pattern-only queries
  const importNodes = [
    ...rootNode.findAll({ rule: { pattern: 'import { $$$SPECS } from "@shopify/app-bridge-react"' } }),
    ...rootNode.findAll({ rule: { pattern: "import { $$$SPECS } from '@shopify/app-bridge-react'" } }),
    ...rootNode.findAll({ rule: { pattern: 'import $DEFAULT, { $$$SPECS } from "@shopify/app-bridge-react"' } }),
    ...rootNode.findAll({ rule: { pattern: "import $DEFAULT, { $$$SPECS } from '@shopify/app-bridge-react'" } }),
  ];

  const localProviderNames = new Set<string>();
  const edits: string[] = [];

  for (const imp of importNodes) {
    const text = imp.text();
    const names = extractLocalProviderNames(text);
    names.forEach((n) => localProviderNames.add(n));

    if (names.size > 0) {
      const rewritten = rewriteImportRemovingProvider(text);
      if (rewritten === null) {
        edits.push(imp.replace(""));
      } else if (rewritten !== text) {
        edits.push(imp.replace(rewritten));
      }
    }
  }

  // Unwrap Provider elements and remove self-closing instances
  for (const localName of localProviderNames) {
    const wrapNodes = rootNode.findAll({
      rule: { pattern: `<${localName} $$$PROPS>$$$BODY</${localName}>` },
    });
    for (const node of wrapNodes) {
      const body = node.getMatch("BODY")?.text() ?? "";
      edits.push(node.replace(body));
    }

    const selfClosing = rootNode.findAll({
      rule: { pattern: `<${localName} $$$PROPS />` },
    });
    for (const node of selfClosing) {
      edits.push(node.replace(""));
    }

    // React.createElement variants
    const createCalls = rootNode.findAll({
      rule: { pattern: `React.createElement(${localName}, $PROPS, $CHILD)` },
    });
    for (const call of createCalls) {
      const child = call.getMatch("CHILD")?.text() ?? "";
      edits.push(call.replace(child));
    }

    const createCalls2 = rootNode.findAll({
      rule: { pattern: `createElement(${localName}, $PROPS, $CHILD)` },
    });
    for (const call of createCalls2) {
      const child = call.getMatch("CHILD")?.text() ?? "";
      edits.push(call.replace(child));
    }
  }

  const sourceAfterProvider = rootNode.commitEdits(edits);

  // Fallback: if Provider wrappers still exist, unwrap via regex (for safety in edge cases)
  let finalAfterProvider = sourceAfterProvider;
  for (const localName of localProviderNames) {
    const hasWrapper = new RegExp(`<${localName}[^>]*>[\\s\\S]*?</${localName}>`).test(finalAfterProvider);
    if (hasWrapper) {
      const re = new RegExp(`(^[ \t]*)<${localName}[^>]*>([\\s\\S]*?)^[ \t]*</${localName}>`, 'gm');
      finalAfterProvider = finalAfterProvider.replace(re, (_match, indent0: string, body: string) => {
        // Normalize leading/trailing blank lines once
        let inner = body;
        if (inner.startsWith("\n")) inner = inner.slice(1);
        if (inner.endsWith("\n")) inner = inner.slice(0, -1);

        const lines = inner.split("\n");
        // Determine indent step from first non-empty line
        let indentStep = "";
        for (const line of lines) {
          if (line.trim().length === 0) continue;
          const m = line.match(/^[ \t]*/)?.[0] ?? "";
          if (m.startsWith(indent0)) {
            indentStep = m.slice(indent0.length);
          }
          break;
        }

        if (indentStep.length === 0) {
          return lines.map((ln) => (ln.length ? indent0 + ln : ln)).join("\n");
        }

        const dedented = lines.map((ln) => {
          const prefix = indent0 + indentStep;
          if (ln.startsWith(prefix)) return ln.slice(prefix.length);
          return ln;
        });
        return dedented.map((ln) => (ln.length ? indent0 + ln : ln)).join("\n");
      });
    }
    // Remove self-closing leftovers
    finalAfterProvider = finalAfterProvider.replace(new RegExp(`<${localName}[^>]*/>`, 'g'), '');
  }

  // Inject Next.js Head tags if present
  const finalSource = injectTagsIntoNextHead(finalAfterProvider);
  return finalSource;
}

export default transform;


