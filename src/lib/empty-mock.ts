export const AsyncLocalStorage = class {
  getStore() { return undefined; }
  run(store: any, callback: any) { return callback(); }
};
export default { AsyncLocalStorage };
