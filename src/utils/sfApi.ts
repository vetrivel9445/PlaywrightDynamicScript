import { getOrgAuthInfo, type OrgAuthInfo } from './orgAuth.js';

/**
 * Lightweight Salesforce REST API client for TEST DATA setup/teardown.
 *
 * Creating records through the UI is slow and flaky; the fastest pattern
 * (used by mature Salesforce automation frameworks) is: create data via the
 * API, verify behavior via the UI, clean up via the API.
 *
 * Fully dynamic — it authenticates with the same CLI-resolved token as the
 * browser login, so it always targets the org connected to VS Code.
 *
 * @example
 *   const api = new SfApi();
 *   const id = await api.createRecord('Invoice__c', { Name: 'INV-001' });
 *   // ... drive the UI against that record ...
 *   await api.deleteRecord('Invoice__c', id);
 */
export class SfApi {
  private readonly base: string;
  private readonly headers: Record<string, string>;

  constructor(
    auth?: OrgAuthInfo,
    apiVersion: string = process.env.SF_API_VERSION ?? '62.0',
  ) {
    const a = auth ?? getOrgAuthInfo();
    this.base = `${a.instanceUrl}/services/data/v${apiVersion}`;
    this.headers = {
      Authorization: `Bearer ${a.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /** Create a record of any object (standard or custom). Returns the new id. */
  async createRecord(
    objectApiName: string,
    fields: Record<string, unknown>,
  ): Promise<string> {
    const res = await fetch(`${this.base}/sobjects/${objectApiName}/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      throw new Error(
        `Create ${objectApiName} failed: HTTP ${res.status} — ${await res.text()}`,
      );
    }
    const json = (await res.json()) as { id: string };
    return json.id;
  }

  /** Run a SOQL query and return the records. */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    soql: string,
  ): Promise<T[]> {
    const res = await fetch(`${this.base}/query?q=${encodeURIComponent(soql)}`, {
      headers: this.headers,
    });
    if (!res.ok) {
      throw new Error(`Query failed: HTTP ${res.status} — ${await res.text()}`);
    }
    const json = (await res.json()) as { records: T[] };
    return json.records;
  }

  /** Delete a record (test-data cleanup). */
  async deleteRecord(objectApiName: string, id: string): Promise<void> {
    const res = await fetch(`${this.base}/sobjects/${objectApiName}/${id}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Delete ${objectApiName}/${id} failed: HTTP ${res.status} — ${await res.text()}`,
      );
    }
  }
}
