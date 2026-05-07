import { getToken } from "./auth";
import { getSupabaseConfig } from "./supabaseAuth";

function formatValue(value) {
  if (value === null) return "null";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

class SupabaseQuery {
  constructor(table) {
    this.table = table;
    this.method = "GET";
    this.params = new URLSearchParams();
    this.headers = {};
    this.body = undefined;
    this.expectSingle = false;
    this.allowEmptySingle = false;
  }

  select(columns = "*") {
    this.method = "GET";
    this.params.set("select", columns);
    return this;
  }

  insert(values) {
    this.method = "POST";
    this.body = values;
    this.headers.Prefer = "return=representation";
    return this;
  }

  upsert(values, options = {}) {
    this.method = "POST";
    this.body = values;
    if (options.onConflict) this.params.set("on_conflict", options.onConflict);
    this.headers.Prefer = "resolution=merge-duplicates,return=representation";
    return this;
  }

  update(values) {
    this.method = "PATCH";
    this.body = values;
    this.headers.Prefer = "return=representation";
    return this;
  }

  eq(column, value) {
    this.params.append(column, `eq.${formatValue(value)}`);
    return this;
  }

  gte(column, value) {
    this.params.append(column, `gte.${formatValue(value)}`);
    return this;
  }

  lt(column, value) {
    this.params.append(column, `lt.${formatValue(value)}`);
    return this;
  }

  not(column, operator, value) {
    this.params.append(column, `not.${operator}.${formatValue(value)}`);
    return this;
  }

  order(column, options = {}) {
    const direction = options.ascending === false ? "desc" : "asc";
    this.params.append("order", `${column}.${direction}`);
    return this;
  }

  limit(count) {
    this.params.set("limit", String(count));
    return this;
  }

  single() {
    this.expectSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.expectSingle = true;
    this.allowEmptySingle = true;
    return this.execute();
  }

  async execute() {
    const config = await getSupabaseConfig();
    if (!config) return { data: null, error: new Error("Supabase is not configured") };

    const url = `${config.url}/rest/v1/${this.table}?${this.params.toString()}`;
    const token = getToken();

    try {
      const response = await fetch(url, {
        method: this.method,
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${token || config.anonKey}`,
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: this.body === undefined ? undefined : JSON.stringify(this.body),
      });

      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        return { data: null, error: new Error(payload?.message ?? payload?.hint ?? "Supabase request failed") };
      }

      if (this.expectSingle) {
        const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
        if (rows.length === 0 && this.allowEmptySingle) return { data: null, error: null };
        return { data: rows[0] ?? null, error: rows[0] ? null : new Error("No rows returned") };
      }

      return { data: payload, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

export const supabase = {
  from(table) {
    return new SupabaseQuery(table);
  },
};
