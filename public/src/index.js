/**
 * WARNING: This file is kind of a mess, this is thrown together to 
 *  use the server socket API that was crafted. 
 *
 * @author Joshua Rasmussen
 *
 * Client script to run and play the game with a UI
 *
 * CLEAN UP NOTES: 
 * it looks like we have three types of modules that should be created
 * 1) UI or anything pertaining to the P5 library
 * 2) Event driven stuff pertaining to the DOM and user interaction
 * 3) State management for the game. 
 */

'use strict';

// UI
var b;

//State
var currentTurn;
var roomName;
var requestSent = true;
var winCount;
var players;
var voted;
var lastPlay;

// Socket
var socket;

window.onload = function(){
  var createBtn = document.getElementById('create');
  var joinBtn = document.getElementById('join');
  var watchBtn = document.getElementById('watch');
  var yesBtn = document.getElementById('yes-btn');
  var noBtn = document.getElementById('no-btn');
  var configDoneBtn = document.getElementById('config-done-btn');
  var roomNameText = document.getElementById('name');
  var screenNameText = document.getElementById('screen-name');
  var setupForm = document.getElementById('setup-form');
  var voteForm = document.getElementById('play-again');
  var gameConfig = document.getElementById('game-config');
  var toast = document.getElementById('toast');

  var myAlert = function(msg, danger){
    toast.innerHTML = msg;
    var severity;

    if(danger){
      severity = 'danger';
    }else{
      severity = 'success';
    }

    toast.classList.add(severity);
    toast.classList.add('show');
    setTimeout(function(){
      toast.classList.remove('show');
      toast.classList.remove(severity);
    }, 5000);
  };

  
  socket = io();
  socket.on('error_message', function(msg){
    myAlert(msg, true);
    requestSent = true;
    setupForm.classList.remove('hide');
  });

  socket.on('game_over', function(msg){
    myAlert("GAME OVER", false);
    setTimeout(function(){  
      voteForm.classList.add('hide');
      setupForm.classList.remove('hide');
      b = null;
      voted = false;

      requestSent = true;
      socket.emit('leave_room', roomName);
    }, 5000);
  });

  socket.on('winner', function(msg){
    b.state = msg.state;
    b.winSet = msg.winSet;
    currentTurn = null;

    myAlert(players[msg.winner] + " WINS!", false);
    voted = false;
    setTimeout(function(){
      yesBtn.classList.remove('selected');
      noBtn.classList.remove('selected');
     
      voteForm.classList.remove('hide');
      requestSent = true;
    }, 3000);
  });

  socket.on('tie', function(msg){
    b.state = msg.state;
    currentTurn = null;

    myAlert("TIE!", false);
    voted = false;
    setTimeout(function(){
      yesBtn.classList.remove('selected');
      noBtn.classList.remove('selected');
     
      voteForm.classList.remove('hide');
      requestSent = true;
    }, 3000);
  });

  socket.on('disconnect_message', function(msg){
    myAlert(msg, true);
    setupForm.classList.remove('hide');
    voteForm.classList.add('hide');
    requestSent = true;
    socket.emit('leave_room', roomName);
  });
  
  socket.on('update_game_state', function(msg){
    if(!voteForm.classList.contains('hide')){
      voteForm.classList.add('hide');
    }
 
    if(msg.newGame){
      b = new Board(msg.rows, msg.cols, 60);
    }

    lastPlay = msg.lastPlay; 
    players = msg.players;
    winCount = msg.winCount;
    b.state = msg.state;

    if(msg.started){
      currentTurn = msg.currentTurn;
    }else{
      currentTurn = null;
    }

    if(msg.player_id !== undefined){
      socket.player_id = msg.player_id;
    }

    requestSent = false;
  });

  yesBtn.onclick = function(){
    if(socket.player_id !== undefined && !voted){
      voted = true;
      this.classList.add('selected');
      socket.emit('vote', {
        roomName : roomName, 
        vote: 1
      }); 
    }
  };

  noBtn.onclick = function(){
    if(socket.player_id !== undefined && !voted){
      voted = true;
      this.classList.add('selected');
      socket.emit('vote', {
        roomName : roomName, 
        vote: 0
      }); 
    }
  };

  createBtn.onclick = function(){
    roomName = roomNameText.value; 
   
    gameConfig.classList.remove('hide');

    setupForm.classList.add('hide');
    requestSent = true;
  };

  configDoneBtn.onclick = function(){
    var rowInput = document.getElementById("rows");
    var colInput = document.getElementById("cols");
    var toWinInput = document.getElementById("to-win");

    socket.emit('create_game', {
      screenName : screenNameText.value,
      rows : parseInt(rowInput.value),
      cols : parseInt(colInput.value),
      toWin : parseInt(toWinInput.value),
      roomName : roomName
    });

    gameConfig.classList.add('hide');

    requestSent = false;
  }

  joinBtn.onclick = function(){
    roomName = roomNameText.value;
    socket.emit('join_game', {
      screenName : screenNameText.value,
      roomName : roomName
    });
    
    setupForm.classList.add('hide');
    requestSent = false;
  };

  watchBtn.onclick = function(){
    roomName = roomNameText.value;
    socket.emit('watch_game', {
      screenName : screenNameText.value,
      roomName : roomName
    });
    
    setupForm.classList.add('hide');
    requestSent = false;
  };
};

