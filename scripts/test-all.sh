#!/bin/bash

# Test jssg codemods using Codemod CLI native features
set -e

echo "🧪 Testing jssg codemods..."

# Find jssg codemods (those with js-ast-grep in workflow.yaml)
find codemods -name "workflow.yaml" | while read -r workflow; do
    recipe_dir=$(dirname "$workflow")
    recipe_name=$(basename "$recipe_dir")
    
    # Check if it's a jssg codemod
    if grep -q "js-ast-grep:" "$workflow"; then
        echo ""
        echo "📁 Testing jssg codemod: $recipe_name..."
        
        # Validate workflow first
        echo "  ✅ Validating workflow..."
        npx codemod@latest workflow validate --workflow "$workflow"
        
        # Run jssg tests
        echo "  🧪 Running jssg tests..."
        js_file=$(grep "js_file:" "$workflow" | sed 's/.*js_file:\s*["'\'']*\([^"'\'']*\)["'\'']*.*/\1/' | tr -d ' ')
        language=$(grep "language:" "$workflow" | sed 's/.*language:\s*["'\'']*\([^"'\'']*\)["'\'']*.*/\1/' | tr -d ' ')
        if [ -z "$language" ]; then
            language="typescript"
        fi
        
        # Check if test fixtures exist
        if [ -d "$recipe_dir/tests" ] && [ -f "$recipe_dir/tests/fixtures/input.js" ] && [ -f "$recipe_dir/tests/fixtures/expected.js" ]; then
            npx codemod@latest jssg test -l "$language" "$recipe_dir/$js_file" "$recipe_dir/tests"
        else
            echo "  ⚠️  Skipping tests - incomplete test fixtures (missing input.js or expected.js)"
        fi
        
        echo "  ✅ $recipe_name tests completed"
    fi
done

echo ""
echo "🎉 All jssg codemod tests completed successfully!"