/**
 * Browser shim for Node's `child_process` module.
 * Some transitive dependencies reference it even in browser bundles.
 */
export function spawn() {
    throw new Error('child_process.spawn is not available in browser environments.');
}
export default { spawn };