function setup(){
  createCanvas(window.innerWidth, window.innerHeight);
}

function draw(){
  background(50);

  if(b !== undefined && b !== null){
    b.show();
  }
}

function mousePressed(){
  if(!requestSent){
    b.placePiece(currentTurn);
  }
}

function Board(r, c, slot_size){
  this.rows = r;
  this.cols = c;
  this.winSet = [];

  this.radius = Math.min(width * 0.7 / this.cols, height * 0.7 / this.rows);

  this.height = this.radius * this.rows;
  this.width = this.radius * this.cols;

  this.placePiece = function(piece){
    var col;

    // Find where you clicked
    var normalX = mouseX - (width - this.width) / 2;
    col = Math.floor(normalX / this.radius);

    // If within range send to server
    if(col >= 0 && col < this.cols){
      if(this.state[col].length < this.rows){
        requestSent = true;
        socket.emit('make_move', { 
          piece: piece, 
          column : col,
          roomName : roomName 
        });
      }
    }
  }

  // Display function to display the state of the game
  this.show = function(){
    noStroke();
    textAlign(CENTER);
      
    fill(255);
    textSize(48);
    text(roomName, width / 2, 50);
      
    textSize(24);
    if(socket.player_id !== undefined){
      if(socket.player_id === 0){
        fill(66, 134, 244);
      }else if(socket.player_id === 1){
        fill(244, 66, 66);
      }
      textAlign(LEFT);
      text(players[socket.player_id] + "'s Board", 10, 75);
    
    }
    fill(255);
    textAlign(CENTER);

    if(currentTurn !== null){
      if(currentTurn === 0){
        fill(66, 134, 244);
      }else if(currentTurn === 1){
        fill(244, 66, 66);
      }
      text(players[currentTurn] + "'s Turn", width / 2 , 75);
    }else{
      text("Waiting on other player...", width / 2 , 75);
    }

    textSize(16);
    textAlign(LEFT);
    if(winCount){
      var keys = Object.keys(winCount);
      for(var i = 0; i < keys.length; i++){
        if(keys[i] == 0){
          fill(66, 134, 244);
        }else if(keys[i] == 1){
          fill(244, 66, 66);
        }
        text(players[keys[i]] + " : " + winCount[keys[i]], 10, i * 30 + 110);
      }
    }

    fill(255, 255, 102);
    translate((width - this.width) / 2, (height - this.height));
    rect(0, 0, this.width, this.height);

    translate(this.radius / 2, this.radius / 2);

    for(var i = 0; i < this.cols; i++){
      for(var j = 0; j < this.rows; j++){
        var c;
        if(this.state !== undefined && this.state[i] !== undefined){
          var ndx = j * this.cols + i;
          if(i === lastPlay && j === (this.state[i].length - 1)
              || (this.winSet.length > 0 && this.winSet.includes(ndx))){
            stroke(255);
            strokeWeight(10);
          }else{
            noStroke();
          }
          
          if(this.state[i][j] === 0){
            fill(66, 134, 244);
          }else if(this.state[i][j] === 1){
            fill(244, 66, 66);
          }else{  
            fill(50);
          }
        }else{
          fill(50);
        }

        ellipse(i * this.radius, (this.rows - j - 1) * this.radius, this.radius * 0.75, this.radius * 0.75);
      }
    }
  }
}
