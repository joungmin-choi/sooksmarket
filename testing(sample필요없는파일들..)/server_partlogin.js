var fs = require('fs');
console.log('1');
var ejs = require('ejs');
console.log('2');
var mysql = require('mysql');
console.log('3');
var express = require('express');
console.log('4');
var session = require('express-session');
console.log('5');
var MySQLStore = require('express-mysql-session')(session);
console.log('6');
var bodyParser = require('body-parser');
console.log('7');
var cookieParser = require('cookie-parser');
console.log('8');
var bkfd2Password = require("pbkdf2-password");
console.log('9');
var passport = require('passport');
console.log('10');
var LocalStrategy = require('passport-local').Strategy;
console.log('11');
var hasher = bkfd2Password();
console.log('12');
var flash = require('connect-flash');
console.log('13');
var nodemailer = require('nodemailer');
console.log('14');
var smtpTransport = require("nodemailer-smtp-transport");
console.log('15');

//DB 설정//
var client = mysql.createConnection({
  host : '203.153.144.75',
  port : 3306,
  user : 'sm14',
  password : 'sm14',
  database : 'sooksmarket'
});
client.connect();

console.log('16');
//express 서버객체 생성//
var app = express();
console.log('17');
//뷰 엔진 설정//
app.set('views', __dirname);
console.log('18');
app.set('view engine', 'ejs');
console.log('19');
app.use(session({
    secret: '1234DSFs@adf1234!@#$asd',
    resave: false,
    saveUninitialized: true,
    store: new MySQLStore({
        host: '203.153.144.75',
        port: 3306,
        user: 'sm14',
        password: 'sm14',
        database: 'sooksmarket'
    })
}));
console.log('20');
app.use(bodyParser.urlencoded({extended: true}));
console.log('21');
app.use(express.static(__dirname));
console.log('22');
app.use(passport.initialize());
console.log('23');
app.use(passport.session());
console.log('24');

