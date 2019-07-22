class Main {
  constructor (socket) {
    // clears current html
    this.clearHTML();
    this.startClock();
    /* socket events */
    this.initSocket(socket);
    this.scrollDownThenUp(this); // init scroll of current department list
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

    socket.on('update-current', (d) => { // event handler to update the currently serving section with new html 
      // data should be in object format of { department: `html`}
      this.clearHTML('#current ul');
      this.setCurrentDepartments(d);
      this.updateTime();
    });

    socket.on('update-next', (d) => { // event handler to update the next up section with new html 
      // data should be in object format of { html: `html`}
      this.clearHTML('#nextup ul');
      this.setNextUp(d);
      this.updateTime();
    });
  }
  /* Function sets the html for the current section */
  setCurrentDepartments(data){
    // console.log("setting current", data);
    for(let dep in data){
      $('.' + dep + ' ul').html(data[dep]);
    }
  }
  /* Function sets the html for the next up section */
  setNextUp(data){
    // console.log("setting NEXT", data);
    $('#nextup ul').html(data["html"]);    
  }

  /* Function updates last updated time to know if data on screen is up to date */
  updateTime(){
    let now = new Date();
    let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ampm = h >= 12 ? 'PM' : 'AM';
    if(m < 10) m = '0' + m;
    if(s < 10) s = '0' + s;

    $('.update-time').html(`${h}:${m}:${s} ${ampm}`);
  }

  /* Clears current html on page */
  clearHTML (el) {
    $(el).html("");
  }
  /* sets user html from server data */
  setHTML(data) {
    $('#current article').html(data);
  }
  /* start up clock and reset it every second */
  startClock () {
    setInterval(function() {
      $('#clock').html(new Date().toLocaleTimeString());
    }, 1000);
  }
  /* Function scrolls the current section down, then resets */
  scrollDownThenUp(s){
    setTimeout(function(){
      // console.log('fired')
      let pps = 50, // pixels per second
      distance = Math.abs($('#current').scrollTop() - $('#current')[0].scrollHeight),
      speed = (distance / pps) * 1000; // make speed consistent no matter how long
      $('#current').animate({ scrollTop: $('#current')[0].scrollHeight   }, speed, "linear", function() {
      $(this).animate({ opacity: 0 }, 1000, "linear", function() {
        $(this).scrollTop(0);
        $(this).animate({ opacity: 1}, 1000, "linear", function (){ s.scrollDownThenUp(s) });
      });
    });
    }, 3000);    
  }
} // end class

/* init socket on client */
var socket3 = io({
    reconnection: false,
    reconnectionAttempts: 1,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
}); 

/* Start main controller */
var m = new Main(socket3);
