
var fs = require('fs');
var ejs = require('ejs');
var mysql = require('mysql');
var express = require('express');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var bkfd2Password = require("pbkdf2-password");
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var flash = require('connect-flash');
var nodemailer = require('nodemailer');
var multipart = require('connect-multiparty');
var smtpTransport = require("nodemailer-smtp-transport");


var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;


var multipartMiddleware = multipart();
//DB 설정//
var client = mysql.createConnection({
  host : '203.153.144.75',
  port : 3306,
  user : 'sm14',
  password : 'sm14',
  database : 'sooksmarket'
});
client.connect();

//express 서버객체 생성//
var app = express();


//뷰 엔진 설정//
app.set('views', __dirname);
app.set('view engine', 'ejs');
app.set('uploadDir', './fileUploads');
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

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname));

app.use(passport.initialize());
app.use(passport.session());

//서버 실행
app.listen(80, function(){
  console.log('server running at http://127.0.0.1:80');
});

var loginId = "";
//아이디 중복체크 함수
var idExistence = -1;

var checkUserId = function(id, callback){
  var column = ['login_id'];
  var tablename = 'Login';

  var exec = client.query('select username from users where username='+mysql.escape(id), function(err, rows){
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


app.get('/', function(req, res){
  if (req.user && req.user.displayName) {
  res.render('sm_main.ejs');
} else {
  res.render('index.ejs');
}
  // console.log("index.ejs 요청됨");
  // response.render('index.ejs');
});



////--
app.get('/auth/logout', function(req, res) {
    req.logout();
    req.session.save(function() {
        res.redirect('/sm_main');
    });
});

app.get('/sm_main', function(req, res){
  if (req.user && req.user.displayName) {
  res.render('sm_main.ejs');
} else {
  res.render('index.ejs');
}
});

passport.serializeUser(function(user, done) {
  console.log('serializeUser', user);
  done(null, user.authId);
});

passport.deserializeUser(function(id, done) {
  console.log('deserializeUser', id);
  loginId=id.split(":");
  var sql='SELECT * FROM users WHERE authId=?';
  client.query(sql,[id],function(err,results){
    if(err){
      console.log(err);
      done(null,false);
    } else{
      done(null,results[0]);
    }
  });
});
passport.use(new LocalStrategy(
function(username, password, done) {
  var uname = username;
  var pwd = password;
  var sql = 'SELECT * FROM users WHERE authId=?';
  client.query(sql, ['local:' + uname], function(err, results) {
    console.log(results);
    var user = results[0];
    if (user===undefined) {
        console.log(err);
        return done(null,false);
        //redirect('/')
    }
    console.log('사용자 : ',user);
    console.log('입력한 아이디',pwd)
      return hasher({password:pwd, salt:user.salt}, function(err, pass, salt, hash) {
          console.log('salt :',user.salt);
          console.log('password :',user.password);
          console.log('hash :',hash);
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
            failureRedirect: '/',
            failureFlash: false
        }
    )
);


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

app.post('/sm_signup', function(req, res){
  return hasher({password:req.body.password}, function(err, pass, salt, hash) {
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
    console.log('salt :',user.salt);
    console.log('password :',user.password);
    console.log('hash :',hash);
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
});
});


app.get('/sm_addItems', function(request, response){
  fs.readFile('sm_addItems.html', 'utf8', function(error, data){
    response.send(data);
  });
});

app.post('/sm_addItems', multipartMiddleware, function(request, response){
  var body = request.body;
  var way = body.way;
  var category = body.category;

  if (way == '직거래'){ value = 1; }
  else if (way == '사물함거래'){ value = 2; }
  else{ value = 3; }

  // 파일이 업로드되면 files 속성이 전달됨
  var imageFile = request.files.file;
  var length = request.files.file.length;

  var name = new Array();
  var path = new Array();
  var type = new Array();
  var outputPath = new Array();

  if(!(length > 0) && (request.files.file.size === 0)){  // 파일 0개
    outputPath[0] = ""; outputPath[1] = ""; outputPath[2] = "";
    fs.unlink(request.files.file.path, function(err) { });
  }
  else if(!(length > 0) && (request.files.file.size !== 0)){  // 파일 1개
    name[0] = imageFile.name;
    path[0] = imageFile.path;
    type[0] = imageFile.type;

    if(type[0].indexOf('image') != -1) {
        // image 타입이면 이름을 재지정함(현재날짜로)
        outputPath[0] = './fileUploads/' + Date.now() + '_' + name[0];
        fs.rename(path[0], outputPath[0], function(err) {});
    }
    outputPath[1] = ""; outputPath[2] = "";
  }
  else{  // 파일 2개 또는 3개
    for(var i=0; i<length; i++){
      // 업로드 파일이 존재하면
      // 그 파일의 이름, 경로, 타입을 저장
      name[i] = request.files.file[i].name;
      path[i] = request.files.file[i].path;
      type[i] = request.files.file[i].type;

      if(type[i].indexOf('image') != -1) {
          // image 타입이면 이름을 재지정함(현재날짜로)
          outputPath[i] = './fileUploads/' + Date.now() + '_' + name[i];
          fs.rename(path[i], outputPath[i], function(err) {});
      }
    }
    for( i=length; i<3; i++){
      request.files.file[i] = ""; outputPath[i] = "";
    }
  }
  client.query('INSERT INTO ProductInfo (product_name, product_price, product_category, photo1, photo2, photo3, product_way, product_detail) VALUES (?,?,?,?,?,?,?,?)', [body.name, body.price, category, outputPath[0], outputPath[1], outputPath[2], value, body.detail], function(){
    response.redirect('/');
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

app.get('/sm_changeInfo', function(req, res){
  var sql = 'SELECT * FROM users  WHERE username=?';
  client.query(sql,loginId[1],function(err, rows, fields){
    res.render('sm_changeInfo', {rows:rows});
  });
});

app.get('/test', function(req, res){
  //var str = loginId.split(":");
  console.log(loginId[1]);
  var sql = 'SELECT * FROM users WHERE username=?';
  client.query(sql,str[1],function(err, rows, fields){
    res.render('test',{rows:rows});
    //res.send(`${rows[3].username}`);
  });
});

app.post('/sm_changeInfo',function(req,res){
  console.log('sm_changeInfo 접근중');
  return hasher({password:req.body.password}, function(err, pass, salt, hash) {

        var password = hash;
        var salts = salt;
        var login_phone = req.body.phone;

    //users.push(user);
    var sql = 'UPDATE users SET password=?, salt=?, login_phone=? WHERE username=?';
    client.query(sql, [password,salts,login_phone,loginId[1]], function(err, rows, fields) {
        if(err){
          console.log(err);
        } else {
          res.redirect('/');
        }
    });
});

})
app.get('/sm_enter_changeInfo',function(req,res){
  res.render('sm_enter_changeInfo.ejs');
})

// app.post('/sm_enter_changeInfo',function(req,res){
//   console.log('sm_enter_changeInfo 접근중');
//   console.log(loginId);
//   var sql = 'SELECT * FROM users WHERE username=?';
//   client.query(sql, [loginId[1]], function(err, results) {
//     console.log('1');
//     console.log(results);
//     console.log('2');
//     var user = results[0];
//     if (user===undefined) {
//         res.redirect('sm_main')
//         //redirect('/')
//     }
//     console.log("user값 받아왔습니다");
//       return hasher({password:req.body.password, salt:user.salt}, function(err, pass, salt, hash) {
//         console.log("해쉬함수집입");
//           if (hash === user.password) {
//               res.redirect('/sm_main');
//           } else {
//              console.log('/sm_main');
//              res.redirect('/sm_enter_changeInfo');
//           }
//       });
//       });
// });
