#!/bin/bash

set -euo pipefail

META_TAG='<meta name="shopify-api-key" content="%SHOPIFY_API_KEY%" />'
SCRIPT_TAG='<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>'

shopt -s globstar nullglob

for file in **/*.html; do
  [ -f "$file" ] || continue
  content="$(cat "$file")"

  if [[ "$content" != *"shopify-api-key"* ]]; then
    # insert meta after <head>
    content="$(printf '%s' "$content" | perl -0777 -pe "s|(\<head[^>]*\>)|\$1\n$META_TAG|i")"
  fi

  if [[ "$content" != *"shopifycloud/app-bridge.js"* ]]; then
    # insert script after <head> (or after meta if we just inserted it)
    content="$(printf '%s' "$content" | perl -0777 -pe "s|(\<head[^>]*\>)|\$1\n$SCRIPT_TAG|i")"
  fi

  printf '%s' "$content" > "$file"
done

exit 0

