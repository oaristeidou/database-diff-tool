package com.example.diff.api;

import com.example.diff.model.DiffResult;
import com.example.diff.model.TableDiff;
import com.example.diff.service.JdbcDiffService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Path("/api/diff")
@Produces(MediaType.APPLICATION_JSON)
public class DiffResource {

    @Inject
    JdbcDiffService service;

    @GET
    public Response getDiff(@QueryParam("schema") String schema,
                            @QueryParam("table") String table,
                            @QueryParam("key") String keyColumn) {
        if (table == null || table.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Parameter 'table' is required").build();
        }
        if (keyColumn == null || keyColumn.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Parameter 'key' is required").build();
        }
        try {
            DiffResult result = service.diff(schema, table, keyColumn);
            return Response.ok(result).build();
        } catch (Exception e) {
            return Response.serverError().entity("Error computing diff: " + e.getMessage()).build();
        }
    }

    /**
     * Compare two DBs across the tables listed in resources/db/kontokorrent-tables.txt
     * Query params:
     *  - schema: optional schema name
     *  - key: optional default key column to use if PK detection is disabled or fails
     *  - detectPk: if true (default), try to detect PK automatically per table
     */
    @GET
    @Path("/tables")
    public Response diffListedTables(@QueryParam("schema") String schema,
                                     @QueryParam("key") String defaultKey,
                                     @QueryParam("detectPk") @DefaultValue("true") boolean detectPk) {
        try {
            List<String> tables = readTableList("db/kontokorrent-tables.txt");
            List<TableDiff> results = new ArrayList<>();
            for (String t : tables) {
                if (t.isBlank()) continue;
                try {
                    String keyToUse = null;
                    if (detectPk) {
                        keyToUse = service.detectPrimaryKey(schema, t).orElse(null);
                    }
                    if (keyToUse != null) {
                        DiffResult dr = service.diff(schema, t, keyToUse);
                        results.add(TableDiff.success(dr));
                    } else if (defaultKey != null && !defaultKey.isBlank()) {
                        DiffResult dr = service.diff(schema, t, defaultKey);
                        results.add(TableDiff.success(dr));
                    } else {
                        results.add(TableDiff.failure(t, null, "No key available (no PK detected and no default key provided)"));
                    }
                } catch (Exception ex) {
                    results.add(TableDiff.failure(t, null, ex.getMessage()));
                }
            }
            return Response.ok(results).build();
        } catch (Exception e) {
            return Response.serverError().entity("Failed to process table list: " + e.getMessage()).build();
        }
    }

    private List<String> readTableList(String resourcePath) throws Exception {
        List<String> result = new ArrayList<>();
        ClassLoader cl = Thread.currentThread().getContextClassLoader();
        try (InputStream is = cl.getResourceAsStream(resourcePath)) {
            if (is == null) throw new IllegalStateException("Resource not found: " + resourcePath);
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    String v = line.trim();
                    if (!v.isEmpty() && !v.startsWith("#")) {
                        result.add(v);
                    }
                }
            }
        }
        return result;
    }
}
