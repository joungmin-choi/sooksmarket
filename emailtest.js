var express = require('express');
var nodemailer = require("nodemailer");
var smtpTransport = require("nodemailer-smtp-transport");
var app = express();

var smtpTransport = nodemailer.createTransport(smtpTransport({
  host : "smtp.gmail.com",
  secureConnection : false,
  port : 587,
  auth : {
    user : "miniymay101",
    pass : "sb028390"
  }
}));

app.get('/send', function(request, response){
  var authenticationCode = Math.floor(Math.random()*1000000) + 100000;
  console.log(authenticationCode);
  var mailOptions = {
    from : "숙스마켓 <miniymay101@gmail.com>",
    to : "miniymay@naver.com",
    subject : "숙스마켓 인증",
    text : "인증번호 :" + authenticationCode
  };

  smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
      console.log(error);

    }else{
      console.log("Message sent : " + response.message);

    }
  });
});

app.listen(3000, function(){
  console.log("start");
});
