/** Lets component tests import *.module.css under node: every class name maps to itself. */
const ext = (require as any).extensions;
ext['.css'] = (module: any) => {
  module.exports = new Proxy({}, { get: (_t, key) => (key === '__esModule' ? false : String(key)) });
};
