/**
 * Disabled legacy helper retained as an explicit stop: example regeneration now needs
 * a reviewed authenticated workflow, rather than a script that bypasses private access.
 */
// The old public-demo helper cannot authenticate to the private workspace.
// It must never acquire an automatic login bypass or use confidential data.
console.error('Automatic example regeneration is disabled. Use the existing fictional example; regenerate only through a reviewed, authenticated development workflow.');
process.exitCode = 1;
