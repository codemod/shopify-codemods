# @shopify/app-bridge-react-remove-provider

Remove `Provider` from `@shopify/app-bridge-react` imports and unwrap JSX elements.

## What it does

- Removes `Provider` from named imports of `@shopify/app-bridge-react`
- Unwraps `<Provider>...</Provider>` JSX elements, leaving only the children
- Removes self-closing `<Provider />` elements
- Handles aliased imports like `Provider as AppProvider`

## Usage

```bash
npx codemod@latest workflow run -w workflow.yaml
```

## Example

**Before:**
```jsx
import {Provider, TitleBar} from '@shopify/app-bridge-react';

export default function App() {
  return (
    <Provider config={{apiKey: 'old', host: 'host'}}>
      <div>
        <TitleBar title="Hello" />
      </div>
    </Provider>
  );
}
```

**After:**
```jsx
import { TitleBar } from '@shopify/app-bridge-react';

export default function App() {
  return (
    <div>
        <TitleBar title="Hello" />
      </div>
  );
}
```

## Implementation

This codemod uses a hybrid approach:
- **AST patterns** for import statement transformations (reliable and precise)
- **Targeted regex** for JSX unwrapping (AST patterns for JSX weren't working reliably in JSSG)

## References

- [Shopify App Bridge Migration Guide](https://shopify.dev/docs/api/app-bridge/migration-guide#step-3-remove-the-provider-setup)
- [GitHub Issue](https://github.com/codemod/shopify-codemods/issues/11)
