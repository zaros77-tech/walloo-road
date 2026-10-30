#!/bin/sh
# Generates the prime256v1 key pair Tesla requires. Keep private-key.pem secret (needed only for signed vehicle commands).
mkdir -p keys && openssl ecparam -name prime256v1 -genkey -noout -out keys/private-key.pem && openssl ec -in keys/private-key.pem -pubout -out keys/public-key.pem && echo "keys/public-key.pem created"
