package com.example.diff.service;

import com.example.diff.model.DiffResult;
import com.example.diff.model.RowChange;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.DatabaseMetaData;
import java.util.*;

@ApplicationScoped
public class JdbcDiffService {
    private static final Logger LOG = Logger.getLogger(JdbcDiffService.class);

    @Inject
    @io.quarkus.agroal.DataSource("db1")
    DataSource ds1;

    @Inject
    @io.quarkus.agroal.DataSource("db2")
    DataSource ds2;

    public DiffResult diff(String schema, String table, String keyColumn) throws Exception {
        String qualified = qualify(schema, table);
        String sql = "SELECT * FROM " + qualified;

        List<Map<String, Object>> left = fetchAll(ds1, sql);
        List<Map<String, Object>> right = fetchAll(ds2, sql);

        Map<String, Map<String, Object>> leftByKey = indexByKey(left, keyColumn);
        Map<String, Map<String, Object>> rightByKey = indexByKey(right, keyColumn);

        Set<String> allKeys = new HashSet<>();
        allKeys.addAll(leftByKey.keySet());
        allKeys.addAll(rightByKey.keySet());

        List<Map<String, Object>> added = new ArrayList<>();
        List<Map<String, Object>> removed = new ArrayList<>();
        List<RowChange> changed = new ArrayList<>();

        for (String key : allKeys) {
            Map<String, Object> l = leftByKey.get(key);
            Map<String, Object> r = rightByKey.get(key);
            if (l == null && r != null) {
                added.add(r);
            } else if (l != null && r == null) {
                removed.add(l);
            } else if (l != null) {
                List<String> diffs = diffColumns(l, r);
                if (!diffs.isEmpty()) {
                    changed.add(new RowChange(key, l, r, diffs));
                }
            }
        }

        return new DiffResult(schema, table, keyColumn, added, removed, changed);
    }

    /**
     * Attempts to detect primary key column(s) for the given table using JDBC metadata.
     * - Tries several schema candidates (provided schema, current schema, username, and null)
     * - Supports composite PKs (returns comma-separated list in KEY_SEQ order)
     * - Tries both data sources (ds1 first, then ds2) to maximize chances
     */
    public Optional<String> detectPrimaryKey(String schema, String table) {
        String tableName = table != null ? table.toUpperCase(Locale.ROOT) : null;

        // Try DS1 first, then DS2
        Optional<String> fromDs1 = detectPkOnDataSource(ds1, schema, tableName);
        if (fromDs1.isPresent()) return fromDs1;
        Optional<String> fromDs2 = detectPkOnDataSource(ds2, schema, tableName);
        return fromDs2;
    }

    private Optional<String> detectPkOnDataSource(DataSource ds, String schema, String tableNameUpper) {
        try (Connection c = ds.getConnection()) {
            DatabaseMetaData md = c.getMetaData();

            // Build candidate schemas to try
            List<String> schemaCandidates = new ArrayList<>();
            String provided = normalizeSchema(schema);
            if (provided != null) schemaCandidates.add(provided);
            try {
                String currentSchema = c.getSchema();
                if (currentSchema != null && !currentSchema.isBlank()) {
                    schemaCandidates.add(currentSchema.toUpperCase(Locale.ROOT));
                }
            } catch (Throwable ignored) { /* some drivers don't support getSchema() */ }
            try {
                String user = md.getUserName();
                if (user != null && !user.isBlank()) {
                    schemaCandidates.add(user.toUpperCase(Locale.ROOT));
                }
            } catch (Throwable ignored) { }
            // Add null last to let the driver decide
            schemaCandidates.add(null);

            // Remove duplicates while preserving order
            LinkedHashSet<String> uniqueSchemas = new LinkedHashSet<>(schemaCandidates);

            for (String sch : uniqueSchemas) {
                List<ColSeq> cols = new ArrayList<>();
                try (ResultSet rs = md.getPrimaryKeys(null, sch, tableNameUpper)) {
                    while (rs.next()) {
                        String col = rs.getString("COLUMN_NAME");
                        short seq = 0;
                        try { seq = rs.getShort("KEY_SEQ"); } catch (Throwable ignored) { }
                        if (col != null && !col.isBlank()) {
                            cols.add(new ColSeq(col, seq));
                        }
                    }
                }
                if (!cols.isEmpty()) {
                    cols.sort(Comparator.comparingInt(a -> a.seq));
                    String joined = String.join(",",
                            cols.stream().map(cs -> cs.col).toList());
                    return Optional.of(joined);
                }
            }
        } catch (Exception e) {
            LOG.warn("PK detection failed on DS for " + qualify(schema, tableNameUpper) + ": " + e.getMessage());
        }
        return Optional.empty();
    }

