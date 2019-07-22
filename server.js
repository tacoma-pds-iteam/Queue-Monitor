//Server-side code for the queue monitor application

if(process.argv[2] == null) {
  console.log('Config file not included. Exiting...');
  return;
}

const icons = {
  'Reception': '<i class="fas fa-user reception-icon" aria-hidden="true" title="Reception"></i>',
  'Real Property Review': '<i class="fas fa-home rp" aria-hidden="true" title="Real Property"></i>',
  'Building Residential Review': '<i class="fas fa-warehouse br" aria-hidden="true" title="Residential Building"></i>',
  'Building Commercial Review': '<i class="fas fa-building bc" aria-hidden="true" title="Commercial Building"></i>',
  'Site Development Review': '<i class="fas fa-truck sd" aria-hidden="true" title="Site Development"></i>',
  'Land Use Review': '<i class="fas fa-map lu" aria-hidden="true" title="Land Use"></i>',
  'Fire Protection Review': '<i class="fas fa-fire fp" aria-hidden="true" title="Fire"></i>',
  'Traffic Review': '<i class="fas fa-car tr" aria-hidden="true" title="Traffic"></i>',
  'Historic Review': '<i class="fas fa-history hr" aria-hidden="true" title="Historic"></i>',
  'Permit Specialist': '<i class="fas fa-id-card ps" aria-hidden="true" title="Permit Specialist"></i>',
  'Application Services Review': '<i class="fas fa-id-card-alt as" title="Application Services"></i>',
  'Inspections': '<i class="fas fa-eye inspections-icon" aria-hidden="true" title="Inspection"></i>',
  'Unknown': '<i class="fas fa-question-circle unknown-icon" aria-hidden="true" title="Unknown"></i>',
  'wait': '<i class="far fa-clock waiting-icon" aria-hidden="true" title="Waiting For"></i>',
  'with': '<i class="far fa-handshake with-icon" aria-hidden="true" title="Currently With"></i>',
  'Time After WF Closed': '<i class="far fa-question-circle unknown-icon" aria-hidden="true" title="Unknown"></i>'
};

/* Function searches for value from configs global based on given key, returns default if not found */
getParameter = (key, def) =>{
  if(typeof configs[key] != "undefined") return configs[key];
  return def;
}

/* Function gets all images from DB and sends to client */
sendImages = () => {
  con3.query('SELECT * FROM images WHERE status = "A" ORDER BY image_order', (err,rows) => {
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
      //console.log(result);
        currentData = result.result;
        //console.log(currentData)
        generateHTML(currentData);
    } else if(resp.statusCode == 401){ // invalid token
      token_refresh();
    } else {
      console.log(PORT3 + ':ERROR: Failed to refresh Accela Data:', result);
    }

  });
}
/* Function creates HTML and emits to clients */
generateHTML = data => {
  let customers = [],
      waiters = [],
      withers = [],
      addedDepartments = [],
      availableDepartments = getParameter('accela-wf-tasks'),
      customersByDepartment = Array(availableDepartments.length),
      withList = [],
      withListHtml = '',
      waitList = [],
      waitListHtml = '',
      result = "",
      nextTemp = `<li class="nextperson">
      <span class="name"></span>
      <span class="nextdept"></span>
      </li>`,
      currentTemp = `<li class="person">           
            <span class="name"><i class="fa fa-user"></i></span>
          </li>`,
      currentObj = {};
  for(let i in data){
    let sn = data[i].shortNotes;
    let name = data[i].contacts[0].firstName;
    if(sn != 'departed' && sn != 'reception'){
      sn = sn.split('|');
      if(sn.length > 1){
        let cWait = sn[1] != '' ? sn[1].split(',') : [];
        let cWith = sn[2] != '' ? sn[2].split(',') : [];
        let tempIcons = '';
        if(cWait.length > 0){
          for(let i=0;i<cWait.length;i++){
            if(cWait[i] != "")
              tempIcons += icons[cWait[i]] +'\n';
            //console.log(cWait[i]);
          }
          waitListHtml += `<li class="nextperson"><span class="name"> ${name}</span><span class="nextdept">${tempIcons}</span></li>`
        }
        // TODO: Finish generating the current with html per dept
        if(cWith.length > 0){     
          for(let i=0;i<cWith.length;i++){
            let initials = getWfInitials(cWith[i].toString()).toLowerCase();
            if(typeof currentObj[initials] == 'undefined')  //create new dept entry
              currentObj[initials] = `<li class="person"><span class="name"><i class="fa fa-user"></i> ${name}</span></li>`;
            else //add to existing dept
              currentObj[initials] += `<li class="person"><span class="name"><i class="fa fa-user"></i> ${name}</span></li>`;
          }     
          
          
        }
      }
    }
  }

  io3.sockets.emit('update-next', { html: waitListHtml});
  io3.sockets.emit('update-current', currentObj);
}

getWfInitials = (task) => {
  let t = "";
  task = task.split(" ");
  task.forEach((v,k)=>{
    t += v[0];
  });
  return t.slice(0,2);
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
let _t = new Date().getHours();
if(_t > 7 && _t < 17) { // between 7am and 5pm
  token_refresh(); // get new token
}

var refreshInterval = setInterval(function(){
  let _t = new Date().getHours();
  if(_t > 7 && _t < 17) {
    refresh(_TOKEN);
  }
}, 60000);

/* Socket connection event - Sends data to client on connection */
io3.on('connection', function(socket) {
    currentUsers3++;
    console.log(PORT3 + `:${currentUsers3} user(s) connected to port ${PORT3}! (ip: ${socket.request.connection.remoteAddress})`);
    socket.emit('send-images', imageList); //send client message that file was sent so it can process

    /* Client disconnect event */
    socket.on('disconnect', function(d) {
        console.log("user disconnected! Bye Bye!");
        currentUsers3--;
    });
});