//서버 실행
app.listen(80, function(){
  console.log('a');
  console.log('server running at http://127.0.0.1:80');
});
console.log('25');
//아이디 중복체크 함수
var idExistence = -1;
console.log('26');
var checkUserId = function(id, callback){
  console.log('b');
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

console.log('27');
app.get('/', function(request, response){
  console.log('c');
  console.log("index.ejs 요청됨");
  response.render('index.ejs');
});


console.log('28');
////--
app.get('/auth/logout', function(req, res) {
  console.log('d');
    req.logout();
    req.session.save(function() {
        res.redirect('/sm_main');
    });
});

console.log('29');
app.get('/sm_main', function(req, res){
  console.log('e');
  if (req.user && req.user.displayName) {
  res.render('sm_main.ejs');
  // fs.readFile('sm_main.html', 'utf8', function(error, data){
  //   response.send(data);
  // });
} else {
  res.render('index.ejs')
}
});

console.log('30');
passport.serializeUser(function(user, done) {
  console.log('f');
    console.log('serializeUser', user);
    done(null, user.authId);
});
console.log('31');
passport.deserializeUser(function(id, done) {
  console.log('g');
    console.log('deserializeUser', id);
    var sql='SELECT * FROM users WHERE authId=?';
    client.query(sql,[id],function(err,results){
      if(err){
        console.log(err);
        done('There is no user. ');
      } else{
        done(null,results[0]);
      }
    });
    // for (var i = 0; i < users.length; i++) {
    //     var user = users[i];
    //     if (user.authId === id) {
    //         return done(null, user);
    //     }
    // }
    // done('There is no user.');
});
passport.use(new LocalStrategy(
function(username, password, done) {
  console.log('h');
    var uname = username;
    var pwd = password;
    var sql = 'SELECT * FROM users WHERE authId=?';
    client.query(sql, ['local:' + uname], function(err, results) {
            console.log(results);
            if (err) {
                return done('There is no user.');
            }
            var user = results[0];

            return hasher({password:pwd, salt:user.salt}, function(err, pass, salt, hash) {
                        console.log('------salt :',salt);
                        console.log('------salt :',user.salt);
                        console.log('------사용자 디비에 저장되어 있는 password :',user.password);
                        console.log('------사용자가 입력한 password :',pwd);
                        console.log('------hash :',hash);

                if (hash === user.password) {
                    console.log('LocalStrategy', user);
                     done(null, user);
                } else {
                  console.log('err');
                     done(null, false);
                }
            });
        });
    }
    ));

    app.post(
        '/index',
        passport.authenticate(
            'local', {
                successRedirect: '/sm_main',
                failureRedirect: '/index',
                failureFlash: false
            }
        )
    );

console.log('32');
app.get('/sm_signup', function(request, response){
  console.log('i');
  var context = {idExistence : idExistence};
  request.app.render('sm_signup.ejs', context, function(err,html){
    if(err){throw err;}
    response.end(html);
  });
});
console.log('33');
app.get('/checkId', function(request, response){
  console.log('j');
  var id = request.query.id;

  readData(id, function(){
    var context = {userId : id, idExistence : idExistence};
    request.app.render('checkId.ejs', context, function(err,html){
      if(err){throw err;}
      response.end(html);
    });
  });
});
console.log('34');
var readData = function(id, callback){
  checkUserId(id, function(err, rows){
    if(err){throw err;}
    callback();
  });
};
console.log('35');
var smtpTransport = nodemailer.createTransport(smtpTransport({
  host : "smtp.gmail.com",
  secureConnection : false,
  port : 587,
  auth : {
    user : "miniymay101",
    pass : "sb028390"
  }
}));
console.log('36');
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
console.log('37');
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
console.log('38');
app.post('/sm_signup', function(req, res){
  // var body = request.body;
  // client.query('INSERT INTO Login (login_name, login_id, login_password, login_email, login_phone) VALUES (?,?,?,?,?)', [body.name, body.id, body.pw, body.email+"@sm.ac.kr", body.phone], function(){
  //   response.redirect('/');
  // });
  console.log('k');
  console.log(req.body.password);
  console.log(`${req.body.password}`);
  console.log('kk')
  return hasher({password:req.body.password}, function(err, pass, salt, hash) {
    console.log('l');
    console.log('input : salt',`${salt}`);
    console.log('input : hash',`${hash}`);
    var user = {
        authId: 'local:' + req.body.username,
        username: req.body.username,
        password:hash,
        salt:salt,
        displayName: req.body.displayName,
        login_name : req.body.name,
        login_email : req.body.email+'@sm.ac.kr',
        login_phone : req.body.phone
    };
  //  console.log('1번' + `${hash}`);
  //  console.log('1번' + `${salt}`);

    console.log('---password :' +user.password);
    console.log('---salt :' +user.salt);
    //users.push(user);
    var sql = 'INSERT INTO users SET ?';
    client.query(sql, user, function(err, result) {
        if (err) {
            console.log(err);
            res.status(500);
        } else { //바로 로그인 하고 싶을 때 추가!!
            // req.login(user,function(err){
            //   req.session.save(function(){
                 res.redirect('/');
            //   });
            // });
        }
    });
    // req.login(user, function(err){
    //   req.session.save(function(){
    //     res.redirect('/welcome');
    //   });
    // });
});

});
console.log('39');
app.get('/sm_addItems', function(request, response){
  fs.readFile('sm_addItems.html', 'utf8', function(error, data){
    response.send(data);
  });
});
console.log('40');
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

console.log('41');

app.get('/sm_itemDetail', function(request, response){
  fs.readFile('sm_itemDetail.html', 'utf8', function(error, data){
    response.send(data);
  });
});
console.log('42');
app.get('/sm_request', function(request, response){
  fs.readFile('sm_request.html', 'utf8', function(error, data){
    response.send(data);
  });
});
console.log('43');
app.get('/t_request', function(request, response){
  fs.readFile('t_request.html', 'utf8', function(error, data){
    response.send(data);
  });
});
console.log('44');
app.get('/auth/login', function(req, res) {
    var output = `
  <h1>Login</h1>
  <form action="/auth/login" method="post">
    <p>
      <input type="text" name="username" placeholder="username">
    </p>
    <p>
      <input type="password" name="password" placeholder="password">
    </p>
    <p>
      <input type="submit">
    </p>
  </form>
  `;
    res.send(output);
});
