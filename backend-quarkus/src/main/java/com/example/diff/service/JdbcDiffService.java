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

    private String qualify(String schema, String table) {
        if (schema == null || schema.isBlank()) return table;
        return schema + "." + table;
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
            Object key = row.get(keyColumn);
            String k = key == null ? "<NULL>" : String.valueOf(key);
            map.put(k, row);
        }
        return map;
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
