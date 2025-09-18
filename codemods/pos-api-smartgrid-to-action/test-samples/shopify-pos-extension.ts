//Shopify POS UI Extension patterns
// Note: @shopify/pos-ui-extensions types not available in this environment
declare const extend: any;
declare const Modal: any;

export default extend(
  "pos.cart.line-item.action",
  (root: any, { api, ui }: any) => {
    const button = ui.createComponent("Button", {
      title: "Custom Action",
      onPress: async () => {
        // Pattern 1: Basic modal usage
        const result = await api.smartGrid.presentModal({
          kind: "confirmation",
          title: "Confirm Action",
          message: "Are you sure you want to proceed?",
        });

        if (result.reason === "confirm") {
          // Pattern 2: Nested modal calls
          const detailsResult = await api.smartGrid.presentModal({
            kind: "form",
            title: "Enter Details",
            fields: [
              { type: "text", label: "Name", required: true },
              { type: "number", label: "Quantity", required: true },
            ],
          });

          if (detailsResult.reason === "confirm") {
            console.log("Details submitted:", detailsResult.data);
          }
        }
      },
    });

    root.appendChild(button);
  }
);

// Pattern 3: Modal in utility function
async function showCustomModal(api: any, product: any) {
  return await api.smartGrid.presentModal({
    kind: "custom",
    title: `Product: ${product.title}`,
    content: product.description,
  });
}

// Pattern 4: Conditional modal
function maybeShowModal(api: any, condition: boolean) {
  if (condition) {
    return api.smartGrid.presentModal({
      kind: "alert",
      message: "Something happened!",
    });
  }
  return Promise.resolve(null);
}

// Pattern 5: Modal with promise chain
export function handleProductAction(api: any, productId: string) {
  return api.smartGrid
    .presentModal({
      kind: "confirmation",
      title: "Delete Product",
      message: "This action cannot be undone.",
    })
    .then((result: any) => {
      if (result.reason === "confirm") {
        return deleteProduct(productId);
      }
      throw new Error("Action cancelled");
    })
    .catch((error: any) => {
      console.error("Product action failed:", error);
    });
}

function deleteProduct(id: string) {
  // Implementation
  return Promise.resolve();
}
