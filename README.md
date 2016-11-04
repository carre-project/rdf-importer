## CARRE RDF Importer

#### Overview
RDF Importer was developed to address some of the issues we were having in batch update and data migration of the RDF graphs. 

It’s initial concept was a simple cli-based tool that is responsible for converting excel-formatted data into RDF datastores. 

This component is integrated with a CSV schema that is based on CARRE ontologies and it’s initial design was to parse tabular data into triples for the purpose of later importing them into RDF databases. 

After an extensive internal usage within the DUTH team we decided to make it available within CARRE for all of our partners. 

More specific it consists of :
- CLI-tool, which is responsible for importing an excel file to specific rdf graph in a specific rdf database
- Web GUI, which is available at https://importer.carre-project.eu ,using CARRE credentials
- API server, which implements a custom pipeline (queue) for concurrently handling multiple jobs. It is also responsible for sending email reports of each job upon completion.


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