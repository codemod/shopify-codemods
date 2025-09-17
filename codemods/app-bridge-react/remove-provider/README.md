# @shopify/app-bridge-react-remove-provider

Remove `Provider` from `@shopify/app-bridge-react` imports and unwrap JSX elements.

## What it does

- Removes `Provider` from named imports of `@shopify/app-bridge-react`
- Handles aliased imports like `Provider as AppProvider`
- Unwraps `<Provider>...</Provider>` JSX elements, leaving only the children
- Unwraps aliased Provider JSX elements like `<AppProvider>...</AppProvider>`
- Removes self-closing `<Provider />` elements
- Handles `React.createElement(Provider, ...)` calls
- Removes entire import statement when only `Provider` is imported

## Usage

```bash
npx codemod@latest workflow run -w workflow.yaml
```

## Examples

### Basic Provider Removal

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

### Aliased Provider Removal

**Before:**
```jsx
import {Provider as AppProvider, TitleBar} from '@shopify/app-bridge-react';

export default function App() {
  return (
    <AppProvider config={{apiKey: 'old', host: 'host'}}>
      <div>
        <TitleBar title="Hello" />
      </div>
    </AppProvider>
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

This codemod uses JSSG (JavaScript Structural Grep) with AST-based transformations:
- **AST node traversal** for finding and transforming import statements
- **AST node traversal** for finding and unwrapping JSX elements
- **Minimal regex** only for content extraction from JSX elements
- **Pure AST patterns** for self-closing elements and React.createElement calls

## References

- [Shopify App Bridge Migration Guide](https://shopify.dev/docs/api/app-bridge/migration-guide#step-3-remove-the-provider-setup)
- [GitHub Issue](https://github.com/codemod/shopify-codemods/issues/11)
