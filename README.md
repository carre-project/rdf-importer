=== CARRE RDF Importer

==== Deployment as docker container to a DOKKU-HEROKU infrastructure

dokku apps:create carre-rdfimporter
dokku config:set carre-rdfimporter AUTH_USER=demo AUTH_PASS=demo

# creating storage for the app 'carre-rdfimporter'
mkdir -p  /var/lib/dokku/data/storage/carre-rdfimporter/public/uploads
mkdir -p  /var/lib/dokku/data/storage/carre-rdfimporter/sqlite
# ensure the proper user has access to this directory
chown -R dokku:dokku /var/lib/dokku/data/storage/carre-rdfimporter/public/uploads
chown -R dokku:dokku /var/lib/dokku/data/storage/carre-rdfimporter/sqlite
# mount directories
dokku storage:mount carre-rdfimporter /var/lib/dokku/data/storage/carre-rdfimporter/public/uploads:/app/public/uploads
dokku storage:mount carre-rdfimporter /var/lib/dokku/data/storage/carre-rdfimporter/sqlite:/app/sqlite

# make symbolic link to home directory
ln -s /var/lib/dokku/data/storage/carre-rdfimporter ~/carre-rdfimporter