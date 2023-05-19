#!/bin/bash 

echo "Finding exe and blockmap"
exe=$(find dist_electron/ -maxdepth 1 -name 'SL*.exe')
blockmap=$(find dist_electron/ -maxdepth 1 -name 'SL*.blockmap')
version_v=${SL_VERSION:-$1}
echo "EXE: $exe, BLOCKMAP: $blockmap, version_v: $version_v"
version=${version_v:1}

echo curl -H 'Authorization: Bearer UPLOAD_TOKEN' -F "app=$APP_NAME" -F "exe=@$exe" -F "blockmap=@$blockmap" -F "version=$version" $SERVER
curl -H "Authorization: Bearer $UPLOAD_TOKEN" -F "app=$APP_NAME" -F "exe=@$exe" -F "blockmap=@$blockmap" -F "version=$version" $SERVER