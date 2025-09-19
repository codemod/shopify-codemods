// Basic case
api.smartGrid.presentModal();

// With arguments
api.smartGrid.presentModal(modalData, options);

// Assigned to variable
const result = api.smartGrid.presentModal();

// In method chain (promise)
const response = await api.smartGrid.presentModal().then(handleResponse);

// Alias receiver
const x = api;
x.smartGrid.presentModal({ title: "Hi" });

// Optional chaining
api?.smartGrid.presentModal();
const maybe = getApi()?.smartGrid.presentModal(cfg);

// Spacing and comments should be preserved
api /*A*/.smartGrid /*B*/
  .presentModal /*C*/
  (/*D*/);

// Already migrated (should be NO-OP)
api.action.presentModal(existing);

// Negative: different API object (should NOT transform)
someOtherApi.smartGrid.presentModal();

// Negative: different method (should NOT transform)
api.smartGrid.someOtherMethod();

// Negative: property access only (no call) — should NOT transform
const fn = api.smartGrid.presentModal;
