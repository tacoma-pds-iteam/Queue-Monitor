//Server-side code for the queue monitor application

if(process.argv[2] == null) {
  console.log('Config file not included. Exiting...');
  return;
}

/* Function searches for value from configs global based on given key, returns default if not found */
getParameter = (key, def) =>{
  if(typeof configs[key] != "undefined") return configs[key];
  return def;
}

/* Function gets all images from DB and sends to client */
sendImages = () => {
  con3.query('SELECT * FROM images ORDER BY image_order', (err,rows) => {
    if(err) return err;
    imageList = rows;
    fs.readdir(getParameter('image-path'), (err, files) => {
        if(err){
          console.log(err);
        }
        for(let f=0;f<files.length;f++){
          app3.get(`/${files[f]}`, (res) => {
              return res.sendFile(`${getParameter('image-path')}${files[f]}`); // send file to client
          });
        }
    });
  });
}

/* Function gets text from database and sets text list to be sent to clients */
sendText = () => {
    con3.query('SELECT * FROM text WHERE status = "A" ORDER BY text_order', (err,rows) => {
      if(err) return err;
      textList = rows;
    });
}

/* Function grabs data from accela and sends to client */
refresh = (token) => {
  let date = getDate();
  request({
    "url": getParameter('accela-api-url'),
    "method": 'POST',
    "headers": {
      'authorization': token
    },
    "json": true,
    "body": {
      "module": getParameter('accela-module'),
      "openedDateFrom": date,
      "openedDateTo": date,
      "type": {
        "value": getParameter('accela-record-type')
      }
    }
  }, (err,resp,result) =>{
    if(resp.statusCode == 200){
      console.log(result);
        currentData = result.result;
        console.log(currentData)
        generateHTML(currentData);
    } else if(resp.statusCode == 401){ // invalid token
      token_refresh();
    } else {
      console.log(PORT3 + ':ERROR: Failed to refresh Accela Data:', result);
    }

  });
}

generateHTML = data => {
  let customers = [],
      waiters = [],
      withers = [],
      addedDepartments = [],
      availableDepartments = getParameter('accela-wf-tasks'),
      customersByDepartment = Array(availableDepartments.length),
      withList = [],
      result = "";
  for(let i in data){
    let sn = data[i].shortNotes;
    if(sn != 'departed' && sn != 'reception'){
      sn = sn.split('|');
      if(sn.length > 1){
        let cWait = sn[1] != '' ? sn[1].split(',') : [];
        let cWith = sn[2] != '' ? sn[2].split(',') : [];
        if(cWait || cWith)
          customers.push({"firstName":data[i].contacts[0].firstName, "waiting":cWait, "with":cWith});
      }
    }
  }

  for(let i in customers){
    let cust = customers[i];
    let custHtml = `<li>${cust.firstName}</li>`;
    for(let i in cust.waiting){ // check tasks waiting for
      let initials = getWfInitials(cust.waiting[i].toString());
      let header = cust.waiting[i].toString().split(" Review")[0];

      let deptIndex = availableDepartments.indexOf(cust.waiting[i].toString());
      if(customersByDepartment[deptIndex] == null) {
        customersByDepartment[deptIndex] = [`<div id="${initials}"><h3>${header}</h3><ul>`];
      }
      customersByDepartment[deptIndex].push(custHtml);
    }

    if(cust.with.length > 0) withList.push(custHtml);
  }

  for(let i in customersByDepartment){
    customersByDepartment[i].push(`</ul></div>`);
    result += customersByDepartment[i].join("");
  }
  if(withList.length) result += `<div id="WS"><h3>With Specialists</h3><ul>${withList.join("")}</ul></div>`;

  io3.sockets.emit('send-people',result);
}
getWfInitials = (task) => {
  let t = "";
  task = task.split(" ");
  task.forEach((v,k)=>{
    t += v[0];
  });
  return t;
}
/* Function gets a new token from Accela */
token_refresh = () => {
  request({
    "url": "https://apis.accela.com/oauth2/token",
    "method": "POST",
    "headers": {
      "content-type": "application/x-www-form-urlencoded",
      "x-accela-appid": getParameter('appid')
    },
    "form": {
      "client_id": getParameter('appid'),
      "client_secret": getParameter('appsecret'),
      "grant_type": "password",
      "username": getParameter('accela-username'),
      "password": getParameter('accela-password'),
      "scope": getParameter('accela-scope'),
      "agency_name": getParameter('accela-agency'),
      "environment": getParameter('env')
    }
  }, (err,resp, result) => {
    let temp = JSON.parse(result);

    if(resp.statusCode == 200){
      console.log(PORT3 + ':token refreshed');
      _TOKEN = temp.access_token;
      refresh(_TOKEN);
    } else {
      console.log(PORT3 + ":Couldnt Refresh token!");
    }
  });
}

/* Function gets todays date in simple string form for Accela calls */
getDate = () => {
  let date = new Date();
  return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
}


/* Required Packages/Server Init */
const fs = require('fs');
const configs = JSON.parse(fs.readFileSync(process.argv[2])); //  grab config file; FORMAT: JSON
const request = require('request');
const mysql = require('mysql');
/* Variable Constants */
const PORT3 = parseInt(getParameter('port')); // open port
const ENV = getParameter('env');
const APPID = getParameter('appid');
const API_URL = getParameter('accela-api-url');
const _database = getParameter('db-name');//db name

/* MySQL Database connection startup */
if(!_database) {
  console.log('database parameter not found. Re-enter required parameters...')
  return;
}
const con3 = mysql.createConnection({ //create db connection
  host: getParameter('db-host', 'localhost'),
  user: getParameter('db-user', 'root'),
  password: getParameter('db-pass', 'password'),
  database: _database,
  multipleStatements: true
});
var server3 = require('diet');
var app3 = server3();
/* server listener on designated port */
app3.listen(getParameter('url'), function() {
    console.log(PORT3 + ':listening on *:%s', PORT3);
    console.log(PORT3 + ':directory: ' + __dirname);
});
var static = require('diet-static')({path: app3.path + '\\client\\static\\'});
app3.footer(static);

var io3 = require('socket.io').listen(app3.server);
var currentUsers3 = 0;
var _TOKEN = '';
var currentData;
var serverStartDate = new Date();
var imageList = [];
var textList = [];

/* Connect to MySQL Datebase */
con3.connect((err) => {
  if(err){
    console.log(PORT3 + ':Error connecting to queuemonitor Database. Error: ' + err);
    return;
  }
  console.log(PORT3 + ':Connection to queuemonitor database established');
});


/* Send client files */
app3.get('/', (res) => {
    res.sendFile(__dirname + '/client/index.html');
});

/* Start refresh and token actions */
sendImages(); // get images and rolling text
sendText();
let _t = new Date().getHours();
if(_t > 7 && _t < 19) { // between 7am and 5pm
  token_refresh(); // get new token
}

var refreshInterval = setInterval(function(){
  let _t = new Date().getHours();
  if(_t > 7 && _t < 19) {
    refresh(_TOKEN);
  }
}, 60000);

/* Socket connection event - Sends data to client on connection */
io3.on('connection', function(socket) {
    currentUsers3++;
    console.log(PORT3 + `:${currentUsers3} user(s) connected to port ${PORT3}! (ip: ${socket.request.connection.remoteAddress})`);
    socket.emit('send-images', imageList); //send client message that file was sent so it can process
    socket.emit('send-text', textList); //send client rolling text

    /* Client disconnect event */
    socket.on('disconnect', function(d) {
        console.log("user disconnected! Bye Bye!");
        currentUsers3--;
    });
});