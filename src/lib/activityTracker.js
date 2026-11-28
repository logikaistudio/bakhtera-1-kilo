/**
 * Automatic activity tracking for Supabase REST writes.
 * Wraps fetch so every successful POST/PATCH/DELETE to /rest/v1/<table>
 * is recorded in activity_logs, without touching individual pages.
 */

const SKIP_TABLES = new Set(['activity_logs', 'user_sessions']);
const SKIP_UPDATE_ONLY_FIELDS = new Set(['last_login', 'updated_at']);
const NAME_FIELDS = ['entity_name', 'name', 'code', 'number', 'invoice_no', 'quotation_no', 'title', 'description', 'sku'];
const ACTION_BY_METHOD = { POST: 'add', PATCH: 'edit', DELETE: 'delete' };

let currentActor = null;

export const setActivityActor = (user) => {
    currentActor = user
        ? {
            id: user.id ?? null,
            name: user.full_name || user.name || user.username || null,
            username: user.username || null
        }
        : null;
};

export const getActivityActor = () => currentActor;

const parseTarget = (url) => {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/rest\/v1\/([^/?]+)/);
    if (!match || match[1] === 'rpc') return null;

    let entityId = null;
    for (const [key, value] of parsed.searchParams.entries()) {
        if (value.startsWith('eq.') && key !== 'select') {
            entityId = value.slice(3);
            break;
        }
    }
    return { table: match[1], entityId, search: parsed.search.slice(0, 300) };
};

const parseBody = (body) => {
    if (typeof body !== 'string') return null;
    try {
        return JSON.parse(body);
    } catch {
        return null;
    }
};

const pickName = (row) => {
    if (!row || typeof row !== 'object') return null;
    const field = NAME_FIELDS.find((key) => row[key] !== undefined && row[key] !== null && row[key] !== '');
    return field ? String(row[field]) : null;
};

const buildEntry = ({ method, url, body, prefer, pathname }) => {
    const target = parseTarget(url);
    if (!target || SKIP_TABLES.has(target.table)) return null;

    let action = ACTION_BY_METHOD[method];
    if (method === 'POST' && /merge-duplicates/.test(prefer || '')) action = 'edit';

    const payload = parseBody(body);
    const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
    const fields = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];

    if (action === 'edit' && fields.length > 0 && fields.every((f) => SKIP_UPDATE_ONLY_FIELDS.has(f))) {
        return null;
    }

    const firstRow = rows[0] || {};
    const entityId = target.entityId ?? (firstRow.id != null ? String(firstRow.id) : 'unknown');
    const entityName = pickName(firstRow) || entityId;

    let details;
    if (method === 'DELETE') details = `Deleted record from ${target.table}`;
    else if (method === 'POST') details = `Created ${rows.length || 1} row(s) in ${target.table}`;
    else details = `Updated ${target.table}: ${fields.join(', ')}`;

    const module = (pathname || '').split('/').filter(Boolean)[0];

    return {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date().toISOString(),
        module: module ? module.charAt(0).toUpperCase() + module.slice(1) : 'System',
        action,
        entity_type: target.table,
        entity_id: entityId,
        entity_name: entityName,
        user_id: currentActor?.id ?? null,
        user_email: null,
        user_name: currentActor?.name ?? null,
        details,
        metadata: { method, table: target.table, fields, rows: rows.length, filter: target.search },
        created_at: new Date().toISOString()
    };
};

export const createTrackedFetch = ({ baseUrl, apiKey }) => {
    return async (input, init = {}) => {
        const response = await fetch(input, init);

        const method = (init.method || 'GET').toUpperCase();
        if (!ACTION_BY_METHOD[method] || !response.ok) return response;

        try {
            const url = typeof input === 'string' ? input : input.url;
            const headers = new Headers(init.headers || {});
            const entry = buildEntry({
                method,
                url,
                body: init.body,
                prefer: headers.get('Prefer'),
                pathname: typeof window !== 'undefined' ? window.location.pathname : ''
            });

            if (entry) {
                // Uses global fetch directly so the log insert is not tracked again.
                fetch(`${baseUrl}/rest/v1/activity_logs`, {
                    method: 'POST',
                    headers: {
                        apikey: apiKey,
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=minimal'
                    },
                    body: JSON.stringify(entry)
                }).catch((err) => console.error('Activity tracking failed:', err));
            }
        } catch (err) {
            console.error('Activity tracking error:', err);
        }

        return response;
    };
};
