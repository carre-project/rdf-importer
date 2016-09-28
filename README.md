## CARRE RDF Importer
This tool is responsible for inserting excel sheets into RDF repositories through sparql endpoints

#### Development 
- install nodejs 
- npm install
- node app.js


#### Deployment 
As docker container to a DOKKU-HEROKU infrastructure

- create app

```
dokku apps:create carre-rdfimporter
dokku config:set carre-rdfimporter AUTH_USER=demo AUTH_PASS=demo
```
- creating storage for the app 'carre-rdfimporter'

```
mkdir -p  ~/rdfimporter/uploads
mkdir -p  ~/rdfimporter/sqlite
```
- mount directories

```
dokku storage:mount carre-rdfimporter ~/rdfimporter/uploads:/app/public/uploads
dokku storage:mount carre-rdfimporter ~/rdfimporter/sqlite:/app/sqlite
```
- push from your local machine
```
git remote add dokku dokku@dokku.me:carre-rdfimporter
git push dokku master
```