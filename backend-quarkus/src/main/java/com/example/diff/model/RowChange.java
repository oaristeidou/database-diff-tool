package com.example.diff.model;

import java.util.List;
import java.util.Map;

public class RowChange {
    public String key;
    public Map<String, Object> leftRow; // DB1
    public Map<String, Object> rightRow; // DB2
    public List<String> changedColumns;

    public RowChange() {}

    public RowChange(String key, Map<String, Object> leftRow, Map<String, Object> rightRow, List<String> changedColumns) {
        this.key = key;
        this.leftRow = leftRow;
        this.rightRow = rightRow;
        this.changedColumns = changedColumns;
    }
}
