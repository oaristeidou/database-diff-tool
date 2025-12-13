import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';

type DiffResult = {
  schema: string;
  table: string;
  keyColumn: string;
  added: any[];
  removed: any[];
  changed: { key: string; leftRow: any; rightRow: any; changedColumns: string[] }[];
};

type TableDiff = {
  table: string;
  keyColumn?: string | null;
  result?: DiffResult | null;
  error?: string | null;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, NgIf, NgFor],
  template: `
  <div class="container">
    <h1>Oracle DB Diff Viewer</h1>
    <form (submit)="onSubmit($event)">
      <label>
        Schema
        <input name="schema" [(ngModel)]="schema" placeholder="e.g. HR" />
      </label>
      <label>
        Table*
        <input name="table" required [(ngModel)]="table" placeholder="e.g. EMPLOYEES" />
      </label>
      <label>
        Key column*
        <input name="key" required [(ngModel)]="key" placeholder="e.g. EMPLOYEE_ID" />
      </label>
      <button type="submit">Compare</button>
      <button type="button" (click)="compareListedTables()">Compare listed tables by ID</button>
      <span class="error" *ngIf="error">{{error}}</span>
    </form>

    <section *ngIf="loading">Loading...</section>

    <section *ngIf="listResults">
      <h2>Listed tables result</h2>
      <div *ngIf="!listResults?.length">No entries</div>
      <table *ngIf="listResults?.length">
        <thead>
          <tr>
            <th>Table</th>
            <th>Key</th>
            <th>Added</th>
            <th>Removed</th>
            <th>Changed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let td of listResults">
            <td>
              <a href="#" title="Open detailed diff"
                 (click)="openTableDiff($event, td)">{{td.table}}</a>
            </td>
            <td>{{td.keyColumn || td.result?.keyColumn || '-'}}</td>
            <td>{{td.result ? td.result.added.length || 0 : '-'}}</td>
            <td>{{td.result ? td.result.removed.length || 0 : '-'}}</td>
            <td>{{td.result ? countChanged(td.result) : '-'}}</td>
            <td>
              <span *ngIf="td.error" class="error">{{td.error}}</span>
              <span *ngIf="!td.error">OK</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section *ngIf="result">
      <h2>Summary</h2>
      <p>
        Schema: {{result.schema || '(default)'}}, Table: {{result.table}}, Key: {{result.keyColumn}}
      </p>

      <div class="cards">
        <div class="card">
          <h3>Added (in DB2 only)</h3>
          <div *ngIf="!result.added?.length">None</div>
          <table *ngIf="result.added?.length">
            <thead>
              <tr>
                <th *ngFor="let col of columns(result.added)">{{col}}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of result.added">
                <td *ngFor="let col of columns(result.added)">{{row[col]}}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3>Removed (in DB1 only)</h3>
          <div *ngIf="!result.removed?.length">None</div>
          <table *ngIf="result.removed?.length">
            <thead>
              <tr>
                <th *ngFor="let col of columns(result.removed)">{{col}}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of result.removed">
                <td *ngFor="let col of columns(result.removed)">{{row[col]}}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3>Changed (present in both)</h3>
          <div *ngIf="!result.changed?.length">None</div>
          <table *ngIf="result.changed?.length">
            <thead>
              <tr>
                <th>Key</th>
                <th>Column</th>
                <th>DB1</th>
                <th>DB2</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let change of result.changed">
                <tr *ngFor="let col of columnsForChange(change)">
                  <td>{{change.key}}</td>
                  <td>{{col}}</td>
                  <td [class.diff-changed]="isChanged(change, col)" [innerHTML]="cellHtml(change, col, 'left')"></td>
                  <td [class.diff-changed]="isChanged(change, col)" [innerHTML]="cellHtml(change, col, 'right')"></td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
  `,
  styles: [`
    .container { font-family: system-ui, sans-serif; padding: 16px; }
    form { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; margin-bottom: 16px; }
    label { display: flex; flex-direction: column; font-size: 12px; }
    input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; min-width: 200px; }
    button { padding: 8px 12px; }
    .error { color: #b00020; margin-left: 8px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; }
    th { background: #fafafa; }
    .diff-changed { background: #fff3cd; font-weight: 600; }
    .diff-del { background: #f8d7da; text-decoration: line-through; }
    .diff-add { background: #d4edda; }
  `]
})
export class AppComponent {
  schema = '';
  table = '';
  key = '';
  loading = false;
  error: string | null = null;
  result: DiffResult | null = null;
  listResults: TableDiff[] | null = null;

