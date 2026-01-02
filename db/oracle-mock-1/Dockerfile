# Use a lightweight Oracle XE image
#FROM gvenzl/oracle-xe:21-slim
FROM docker.io/gvenzl/oracle-xe:21-slim

USER root

# Set default database password (override at runtime if needed)
# This user/password will be for SYS, SYSTEM, and PDBADMIN.
ENV ORACLE_PASSWORD=Oracle123

# Optionally set DB name and charset
ENV ORACLE_CHARACTERSET=AL32UTF8

# Install libaio (required)
# Use microdnf for Oracle Linux 8 (which this image is based on)
RUN microdnf install libaio wget unzip

# Download and install Oracle Instant Client
WORKDIR /opt/oracle
RUN wget https://download.oracle.com/otn_software/linux/instantclient/191000/instantclient-basic-linux.x64-19.10.0.0.0dbru.zip && \
    unzip instantclient-basic-linux.x64-19.10.0.0.0dbru.zip && \
    rm instantclient-basic-linux.x64-19.10.0.0.0dbru.zip

# Set environment variables so Python can find the library
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_19_10

USER oracle
# Copy init script to the PDB startup directory.
# The gvenzl image looks for scripts in /container-entrypoint-initdb.d/ for initialization
COPY --chown=oracle:dba init-db.sql /container-entrypoint-initdb.d/01-init-db.sql

# Expose Oracle listener and EM Express (if enabled)
EXPOSE 1521 5500

# Use the default entrypoint and CMD provided by the base image