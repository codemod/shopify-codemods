// JavaScript POS extension patterns
import { extend } from "@shopify/pos-ui-extensions";

export default extend(
  "pos.checkout.customer.smartGrid",
  (root, { api, ui }) => {
    const customerModal = ui.createComponent("Button", {
      title: "Customer Info",
      onPress: () => {
        // Pattern: Arrow function with implicit return
        api.smartGrid.presentModal({
          kind: "form",
          title: "Customer Details",
          fields: [
            { type: "email", label: "Email" },
            { type: "phone", label: "Phone" },
          ],
        });
      },
    });

    // Pattern: Object method
    const modalHelpers = {
      async showConfirmation(message) {
        const result = await api.smartGrid.presentModal({
          kind: "confirmation",
          message: message,
        });
        return result.reason === "confirm";
      },

      showAlert: (title, message) => {
        // Pattern: Arrow function assignment
        return api.smartGrid.presentModal({
          kind: "alert",
          title,
          message,
        });
      },
    };

    // Pattern: Destructured API
    const { smartGrid } = api;
    const showModal = () =>
      smartGrid.presentModal({
        kind: "info",
        title: "Information",
      });

    // Additional edge case patterns
    const myApi = api;
    myApi.smartGrid.presentModal({ kind: "alias" });

    // Optional chaining pattern
    api?.smartGrid.presentModal({ kind: "optional" });

    // Function call pattern
    function getApi() {
      return api;
    }
    getApi().smartGrid.presentModal({ kind: "function" });

    root.appendChild(customerModal);
  }
);
api.smartGrid.presentModal({ kind: "test" }); // Should transform
const myApi = api;
myApi.smartGrid.presentModal(); // Should transform
api?.smartGrid.presentModal(); // Should transform
getApi().smartGrid.presentModal(); // Should transform
