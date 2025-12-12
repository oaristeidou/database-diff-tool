package com.example.diff.model;

/**
 * Wrapper for per-table diff execution, carrying either a result or an error.
 */
public class TableDiff {
    public String table;
    public String keyColumn; // resolved key column used (if any)
    public DiffResult result; // present when success
    public String error;      // present when failed or skipped

    public TableDiff() {}

    public static TableDiff success(DiffResult r) {
        TableDiff td = new TableDiff();
        td.table = r.table;
        td.keyColumn = r.keyColumn;
        td.result = r;
        return td;
    }

    public static TableDiff failure(String table, String keyColumn, String error) {
        TableDiff td = new TableDiff();
        td.table = table;
        td.keyColumn = keyColumn;
        td.error = error;
        return td;
    }
}
