// Basic case
api.action.presentModal();

// With arguments
api.action.presentModal(modalData, options);

// Assigned to variable
const result = api.action.presentModal();

// In method chain (promise)
const response = await api.action.presentModal().then(handleResponse);

// Alias receiver
const x = api;
x.action.presentModal({ title: "Hi" });

// Optional chaining
api?.action.presentModal();
const maybe = getApi()?.action.presentModal(cfg);

// Spacing and comments should be preserved
api /*A*/.action /*B*/
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
