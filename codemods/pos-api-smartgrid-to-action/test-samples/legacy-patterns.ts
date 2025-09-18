// Legacy patterns that might exist in older Shopify codebases
declare const api: any;

// Pattern 1: Class-based components
class ModalManager {
  private api: any;

  constructor(apiInstance: any) {
    this.api = apiInstance;
  }

  async showDialog(options: any) {
    // Should be transformed
    return await this.api.smartGrid.presentModal(options);
  }

  async confirmAction(message: string) {
    // Should be transformed
    const result = await this.api.smartGrid.presentModal({
      kind: "confirmation",
      message: message,
    });

    return result.reason === "confirm";
  }

  // Should NOT be transformed - different method
  hideModal() {
    return this.api.smartGrid.closeModal();
  }
}

// Pattern 2: Complex expressions
const modalActions = {
  bulk: {
    confirm: (items: any[]) =>
      api.smartGrid.presentModal({
        kind: "confirmation",
        title: `Process ${items.length} items?`,
        message: "This will update all selected items.",
      }),
  },
};

// Pattern 3: Higher-order function
function withModal(api: any) {
  return function (options: any) {
    return api.smartGrid.presentModal(options);
  };
}

const showModal = withModal(api);

// Pattern 4: Async/await with error handling
async function safeShowModal(api: any, options: any) {
  try {
    const result = await api.smartGrid.presentModal(options);
    return { success: true, result };
  } catch (error) {
    console.error("Modal failed:", error);
    return { success: false, error };
  }
}

// Pattern 5: Template literals and dynamic content
function showProductModal(api: any, product: any) {
  return api.smartGrid.presentModal({
    kind: "info",
    title: `Product: ${product.title}`,
    message: `
      Price: ${product.price}
      Stock: ${product.inventory}
    `.trim(),
  });
}

// Additional edge case test patterns
function testThisApiPattern(this: any, api: any, options: any) {
  return this?.api?.smartGrid.presentModal(options); // Should transform
}
