#!/bin/bash
# Build the Docker image
docker build -t oracle-db-diff-2 .

# Run the container
docker run -d --name oracle-diff-container-2 -p 1521:1521 -p 5500:5500 oracle-db-diff-2