package com.example.diff.model;

import java.util.List;
import java.util.Map;

public class DiffResult {
    public String schema;
    public String table;
    public String keyColumn;

    public List<Map<String, Object>> added;   // in DB2 but not DB1
    public List<Map<String, Object>> removed; // in DB1 but not DB2
    public List<RowChange> changed;           // present in both with diffs

    public DiffResult() {}

    public DiffResult(String schema, String table, String keyColumn,
                      List<Map<String, Object>> added,
                      List<Map<String, Object>> removed,
                      List<RowChange> changed) {
        this.schema = schema;
        this.table = table;
        this.keyColumn = keyColumn;
        this.added = added;
        this.removed = removed;
        this.changed = changed;
    }
}
