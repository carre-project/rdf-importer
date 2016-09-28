#!/bin/bash
USER=dba
PASS=${DBA_PASS}
DEPLOYMENT=${d:-duth}
ENDPOINT=${url:-"https://devices.${DEPLOYMENT}.carre-project.eu/sparql-auth"}

FILENAME=${file}
GRAPH=${g:-dssdata} 

# echo " "
# echo "DEPLOYMENT: ${DEPLOYMENT}"
# echo "ENDPOINT: ${ENDPOINT}"
# echo "USER: ${USER}"
# echo "PASS: ${PASS}"
# echo " "
# echo "Using [ config.${GRAPH}.json ] for [ ${FILENAME}.xlsx ]"
# echo "========================================================"
sleep 1

sed 's,\("excel_file":"\)[^"]*\("\),\1'"public/uploads/$FILENAME"'.xlsx\2,g' config.$GRAPH.json >temp.json
sed 's,\("sparql_endpoint":"\)[^"]*\("\),\1'"$ENDPOINT"'\2,g' temp.json >temp2.json
cp temp2.json config.$GRAPH.json
sleep 1

# echo "Deleting graph..."
# echo "========================================================"
QUERY="delete%20%7B%20%3Fs%20%3Fp%20%3Fo%20%7D%20FROM%20%3Chttp%3A%2F%2Fcarre.kmi.open.ac.uk%2F${GRAPH}%3E%20WHERE%20%7B%3Fs%20%3Fp%20%3Fo%7D"
REQ="${ENDPOINT}?default-graph-uri=http%3A%2F%2Fcarre.kmi.open.ac.uk%2F${GRAPH}&query="$QUERY"&format=text%2Fturtle"
curl --digest --user $USER:$PASS --url $REQ > "public/uploads/${FILENAME}_log.txt" 2>&1
sleep 8
# echo "Ready for insertion"
# echo "========================================================"

java -jar ExceltoRDF.jar $USER $PASS "config.$GRAPH.json" >> "public/uploads/${FILENAME}_log.txt" 2>&1
# echo "Insertion Completed"
# echo "========================================================"
tail -n 4 "public/uploads/${FILENAME}_log.txt"

# https://devices.duth.carre-project.eu/sparql-auth
# delete { ?s ?p ?o } FROM <http://carre.kmi.open.ac.uk/dssdata> WHERE {?s ?p ?o}