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
      <span class="error" *ngIf="error">{{error}}</span>
    </form>

    <section *ngIf="loading">Loading...</section>

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
                <tr *ngFor="let col of change.changedColumns">
                  <td>{{change.key}}</td>
                  <td>{{col}}</td>
                  <td>{{change.leftRow[col]}}</td>
                  <td>{{change.rightRow[col]}}</td>
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
  `]
})
export class AppComponent {
  schema = '';
  table = '';
  key = '';
  loading = false;
  error: string | null = null;
  result: DiffResult | null = null;

  backendBaseUrl = (window as any)["BACKEND_BASE_URL"] || 'http://localhost:8080';

  async onSubmit(ev: Event) {
    ev.preventDefault();
    this.error = null;
    this.result = null;
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

  columns(rows: any[]): string[] {
    if (!rows || !rows.length) return [];
    const set = new Set<string>();
    rows.forEach(r => Object.keys(r).forEach(k => set.add(k)));
    return Array.from(set);
  }
}
