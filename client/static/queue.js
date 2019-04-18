class Main {
  constructor (socket) {
    // clears current html
    this.clearHTML();
    this.startClock();
    /* socket events */
    this.initSocket(socket);    
  }
  /* initialize socket handlers */
  initSocket(socket){
    socket.on('connect', () => {
        console.log('Connected to Server!');
    });
    socket.on('disconnect', () => {
        console.log('Disconnected from Server!');
    });
    socket.on('send-images', (d) => {
      for(let i = 0; i < d.length - 1; i++) {
        $('.images ul').append("<li><img src=\"" + d[i].stored_image_name + '.' + d[i].image_type + "\" alt=\"\"></li>");
      }
      $('.images ul').cycle({
        fx: 'fade',
        timeout: 10000
      });
    });
    socket.on('send-text', (d) => {
      let space = "&nbsp&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"; //space needed for marquee text

      let time = d.length * 12 + 's';
      time = "marquee " + time + " linear infinite";
      let tmp;

      $('.marquee p').css('animation', time);

      for(let i = 0; i < d.length; i++) {
        tmp = d[i].message;
        tmp = tmp.replace(/\"/g, '')
        $('.marquee p').append(tmp + space);
      }
    });
    socket.on('send-people', (d) => {
      this.clearHTML();
      this.setHTML(d);
      this.updateTime();
    });
  }
  /* Function updates last updated time to know if data on screen is up to date */
  updateTime(){
    let now = new Date();
    let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ampm = h >= 12 ? 'PM' : 'AM';
    if(m < 10) m = '0' + m;
    if(s < 10) s = '0' + s;

    $('.update-time').html(`${h}:${m}:${s} ${ampm}`);
  }

  //clears current html on page
  clearHTML () {
    $('#contentArea').html("");
  }
  /* sets user html from server data */
  setHTML(data) {
    $('#contentArea').html(data);
  }
  /* start up clock and reset it every second */
  startClock () {
    setInterval(function() {
      $('#clock').html(new Date().toLocaleTimeString());
    }, 1000);
  }
}

/* init socket on client */
var socket3 = io({
    reconnection: false,
    reconnectionAttempts: 1,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
}); 

/* Start main controller */
var m = new Main(socket3);