  backendBaseUrl = (window as any)["BACKEND_BASE_URL"] || 'http://localhost:8080';

  async openTableDiff(ev: Event, td: TableDiff) {
    ev.preventDefault();
    this.error = null;
    // Keep listResults so user can navigate between tables
    this.result = null;
    const table = td.table;
    const key = td.keyColumn || td.result?.keyColumn || (this.key && this.key.trim() ? this.key : '');
    if (!key) {
      this.error = `No key available to open diff for table ${table}.`;
      return;
    }
    // reflect selection in the form inputs for transparency
    this.table = table;
    this.key = key;
    this.loading = true;
    try {
      const params = new URLSearchParams();
      if (this.schema) params.set('schema', this.schema);
      params.set('table', table);
      params.set('key', key);
      const resp = await fetch(`${this.backendBaseUrl}/api/diff?${params.toString()}`);
      if (!resp.ok) throw new Error(await resp.text());
      this.result = await resp.json();
    } catch (e: any) {
      this.error = e?.message || 'Request failed';
    } finally {
      this.loading = false;
    }
  }

  async onSubmit(ev: Event) {
    ev.preventDefault();
    this.error = null;
    this.result = null;
    this.listResults = null;
    if (!this.table || !this.key) {
      this.error = 'Please enter required fields: table and key.';
      return;
    }
    this.loading = true;
    try {
      const params = new URLSearchParams();
      if (this.schema) params.set('schema', this.schema);
      params.set('table', this.table);
      params.set('key', this.key);
      const resp = await fetch(`${this.backendBaseUrl}/api/diff?${params.toString()}`);
      if (!resp.ok) throw new Error(await resp.text());
      this.result = await resp.json();
    } catch (e: any) {
      this.error = e?.message || 'Request failed';
    } finally {
      this.loading = false;
    }
  }

  async compareListedTables() {
    this.error = null;
    this.result = null;
    this.listResults = null;
    this.loading = true;
    try {
      const params = new URLSearchParams();
      if (this.schema) params.set('schema', this.schema);
      // Compare all listed tables by ID (default) unless user explicitly provides a key
      params.set('key', this.key && this.key.trim() ? this.key : 'ID');
      // Force no PK detection so we always compare by the provided key (ID by default)
      params.set('detectPk', 'false');
      const resp = await fetch(`${this.backendBaseUrl}/api/diff/tables?${params.toString()}`);
      if (!resp.ok) throw new Error(await resp.text());
      this.listResults = await resp.json();
    } catch (e: any) {
      this.error = e?.message || 'Request failed';
    } finally {
      this.loading = false;
    }
  }

  columns(rows: any[]): string[] {
    if (!rows || !rows.length) return [];
    const set = new Set<string>();
    rows.forEach(r => Object.keys(r).forEach(k => set.add(k)));
    return Array.from(set);
  }

  // For a single change, list ALL columns present in either side so the user can see full context.
  // Differences will be highlighted cell-by-cell; unchanged cells will be shown normally.
  columnsForChange(change: { leftRow: any; rightRow: any; changedColumns?: string[] }): string[] {
    const set = new Set<string>();
    if (change?.leftRow) Object.keys(change.leftRow).forEach(k => set.add(k));
    if (change?.rightRow) Object.keys(change.rightRow).forEach(k => set.add(k));
    // If neither side provided keys (edge case), fall back to changedColumns list if available
    if (set.size === 0 && change?.changedColumns?.length) {
      change.changedColumns.forEach(k => set.add(k));
    }
    return Array.from(set);
  }

