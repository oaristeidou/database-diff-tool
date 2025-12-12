#!/bin/bash
# Build the Docker image
docker build -t oracle-db-diff-1 .

# Run the container
docker run -d --name oracle-diff-container-1 -p 1521:1521 -p 5500:5500 oracle-db-diff-1