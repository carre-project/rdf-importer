var express = require('express');
var app = express();
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');
var spawn = require('child_process').spawn;
var StringDecoder = require('string_decoder').StringDecoder;
var auth = require('basic-auth');
var currentFilename = "";
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('sqlite/data.db');
var nodemailer = require('nodemailer');
var sgTransport = require('nodemailer-sendgrid-transport');

var baseUrl = "http://importer.carre-project.eu/";
var basic_auth_user = process.env.AUTH_USER || "admin";
var basic_auth_pass = process.env.AUTH_PASS || "d3m0";
var PORT = process.env.PORT || 9999;

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
app.use(express.static(path.join(__dirname, 'public')));
/*==============*/

var STATUS_IS_RUNNING = false;
var CONSTANTS = {
  pending: "pending",
  processing: "processing",
  error: "error",
  success: "success",
  
  JOBS_TABLE: "JOB_QUEUE"
};

// Sqlite Schema 
// id,file,deployment,graph,date,ip,status
db.run("CREATE TABLE if not exists "+CONSTANTS.JOBS_TABLE+" (id INTEGER PRIMARY KEY AUTOINCREMENT,file TEXT,deployment TEXT,graph TEXT,date TEXT,ip TEXT,status TEXT)");
// db.run("DROP TABLE "+CONSTANTS.JOBS_TABLE);



/*=== Routes ===*/
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});
app.get('/history', function(req, res) {
  db.all("SELECT * FROM "+CONSTANTS.JOBS_TABLE, function(err, rows) {
    if (err) res.status(500).json(err);
    else res.status(200).json(rows);
    return;
  });
});
app.get('/delete/:id', function(req, res) {
  db.run("DELETE FROM "+CONSTANTS.JOBS_TABLE+" WHERE id=" + req.params.id, function(err, result) {
    if (err) res.status(500).json(err);
    else res.status(200).json(result);
    return;
  });
});
app.post('/upload', uploadFile);
app.get('/import', addJob);
app.get('/retry/:id', retryJob);

var server = app.listen(PORT, function() {
  console.log('Server listening on port ' + PORT);
});


/* =========== Main-logic functions =============== */

function processAllJobs() {
  if (STATUS_IS_RUNNING) return;
  STATUS_IS_RUNNING = true;
  getJobs(function(err,jobs) {
    if(err) {console.log(err); return false;}
    if (jobs.length > 0) {
      updateJob(jobs[0].id, CONSTANTS.processing, function() {
        processJob(jobs[0], function(status, result,job) {
          updateJob(job.id, status, function() {
            STATUS_IS_RUNNING = false;
            sendEmail(status,result,job);
            processAllJobs();
          });
        });
      });
    }
  });
}

function getJobs(cb) {
  db.all("SELECT * FROM "+CONSTANTS.JOBS_TABLE+" WHERE status=?",[CONSTANTS.pending], function(err, result) {
    if (err) cb(err,[]);
    else {
      var jobs = result.sort(function(a, b) {
        return (new Date(b).getTime()) - (new Date(a).getTime());
      });
      cb(null,jobs);
    }
  });
}

function addJob(req, res) {
  // id,file,deployment,graph,date,ip,status
  db.run("INSERT INTO "+CONSTANTS.JOBS_TABLE+" VALUES (NULL, ?, ?, ?, ?, ?, ?)", [
    req.query.file,
    req.query.deployment,
    req.query.graph,
    new Date().toString(),
    getIp(req),
    CONSTANTS.pending
  ],function(err, result) {
    if(err) {
      res.status(500).json({error:err});
    } else {
      res.status(200).json({status:CONSTANTS.success,message:"ok"});
      processAllJobs();
    }
  });
}

function retryJob(req, res) {
  // id,file,deployment,graph,date,ip,status
  updateJob(req.params.id,CONSTANTS.pending,function(err, result) {
    if(err) {
      res.status(500).json({error:err});
    } else {
      res.status(200).json({status:CONSTANTS.success,message:"ok"});
      processAllJobs();
    }
  });
}

