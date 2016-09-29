var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
var spawn   = require('child_process').spawn;
var StringDecoder = require('string_decoder').StringDecoder;
var auth = require('basic-auth');
var currentFilename="";
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('sqlite/data.db');
var nodemailer = require('nodemailer');
var sgTransport = require('nodemailer-sendgrid-transport');

var basic_auth_user=process.env.AUTH_USER||"admin";
var basic_auth_pass=process.env.AUTH_PASS||"d3m0";

// Sqlite Schema 
// id,file,deployment,graph,date,ip
db.run("CREATE TABLE if not exists USER_UPLOADS (id INTEGER PRIMARY KEY AUTOINCREMENT,file TEXT,deployment TEXT,graph TEXT,date TEXT,ip TEXT,status TEXT)");
// db.run("DROP TABLE USER_UPLOADS");

var CONSTANTS={
  pending:"pending",
  processing:"processing",
  error:"error",
  finished:"finished"
};

/*==============*/
// MY BASIC AUTH IMPLEMENTATION
var BasicAuth = function(req, res, next) {
  var user = auth(req);
  if (!user || basic_auth_user !== user.name || basic_auth_pass !== user.pass) {
    res.set('WWW-Authenticate', 'Basic realm="myApps"');
    return res.status(401).send();
  }
  return next();
};
app.use(BasicAuth);
/*==============*/


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/history', function(req, res){
  db.all("SELECT * FROM USER_UPLOADS", function(err, rows){
    if (err) res.status(500).json(err);
    else res.status(200).json(rows);
    return;
  });
});

app.get('/delete/:id', function(req, res){
  db.run("DELETE FROM USER_UPLOADS WHERE id="+req.params.id, function(err, result){
    if (err) res.status(500).json(err);
    else res.status(200).json(result);
    return;
  });
});

app.post('/upload', function(req, res){
  
  // create an incoming form object
  var form = new formidable.IncomingForm();

  // specify that we want to allow the user to upload multiple files in a single request
  form.multiples = false;

  // store all uploads in the /uploads directory
  form.uploadDir = path.join(__dirname, 'public/uploads/');

  // every time a file has been uploaded successfully,
  // rename it to it's orignal name
  form.on('file', function(field, file) {
    currentFilename=file.name;
    fs.rename(file.path, path.join(form.uploadDir, file.name));
  });

  // log any errors that occur
  form.on('error', function(err) {
    console.log('An error has occured: \n' + err);
  });

  // once all the files have been uploaded, send a response to the client
  form.on('end', function(file) {
    res.end('success:'+currentFilename);
  });

  // parse the incoming request containing the form data
  form.parse(req);

});

app.get('/import', function(req, res) {
});

var server = app.listen(process.env.PORT, function(){
  console.log('Server listening on port '+process.env.PORT);
});


function addRequest(data,request){  
  // id,file,deployment,graph,date,ip,status
  db.run("INSERT INTO USER_UPLOADS VALUES (NULL, ?, ?, ?, ?, ?, ?)", [
    data.file,
    data.deployment,
    data.graph,
    new Date().toString(),
    (request.headers['x-forwarded-for'] || request.connection.remoteAddress),
    CONSTANTS.pending
  ]);
}

function updateRequest(id,status,cb) {
  db.run("UPDATE USER_UPLOADS SET status=? WHERE id=?", [status,id], function(err,result){ cb(err,result);});
}

function importData(data,cb){
  
  var env = Object.create( process.env );
  env.file = data.file;
  env.g = data.graph || "dssdata";
  env.d = data.deployment || "duth";
  
  env.DBA_PASS = env.DBA_PASS || env.AUTH_PASS;
  var command = spawn(__dirname + "/import.sh", { env: env });
  var output  = [];
  command.stdout.on('data', function(chunk) { output.push(chunk); }); 
  command.on('close', function(code) {
    var decoder = new StringDecoder('utf8'); //'utf8'
    if (code === 0) {
      var response = decoder.write(Buffer.concat(output)).trim();
      var response_type = (response.indexOf("Error")>=0 && !process.env.BETA)?"warning":"success";
      // data object
      var result = Object.assign({},data,{type:response_type,message:response});
      cb(result);
      
    } else {
      cb({error:code}); // when the script fails, generate a Server Error HTTP response
    }
  });
}

function sendEmail(data) {
    var sendgrid=nodemailer.createTransport(sgTransport({
        auth: {
            api_key: process.env.SENDGRID_API_KEY||'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'
        }
    }));
    
    // send mail
    sendgrid.sendMail({
        from: 'importer@carre-project.eu',
        to: process.env.EMAIL_TO?process.env.EMAIL_TO.split(";"):'portokallidis@gmail.com',
        subject: 'CARRE RDF-importer: '+data.title+' ',
        text: 'From user: '+user+'\n\n'+data
    }, function(error, response) {
       if (error) {
            console.log(error);
       } else {
            console.log('Message sent');
       }
    });
    
}
