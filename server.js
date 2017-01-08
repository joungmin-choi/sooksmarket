var fs = require('fs');
var ejs = require('ejs');
var mysql = require('mysql');
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var passport = require('passport');
var flash = require('connect-flash');
var nodemailer = require('nodemailer');
var smtpTransport = require("nodemailer-smtp-transport");

//DB 설정//
var client = mysql.createConnection({
  host : '203.153.144.75',
  port : 3306,
  user : 'sm14',
  password : 'sm14',
  database : 'sooksmarket'
});

//express 서버객체 생성//
var app = express();

//뷰 엔진 설정//
app.set('views', __dirname);
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname));

//서버 실행
app.listen(80, function(){
  console.log('server running at http://127.0.0.1:80');
});

//아이디 중복체크 함수
var idExistence = -1;

var checkUserId = function(id, callback){
  var column = ['login_id'];
  var tablename = 'Login';

  var exec = client.query('select login_id from Login where login_id='+mysql.escape(id), function(err, rows){
    console.log('실행대상 SQL :' + exec.sql);

    if(rows.length > 0){
      console.log('아이디 [%s]가 일치하는 사용자 찾음',id);
      idExistence = 1;
      callback(null, rows);
    }else{
      idExistence = 0;
      console.log("일치하는 사용자 찾지 못함.");
      callback(null, null);
    }
  });
};

app.get('/', function(request, response){
  console.log("index.ejs 요청됨");
  response.render('index.ejs');
});


app.get('/sm_signup', function(request, response){
  var context = {idExistence : idExistence};
  request.app.render('sm_signup.ejs', context, function(err,html){
    if(err){throw err;}
    response.end(html);
  });
});

app.get('/checkId', function(request, response){
  var id = request.query.id;

  readData(id, function(){
    var context = {userId : id, idExistence : idExistence};
    request.app.render('checkId.ejs', context, function(err,html){
      if(err){throw err;}
      response.end(html);
    });
  });
});

var readData = function(id, callback){
  checkUserId(id, function(err, rows){
    if(err){throw err;}
    callback();
  });
};

var smtpTransport = nodemailer.createTransport(smtpTransport({
  host : "smtp.gmail.com",
  secureConnection : false,
  port : 587,
  auth : {
    user : "miniymay101",
    pass : "sb028390"
  }
}));

var sendCode = function(authenticationCode, email, callback){
  var mailOptions = {
    from: '숙스마켓 <miniymay101@gmail.com>',
    to : email,
    subject: '숙스마켓 인증번호',
    text: '인증 번호 : '+authenticationCode
  };

  smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
      console.log(error);
    }else{
      console.log("Message sent : " + response.message);
    }
    smtpTransport.close();
    callback();
  });
};

app.get('/authenticateSookmyung', function(request, response){
  var email = request.query.email;
  var authenticationCode = Math.floor(Math.random()*1000000) + 100000;
  console.log(authenticationCode);
  sendCode(authenticationCode, email, function(){
    var context = {userCode : authenticationCode};
    request.app.render('authenticateSookmyung.ejs', context, function(err,html){
      if(err){throw err;}
      response.end(html);
    });
  });
});

app.post('/sm_signup', function(request, response){
  var body = request.body;
  client.query('INSERT INTO Login (login_name, login_id, login_password, login_email, login_phone) VALUES (?,?,?,?,?)', [body.name, body.id, body.pw, body.email+"@sm.ac.kr", body.phone], function(){
    response.redirect('/');
  });
});

app.get('/sm_addItems', function(request, response){
  fs.readFile('sm_addItems.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.post('/sm_addItems', function(request, response){
  var body = request.body;
  var way = body.way;
  var category = body.category;
  var photo = body.photo; //photo배열이 만들어짐!!!  console.log(photo[1]);
  var path = "";

  if (way == '직거래'){ value = 1; }
  else if (way == '사물함거래'){ value = 2; }
  else{ value = 3; }

  for(i=0; i<photo.length; i++){
    //client.query('INSERT INTO test2 (product_photo) VALUES (?)', [photo[i]], function(){});
    path = (path+photo[i]);
  }

  client.query('INSERT INTO test2 (product_name, product_price, product_category, product_photo, product_way, product_detail) VALUES (?,?,?,?,?,?)', [body.name, body.price, category, path, value, body.detail], function(){
    response.redirect('/');
  });
});

app.get('/sm_main', function(request, response){
  fs.readFile('sm_main.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/sm_itemDetail', function(request, response){
  fs.readFile('sm_itemDetail.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/sm_request', function(request, response){
  fs.readFile('sm_request.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.get('/t_request', function(request, response){
  fs.readFile('t_request.html', 'utf8', function(error, data){
    response.send(data);
  });
});