function updateJob(id, status, cb) {
  db.run("UPDATE "+CONSTANTS.JOBS_TABLE+" SET status=? WHERE id=?", [status, id], cb);
}

function processJob(job, cb) {
 
  var env = Object.create(process.env);
  env.file = job.file;
  env.g = job.graph || "dssdata";
  env.d = job.deployment || "duth";

  env.DBA_USER = env.DBA_USER || env.AUTH_USER;
  env.DBA_PASS = env.DBA_PASS || env.AUTH_PASS;
  
  env.DUTH_DBA_USER = env.DUTH_DBA_USER || env.DBA_USER;
  env.DUTH_DBA_PASS = env.DUTH_DBA_PASS || env.DBA_PASS;
  
  env.VULSK_DBA_USER = env.VULSK_DBA_USER || env.DBA_USER;
  env.VULSK_DBA_PASS = env.VULSK_DBA_PASS || env.DBA_PASS;
  var command = spawn(__dirname + "/import.sh", {
    env: env
  });
  var output = [];
  command.stdout.on('data', function(chunk) {
    output.push(chunk);
  });
  command.on('close', function(code) {
    var decoder = new StringDecoder('utf8'); //'utf8'
    if (code === 0) {
      var response = decoder.write(Buffer.concat(output)).trim();
      var status = (response.indexOf("Error") >= 0) ? CONSTANTS.error : CONSTANTS.success;
      cb(status, {type:status,message: response},job);
    }
    else cb(CONSTANTS.error,{type:CONSTANTS.error,message: code},job);
  });
}


function uploadFile (req, res) {
  // Based on formidable npm package
  var form = new formidable.IncomingForm();
  form.multiples = false;
  form.uploadDir = path.join(__dirname, 'public/uploads/');
  
  // rename it to it's orignal name
  // TODO : if the file exists add an auto-increment integer like windows :D
  form.on('file', function(field, file) {
    currentFilename = file.name;
    fs.rename(file.path, path.join(form.uploadDir, file.name));
  });
  
  form.on('error', function(err) {
    console.log('An error has occured: \n' + err);
  });
  
  form.on('end', function(file) {
    res.end('success:' + currentFilename);
  });
  
  // parse the incoming request containing the form data
  form.parse(req);
}


function sendEmail(status,result, job) {
  var sendgrid = nodemailer.createTransport(sgTransport({
    auth: {
      api_key: process.env.SENDGRID_API_KEY
    }
  }));
  
  // update status
  job.status = status;
  
  // send mail
  sendgrid.sendMail({
    from: 'importer@carre-project.eu',
    to: process.env.EMAIL_TO ? process.env.EMAIL_TO.split(";") : 'portokallidis@gmail.com',
    subject: 'CARRE RDF-importer: '+job.deployment+' : '+job.graph+' : ' + job.status,
    html:`
        <h2><a href="${baseUrl}" target="_blank" style="text-decoration: none;">CARRE RDF importer</a></h2>
        <h3>Job #${job.id} in ${job.deployment} vm for /${job.graph} resulted in ${job.status} on ${job.date.split(' (')[0]}</h3>
        <p><b>Message:</b> ${result.message}</p>
        <p><b>Logs:</b> <a href="${baseUrl}uploads/${job.file}_${job.deployment}_${job.graph}_log.txt">${job.file}_${job.deployment}_${job.graph}_log.txt</a></p>
        <p><b>Excel:</b> <a href="${baseUrl}uploads/${job.file}.xlsx">${job.file}.xlsx</a></p>
        <br>
        <h3>Job Details:</h3>
        <pre>${JSON.stringify(job, null, 2)}</pre>
        `
  }, function(error, response) {
    if (error) {
      console.log(error);
    }
    else {
      console.log('Message sent');
    }
  });

}

function getIp(req){
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  return ip.slice(ip.lastIndexOf(":")+1);
}