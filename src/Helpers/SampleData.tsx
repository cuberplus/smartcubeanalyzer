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
    return fetch(getDemoDataUrl()).then((r) => {
        if (!r.ok) throw new Error('Failed to load demo data');
        return r.text();
    });
}
