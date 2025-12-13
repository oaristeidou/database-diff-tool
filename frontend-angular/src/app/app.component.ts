import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, NgClass, NgTemplateOutlet } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

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
  imports: [
    FormsModule,
    NgIf,
    NgFor,
    MatToolbarModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCardModule, MatTableModule, MatProgressBarModule, MatIconModule, MatDividerModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  schema = '';
  table = '';
  key = '';
  loading = false;
  error: string | null = null;
  result: DiffResult | null = null;
  listResults: TableDiff[] | null = null;

  // Material table column definitions
  listDisplayedColumns = ['table','key','added','removed','changed','status'];
  changedDisplayedColumns = ['key','column','db1','db2'];

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