    private static class ColSeq {
        final String col;
        final int seq;
        ColSeq(String col, int seq) { this.col = col; this.seq = seq; }
    }

    public DiffResult diffUsingDetectedKey(String schema, String table) throws Exception {
        String key = detectPrimaryKey(schema, table).orElseThrow(() ->
                new IllegalArgumentException("No primary key found for table " + qualify(schema, table)));
        return diff(schema, table, key);
    }

    private String qualify(String schema, String table) {
        if (schema == null || schema.isBlank()) return table;
        return schema + "." + table;
    }

    private String normalizeSchema(String schema) {
        if (schema == null || schema.isBlank()) return null;
        return schema.toUpperCase(Locale.ROOT);
    }

    private List<Map<String, Object>> fetchAll(DataSource ds, String sql) throws Exception {
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            ResultSetMetaData md = rs.getMetaData();
            int colCount = md.getColumnCount();
            List<Map<String, Object>> rows = new ArrayList<>();
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= colCount; i++) {
                    String col = md.getColumnLabel(i);
                    if (col == null || col.isBlank()) col = md.getColumnName(i);
                    Object val = rs.getObject(i);
                    row.put(col, normalize(val));
                }
                rows.add(row);
            }
            return rows;
        }
    }

    private Object normalize(Object value) {
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toInstant().toString();
        }
        if (value instanceof java.sql.Date d) {
            return d.toLocalDate().toString();
        }
        if (value instanceof java.sql.Time t) {
            return t.toLocalTime().toString();
        }
        if (value instanceof java.sql.Blob) {
            return "<BLOB>";
        }
        if (value instanceof java.sql.Clob) {
            return "<CLOB>";
        }
        return value;
    }

    private Map<String, Map<String, Object>> indexByKey(List<Map<String, Object>> rows, String keyColumn) {
        Map<String, Map<String, Object>> map = new HashMap<>();
        for (Map<String, Object> row : rows) {
            String k = buildKey(row, keyColumn);
            map.put(k, row);
        }
        return map;
    }

    /**
     * Builds a deterministic composite key string for a row based on the key specification:
     * - If keySpec is a single column name, uses that column's value.
     * - If keySpec is a comma-separated list, uses all listed columns in the given order.
     * - If keySpec is "*", uses all columns in the row (sorted by column name) as the composite key.
     */
    private String buildKey(Map<String, Object> row, String keySpec) {
        if (keySpec == null || keySpec.isBlank()) {
            // Fallback: serialize entire row to keep behavior predictable
            return buildKeyFromAllColumns(row);
        }

        String spec = keySpec.trim();
        if ("*".equals(spec)) {
            return buildKeyFromAllColumns(row);
        }

        // Composite or single explicit columns
        String[] cols = Arrays.stream(spec.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);

        if (cols.length == 0) {
            return buildKeyFromAllColumns(row);
        }

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cols.length; i++) {
            String c = cols[i];
            Object v = row.get(c);
            if (i > 0) sb.append("|");
            sb.append(c).append("=").append(valueToKeyPart(v));
        }
        return sb.toString();
    }

    private String buildKeyFromAllColumns(Map<String, Object> row) {
        List<String> cols = new ArrayList<>(row.keySet());
        Collections.sort(cols, String.CASE_INSENSITIVE_ORDER);
        StringBuilder sb = new StringBuilder("ALL:");
        boolean first = true;
        for (String c : cols) {
            if (!first) sb.append("|");
            first = false;
            sb.append(c).append("=").append(valueToKeyPart(row.get(c)));
        }
        return sb.toString();
    }

    private String valueToKeyPart(Object v) {
        if (v == null) return "<NULL>";
        String s = String.valueOf(v);
        // Basic escaping for separators
        return s.replace("|", "\\|").replace("=", "\\=");
    }

    private List<String> diffColumns(Map<String, Object> a, Map<String, Object> b) {
        Set<String> cols = new LinkedHashSet<>();
        cols.addAll(a.keySet());
        cols.addAll(b.keySet());
        List<String> changed = new ArrayList<>();
        for (String c : cols) {
            Object va = a.get(c);
            Object vb = b.get(c);
            if (!Objects.equals(va, vb)) {
                changed.add(c);
            }
        }
        return changed;
    }
}