  // Safe value getter to show null/undefined clearly
  value(row: any, col: string): any {
    const v = row ? row[col] : undefined;
    return v === undefined ? '(null)' : v;
  }

  // Raw value without formatting
  rawValue(row: any, col: string): any {
    return row ? row[col] : undefined;
  }

  // Whether a given column changed (use provided changedColumns when available)
  isChanged(change: { changedColumns?: string[]; leftRow: any; rightRow: any }, col: string): boolean {
    if (change?.changedColumns?.length) return change.changedColumns.includes(col);
    const l = change.leftRow ? change.leftRow[col] : undefined;
    const r = change.rightRow ? change.rightRow[col] : undefined;
    return l !== r;
  }

  // Count total number of cell-level changes rather than row-level entries
  countChanged(r: DiffResult): number {
    if (!r?.changed?.length) return 0;
    return r.changed.reduce((sum, ch: any) => {
      if (Array.isArray(ch.changedColumns)) return sum + ch.changedColumns.length;
      // fallback: compare keys across left/right
      const cols = this.columnsForChange(ch);
      return sum + cols.filter(c => this.isChanged(ch, c)).length;
    }, 0);
  }

  // Render cell HTML with inline diff for changed string values
  cellHtml(change: { leftRow: any; rightRow: any }, col: string, side: 'left' | 'right'): string {
    const l = this.rawValue(change.leftRow, col);
    const r = this.rawValue(change.rightRow, col);
    if (l === r) {
      return this.escapeHtml(this.value(side === 'left' ? change.leftRow : change.rightRow, col));
    }
    return this.inlineDiff(l, r, side);
  }

  // Simple inline diff using common prefix/suffix for strings; falls back to full highlight for non-strings
  inlineDiff(left: any, right: any, side: 'left' | 'right'): string {
    const lNull = left === undefined || left === null;
    const rNull = right === undefined || right === null;

    // If one side missing, highlight entire existing value
    if (lNull || rNull) {
      const v = side === 'left' ? left : right;
      const text = v === undefined || v === null ? '(null)' : String(v);
      const esc = this.escapeHtml(text);
      const cls = side === 'left' ? 'diff-del' : 'diff-add';
      return `<span class="${cls}">${esc}</span>`;
    }

    const lStr = String(left);
    const rStr = String(right);

    // If not both strings (e.g., objects), just show whole value highlighted
    if (typeof left !== 'string' && typeof right !== 'string') {
      const v = side === 'left' ? lStr : rStr;
      const cls = side === 'left' ? 'diff-del' : 'diff-add';
      return `<span class="${cls}">${this.escapeHtml(v)}</span>`;
    }

    // Find common prefix
    let start = 0;
    const minLen = Math.min(lStr.length, rStr.length);
    while (start < minLen && lStr[start] === rStr[start]) start++;

    // Find common suffix without overlapping prefix
    let endL = lStr.length - 1;
    let endR = rStr.length - 1;
    while (endL >= start && endR >= start && lStr[endL] === rStr[endR]) { endL--; endR--; }

    const prefix = lStr.substring(0, start);
    const lMid = lStr.substring(start, endL + 1);
    const rMid = rStr.substring(start, endR + 1);
    const suffix = lStr.substring(endL + 1); // same as rStr.substring(endR+1)

    if (side === 'left') {
      return this.escapeHtml(prefix) + (lMid ? `<span class="diff-del">${this.escapeHtml(lMid)}</span>` : '') + this.escapeHtml(suffix);
    } else {
      return this.escapeHtml(prefix) + (rMid ? `<span class="diff-add">${this.escapeHtml(rMid)}</span>` : '') + this.escapeHtml(suffix);
    }
  }

  // Escape HTML special chars to prevent injection when using innerHTML
  escapeHtml(input: any): string {
    const s = input == null ? '' : String(input);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
