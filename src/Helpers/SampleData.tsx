/**
 * Loads demo solve data from the static CSV file.
 * The CSV is served from public/demo-solves.csv to keep the main bundle small.
 * Uses a URL relative to the app base path so it works when the app is served from root (/) or a subpath (e.g. /smartcubeanalyzer), with or without a trailing slash.
 */
function getDemoDataUrl(): string {
    if (typeof process !== 'undefined' && process.env.PUBLIC_URL) {
        return `${process.env.PUBLIC_URL.replace(/\/?$/, '')}/demo-solves.csv`;
    }
    const pathname = window.location.pathname;
    const basePath = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return `${window.location.origin}${basePath}demo-solves.csv`;
}

export function GetDemoData(): Promise<string> {
    // Ask for CSV explicitly: a dev server hosting the app under a base path
    // redirects to the right URL for a CSV request, but answers a generic
    // request with the SPA's index.html fallback.
    return fetch(getDemoDataUrl(), { headers: { Accept: 'text/csv' } }).then((r) => {
        if (!r.ok) throw new Error('Failed to load demo data');
        return r.text();
    }).then((text) => {
        // Parsing an HTML page as a CSV silently produces junk solves and empty charts.
        if (text.trimStart().startsWith('<')) throw new Error('Demo data request returned a web page instead of the CSV');
        return text;
    });
}
