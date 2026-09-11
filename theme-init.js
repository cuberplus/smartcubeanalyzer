// Applies the saved theme before first paint so the page never flashes the
// wrong colors. Kept as a separate file (rather than inline) so the Content
// Security Policy in index.html can forbid inline script entirely: files in
// public/ are copied verbatim, so no build-time hash has to be maintained.
(function () {
    var stored = localStorage.getItem('theme');
    var theme = (stored === 'dark' || stored === 'light')
        ? stored
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-bs-theme', theme);
})();
