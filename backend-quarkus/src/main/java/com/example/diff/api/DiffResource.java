package com.example.diff.api;

import com.example.diff.model.DiffResult;
import com.example.diff.service.JdbcDiffService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

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
}
